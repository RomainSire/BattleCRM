# Spec extension Firefox : BattleCRM

Status: ready-for-agent
Source : [carte extension](map.md), 11 tickets résolus (`issues/01` à `issues/11`), consolidés le 2026-10-30.

Cette spec est la destination de la carte extension. Elle rassemble ce que fait l'extension Firefox (surfaces, gestes, microcopie), ce qu'elle lit sur LinkedIn, ce qu'elle demande à l'API, sa stack, ses tests et sa livraison. Chaque exigence porte un identifiant `ST-xx` (de ST-90 à ST-125, à la suite de la [spec UX](../battlecrm-ux/spec.md) §8) pour être citée par les tickets d'implémentation. Le §15 propose un découpage.

**Ce qui fait foi.** Le vocabulaire vient de [`CONTEXT.md`](../../CONTEXT.md), les choix difficiles à défaire de [`docs/adr/`](../../docs/adr/). La [spec UX](../battlecrm-ux/spec.md) et la [spec stack](../battlecrm-stack/spec.md) valent pour l'extension partout où celle-ci ne dit rien d'autre ; en particulier la spec stack §9 (contrat d'API pour l'extension). Le détail de chaque décision (options écartées, raisons, faits vérifiés) reste dans son ticket ; cette spec n'en garde que la décision et renvoie au ticket entre crochets. Quand deux tickets se contredisent, ou qu'aucun ne tranche un détail, l'arbitrage est noté au §13.

**Tout le code est en anglais** : fichiers, identifiants, endpoints, commentaires, messages de la console. Aucun terme nouveau au glossaire : `presence` et `linkedin-profile` nomment des endpoints, pas des notions du domaine (le Contact porte déjà « l'URL de son profil LinkedIn, qui l'identifie »).

**Rien d'obligatoire à la main** (règle de Romain) : les vérifications dans un vrai Firefox et la recette (§12) sont suggérées, jamais imposées par la CI ou la livraison.

---

## 1. Vue d'ensemble

```
LinkedIn (onglet)                      extension Firefox                         app.battlecrm…
 profil /in/<slug>  ── content script ──► background (event page) ── Bearer ──► /api/*
 recherche de personnes   │ lit le DOM       │ seul à appeler l'API
                          │ pose l'élément    │ jeton, 401, 426, badge
                          │ et les pastilles  ▲
                          └─── messages ──────┤
                                   sidebar (React) ─── « Ouvrir sa fiche » ──► /contacts/<id> (nouvel onglet)
```

- **Besoin** : depuis un profil LinkedIn, savoir si la personne est déjà un Contact, sinon l'ajouter à la volée ; sur une recherche de personnes, voir d'un coup d'œil qui est déjà un Contact.
- **Firefox seul** (≥ 140), **une seule instance** (origine fixée au build), distribuée en `.xpi` signé AMO non listé, au même numéro de version que l'app.
- **Fonctions** : présence et ajout sur un profil, pastille de présence sur la recherche, connexion et déconnexion, « Ouvrir sa fiche » vers l'app. Aucun réglage dans l'extension (§13, A5).
- **Fait de départ** : la présence (badge, carte, pastille) se décide sur l'**URL normalisée**, jamais sur le DOM. Un changement de LinkedIn ne casse que le pré-remplissage, l'élément après le nom et le repérage des résultats de la recherche ([Quand LinkedIn change son DOM](issues/09-quand-linkedin-change-son-dom.md)).

## 2. Surfaces

[Surfaces d'interface d'une extension Firefox MV3](issues/01-surfaces-ui-firefox-mv3.md), [Où vit l'interface et ce qu'elle montre](issues/06-surfaces-et-gestes.md) ; prototype `prototype/ext-06-surfaces-et-gestes`.

| Surface | Rôle |
|---|---|
| **Icône** (`browser.action`) | ouvre et ferme la sidebar ; porte le badge de présence de l'onglet |
| **Sidebar** (`sidebar_action`) | toute l'interface : connexion, carte du Contact, formulaire d'ajout, messages |
| **Élément après le nom** (profil) | informe seulement : logo et État, ou « + Ajouter à BattleCRM », ou « BattleCRM : se connecter » |
| **Pastilles** (recherche) | logo et État des résultats déjà Contacts ; un clic ouvre la fiche |

- **Sidebar** : un seul panneau, qui suit l'onglet actif (pas de `setPanel({ tabId })`). Le clic sur l'icône appelle `sidebarAction.toggle()` de façon **synchrone** dans `action.onClicked`, sans `default_popup` (Firefox exige le geste ; vérifié : il le garde même quand le clic réveille l'event page). Elle reste ouverte en changeant d'onglet et en cliquant dans la page, ce qui permet le copier-coller.
- **Seule l'icône ouvre la sidebar** : Firefox refuse de l'ouvrir depuis un clic dans la page (essai du 2026-10-30). L'élément après le nom n'est donc pas un bouton.
- **Écartés** : popup (se ferme au premier clic dans la page), fenêtre détachée (passe derrière LinkedIn), panneau injecté.
- **Badge** par onglet : `✓` déjà un Contact, `+` pas encore, `!` sans session, session expirée ou API en erreur. Firefox l'efface au rechargement ; un `pushState` de LinkedIn garde l'ancien, donc le content script le fait recalculer à chaque changement d'URL. Hors d'un profil, pas de badge.

## 3. La sidebar

[Où vit l'interface et ce qu'elle montre](issues/06-surfaces-et-gestes.md), [Formulaire d'ajout depuis LinkedIn](issues/07-formulaire-d-ajout.md), [Quand LinkedIn change son DOM](issues/09-quand-linkedin-change-son-dom.md).

Un état, sans router. Les écrans, du plus prioritaire au moins prioritaire :

1. **Extension à mettre à jour** (`426`) : « Firefox la met à jour tout seul. Pour ne pas attendre : about:addons › Rechercher des mises à jour. », lien vers Réglages › Préférences de l'app (§13, A2).
2. **Connexion** (aucune session) : e-mail et mot de passe, puis le code du second facteur s'il est actif (6 chiffres, ou un code de secours, comme l'écran de connexion de l'app). Mêmes messages que l'app (un seul message d'erreur, « Trop de tentatives… »).
3. **Session expirée** (`401`) : l'écran de connexion avec « Ta session a expiré », l'e-mail déjà rempli.
4. **BattleCRM ne répond pas** (réseau, `5xx`) : « BattleCRM ne répond pas », bouton « Réessayer ».
5. **Profil** (`/in/<slug>`) : la **carte** d'un Contact existant, ou le **formulaire d'ajout** (§4).
6. **Recherche illisible** : « BattleCRM n'a repéré aucun résultat sur cette page : LinkedIn a peut-être changé sa présentation. »
7. **Ailleurs** (recherche lisible, autre page de LinkedIn, autre site) : « Ouvre un profil LinkedIn pour voir ou ajouter un Contact. »

**Carte d'un Contact** (aussi après l'ajout et sur `linkedin_url_taken`) : nom avec ★ pour un Allié ; pastille d'État, avec l'Étape pour un Contact En prospection ; Organisation ; poste ; « Dernier échange : 12 sept. » ou « Aucun échange » (`lastDoneInteractionOn`, dernière Interaction faite, sortante ou entrante ; la date d'ajout ne compte pas) ; bouton « Ouvrir sa fiche ↗ » (nouvel onglet, `/contacts/<id>` de l'app). Un Contact Archivé a sa carte comme les autres. Rien ne se modifie dans l'extension.

**Pied de la sidebar**, une fois connecté : l'e-mail de l'Utilisateur et « Se déconnecter » (sans confirmation), qui révoque la session côté serveur et efface le jeton (§13, A4).

**Lecture du profil** : à l'ouverture de la sidebar et à chaque changement de profil dans l'onglet actif, jamais en continu. Un seul appel `GET /contacts/linkedin-profile` par lecture.

## 4. Formulaire d'ajout

[Formulaire d'ajout depuis LinkedIn](issues/07-formulaire-d-ajout.md) ; spec UX §6.8.

L'ajout rapide de la SPA (spec UX §6.8), avec ces écarts :

- **Champs, tous visibles** (pas de « Plus de champs ») : nom (seul obligatoire), poste, Organisation, e-mail, téléphone, note, et l'**URL LinkedIn**, pré-remplie avec l'URL normalisée du profil et **désactivée**. Les valeurs lues (§6) sont pré-remplies, modifiables, sans marqueur ; un champ non lu reste vide ; la note n'est jamais pré-remplie.
- **Organisation lue** : choisie parmi les Organisations existantes si son nom est le même après `normalizeName` (casse, accents, espaces) ; sinon proposée comme **nouvelle Organisation**, nom pré-rempli. Aucun rapprochement approché. L'Utilisateur peut effacer, choisir dans la liste filtrée à la frappe ou « Aucune Organisation », comme dans la SPA.
- **Type d'une nouvelle Organisation** : « ESN · Client final », sans présélection ; l'ajout est bloqué tant qu'il manque. Aucun indice tiré de LinkedIn.
- **État** : commande **Vivier · En prospection · Allié**, Vivier par défaut, jamais retenue. Étape pour En prospection : la première non archivée par défaut. `Entrée` ajoute ; **pas de `Ctrl Entrée`** (les gestes du Funnel passent par « Ouvrir sa fiche »).
- **Contacts du même nom** : une ligne discrète par Contact renvoyé (« Même nom : Jean Dupont · Capgemini », « Ouvrir sa fiche »), qui ne bloque pas. Pas de vérification sur l'e-mail ni le téléphone, pas de « lier ce profil au Contact existant ».
- **« Relire la page »** : relit le profil et ne remplit que les champs que l'Utilisateur n'a pas touchés (cas de « Coordonnées » ouverte après coup). Lancé tout seul quand le nom n'a pas été lu, en attendant que le bon profil soit affiché, 10 s au plus.
- **Profil illisible** (§7), après ce « Relire la page » automatique : le formulaire quand même, URL LinkedIn remplie, autres champs vides, sans « Même nom » ; au-dessus, une alerte discrète, non bloquante : « BattleCRM n'a pas pu lire ce profil : LinkedIn a peut-être changé sa présentation. Remplis les champs à la main. » « Relire la page » reste là.
- **Brouillon** : il appartient au profil, perdu au changement de profil ou d'onglet, sans confirmation ni mémoire.
- **Erreurs** : par `ErrorMessage` et `FieldErrorMessage` (`CODING_STANDARDS.md`).
- **Après l'ajout** : la sidebar relit le profil et montre la carte ; badge `✓` ; l'élément de la page montre l'État. Une ligne « Ajouté au Vivier · **Annuler** » (ou « Ajouté En prospection à <Étape> », « Ajouté au Cercle »), aussi longtemps que la notification de la SPA (10 s au moins, pause au survol et au focus). « Annuler » (`POST /gestures/:id/undo`) ramène au formulaire rempli et remet le badge à `+`.
- **URL déjà prise** (`linkedin_url_taken`, ajout depuis deux onglets) : la sidebar relit le profil et montre la carte du Contact existant.

## 5. Dans la page LinkedIn

[Où vit l'interface et ce qu'elle montre](issues/06-surfaces-et-gestes.md), [Stack de l'extension](issues/05-stack-de-l-extension.md).

- **DOM natif dans une racine d'ombre**, avec un petit CSS écrit à la main qui reprend les quelques couleurs du thème nécessaires ; ni React ni Tailwind. Un `<style>` dans le shadow root passe la CSP de LinkedIn (vérifié). Aucune ressource référencée par URL (elle trahirait l'UUID de l'extension) : SVG en ligne.
- **Couleurs** du thème choisies d'après le fond mesuré sur la page (LinkedIn clair ou sombre).
- **Élément après le nom** (profil) : juste après le `h2` du nom. Logo et État (★ pour un Allié) pour un Contact, « + Ajouter à BattleCRM » sinon, « BattleCRM : se connecter » sans session. Il ne fait qu'informer. Posé **seulement quand le nom du bon profil est affiché** (10 s au plus), jamais deux fois ; pas posé si le `h2` du nom manque.
- **Pastilles** (recherche de personnes) : logo « B » et État (★ pour un Allié), seulement pour les Contacts existants, **en ligne juste après le nom**, avant le degré « · 2e ». Le nom est le lien `/in/` contenu dans la ligne du nom (un `p`), pas le premier lien `/in/` du résultat. Un clic ouvre la fiche dans l'app, dans un nouvel onglet. Chaque résultat est **marqué avant la vérification par lot**, pour que deux lectures concurrentes ne posent jamais deux pastilles.
- **Repérage des changements** : Navigation API (changements d'URL de LinkedIn) et `MutationObserver` avec debounce pour la recherche (pagination sans rechargement comprise).
- **Accessibilité** : l'élément et la pastille portent un libellé lisible (« BattleCRM : Allié », « BattleCRM : En prospection »…), jamais la couleur seule.

## 6. Ce que l'extension lit sur LinkedIn

[Ce que l'extension lit sur LinkedIn](issues/04-ce-que-l-extension-scrape.md) (corrigé le 2026-10-30), [Fixtures de test du scraping](issues/10-fixtures-de-test-du-scraping.md) point 9.

**Règle** : « jamais de mauvaise valeur, plutôt vide », champ par champ. Les fonctions de lecture prennent un `Document` et l'URL, jamais `document` ni `location`.

| Champ | Lecture |
|---|---|
| **Garde-fou** | le profil n'est lu que si une `componentkey` de la page se termine par le slug de l'URL (comparés après normalisation) ; sinon le DOM est peut-être celui du profil précédent, rien n'est lu |
| **Nom** (`name`) | le titre de la page (« Nom \| LinkedIn », sans le compteur « (3) » éventuel), confirmé par un `h2` qui porte exactement ce texte ; tel quel, sans découpage (« Faïza B. » reste « Faïza B. ») |
| **Poste** (`jobTitle`) | le titre de l'expérience en cours (premier élément `entity-collection-item-…` de la section `…ExperienceTopLevelSection<slug>`, dates « … - aujourd’hui ») ; à défaut, le headline : dans la `section` du `h2` du nom, le premier `p` qui suit les `p` de degré (« · 1er », « · 2e »…) |
| **Organisation** | le nom porté par le lien `/company/` du premier élément d'Expérience, **seulement s'il est en cours**, sans le type de contrat (« · CDI », « · Stage »…) ; plusieurs postes dans une même Organisation : l'Organisation d'abord. Sinon vide. Jamais l'école, jamais la ligne ni les boutons du haut du profil |
| **E-mail, téléphone** | seulement si la fenêtre « Coordonnées » (`role="dialog"`) est **déjà ouverte** : e-mail du lien `mailto:`, téléphone sans son type (« (Mobile) »). L'extension ne l'ouvre jamais et ne charge pas `…/overlay/contact-info/`. Ni adresse ni anniversaire |
| **URL** | l'URL de l'onglet, normalisée (ST-93) |
| **Recherche** | chaque résultat est un `role="listitem"` ; il est identifié par son lien `/in/` normalisé (jamais par l'identifiant `ACoAA…`) ; la pastille s'accroche au lien du nom ; ni titre ni « Poste actuel » ne sont lus |

- **Techniques** : `componentkey` par sous-chaîne sur n'importe quel élément, la structure en secours. Abandonnés : les sélecteurs `section[componentkey*=…]` du POC et les secours « ancien LinkedIn » (`.text-body-medium`, `h1`, `aria-label` « Inviter… »).
- **Langue** : LinkedIn en français seulement. Les repères textuels (« aujourd’hui », « Coordonnées », types de contrat, degrés) sont regroupés en un seul endroit ; dans une autre langue, les champs qui en dépendent restent vides.
- **Pas d'indice de Cible** lu sur LinkedIn.

## 7. Quand LinkedIn change son DOM

[Quand LinkedIn change son DOM](issues/09-quand-linkedin-change-son-dom.md).

- **Une seule lecture** (§6), pas de seconde lecture en cascade : on mise sur la détection.
- **Page illisible**, constatée au bout des 10 s : profil sans nom lu ou sans `componentkey` portant le slug ; recherche sans aucun `role="listitem"` porteur d'un lien `/in/`. Un poste, une Organisation ou des Coordonnées vides restent normaux et silencieux.
- **Ce qui se voit** : carte normale pour un Contact trouvé ; formulaire avec alerte pour un profil qui n'est pas un Contact (§4) ; message dans la sidebar pour la recherche (§3) ; rien dans la page ; badge inchangé (il vient de l'URL), pas d'état « illisible ».
- **Pour Romain** : un `console.warn` explicite (« BattleCRM: unreadable profile, LinkedIn may have changed its layout », §13, A8) et la recette suggérée (§12). Rien n'est envoyé à l'API.

## 8. Contrat d'API

[Contrat d'API : présence et ajout](issues/08-contrat-presence-et-ajout.md) ; spec stack §9.

**Authentification** : plugin `bearer` de Better Auth, première étape de l'implémentation (ST-90). Même ligne `session` que le cookie (90 j glissants), marquée « Extension Firefox » dans « Appareils connectés », révocable ; chaque connexion de l'extension compte comme un nouvel appareil (e-mail de sécurité). Jeton dans `browser.storage.local`, appels en `credentials: 'omit'`, sans CORS (le background passe par `host_permissions`). Une seule liste d'origines (`APP_ORIGIN` et `moz-extension://`, tout uuid) pour `trustedOrigins` et `csrf()` : un POST du background porte `Origin: moz-extension://<uuid>` (vérifié dans Firefox 158).

**Deux lectures, dans le module `views`** :

| Endpoint | Corps ou paramètres | Réponse |
|---|---|---|
| `POST /contacts/presence` | `{ linkedinUrls: string[] }`, 50 au plus (`400` au-delà) | `{ matches: [{ linkedinUrl, contactId, status }] }`, clé = l'URL telle qu'envoyée |
| `GET /contacts/linkedin-profile?url=…&name=…` | URL du profil, nom lu (facultatif) | Contact trouvé : `{ contact: { id, name, status, stageName, organizationName, jobTitle, lastDoneInteractionOn } }` ; sinon `{ contact: null, sameName: [{ id, name, organizationName }], organizations: [{ id, name, type }], stages: [{ id, name }] }` |

- Le serveur **normalise lui-même** chaque URL (`normalizeLinkedInUrl` corrigée), sans se fier à l'extension ; une URL invalide est ignorée, pas refusée.
- **Archivé** : trouvé comme les autres. **Anonymisé** : sans URL, jamais trouvé.
- `organizations` : toutes celles de l'Utilisateur, avec leur type ; `stages` : les Étapes non archivées, dans l'ordre du Funnel. Pas d'endpoint de liste à part ; l'extension ne charge jamais le résumé (ADR 0012).
- **`sameName`** : `normalizeName(name)` comparé, dans l'API, aux noms des Contacts non anonymisés de l'Utilisateur (Archivés compris), sans nouvelle colonne ; 5 au plus, la dernière Interaction la plus récente d'abord. Sans `name`, `sameName` est vide.
- **Qui appelle quoi** : la recherche, un appel `presence` par lecture de la page (après le debounce) ; le badge et l'élément d'un profil, un appel `presence` avec la seule URL du profil (§13, A3) ; la sidebar, `linkedin-profile`.
- **Ajout** : `POST /contacts` tel quel (`newOrganization`, `undoToken`, refus `linkedin_url_taken` avec le `contactId`), sans changement de contrat. « Annuler » : `POST /gestures/:id/undo` tel quel. Déconnexion : `POST /sign-out` de Better Auth en bearer.
- **Versions** : `X-Client: extension/<version>` sur chaque appel ; en dessous de `MIN_EXTENSION_VERSION`, `426`. La règle N-1 reste la seule fenêtre.

## 9. Architecture de l'extension

[Outillage d'une extension Firefox MV3 en 2026](issues/02-stack-extension-firefox.md), [Stack de l'extension](issues/05-stack-de-l-extension.md).

- **Build** : WXT **épinglé** (`0.21.4`, sans `^`, mis à jour par PR manuelle), `imports: false` (imports explicites depuis `#imports`), sans `@wxt-dev/module-react` : `vite: () => ({ plugins: [react(), tailwindcss()] })`. `vite`, `typescript`, `web-ext` du catalog. `@types/firefox-webext-browser` pour les API propres à Firefox.
- **Workspace** `apps/extension` sur `packages/contract`, `packages/domain`, `packages/i18n`, `packages/theme`, `packages/ui` et `hc<AppType>`. `postinstall: wxt prepare` génère `.wxt/` avant `tsc -b` ; `apps/extension` entre dans les `references` du `tsconfig.json` racine ; `pnpm build` lance `wxt build -b firefox`.
- **`packages/ui`** (nouveau) : les primitives de `apps/web/src/components/ui` qui ne dépendent pas de la SPA, **déplacées** (sans copie). `OfflineNote` et `GesturePanel` restent dans `apps/web`. Le formulaire d'ajout n'est pas partagé.
- **Background** : event page (pas de service worker sous Firefox MV3), arrêtée après 30 s d'inactivité : écouteurs enregistrés de façon synchrone, jeton relu depuis `storage` à chaque réveil. **Seul** détenteur du client `hc<AppType>` (`headers` asynchrone pour `Authorization` et `X-Client`, `init: { credentials: 'omit' }` ; jamais de `headers` dans `init`, qui écraserait `content-type`), du jeton et du traitement de `401`, `426` et `X-App-Version`. Il tient le badge de chaque onglet.
- **Messages** : une union discriminée écrite à la main (un type par geste : `lookup`, `addContact`, `signIn`…) sur `browser.runtime.sendMessage`, avec un helper `send()`, sans bibliothèque ni zod.
- **Sidebar** : React 19, React Aria, Tailwind 4, `@battlecrm/theme`, `@battlecrm/ui` ; sans TanStack Router ; TanStack Query avec des `queryFn` qui appellent `send()` au lieu de `fetch`. Thème clair ou sombre selon le système (§13, A5).
- **Content scripts** : déclarés pour `https://www.linkedin.com/*`, DOM natif (§5).
- **Langue** : `packages/i18n` (Paraglide), langue du navigateur (`fr` ou `en`, `en` à défaut), sans réglage. Nom et description du manifeste en dur en français, sans `_locales`.
- **Manifeste** : MV3, `strict_min_version: 140.0`, `data_collection_permissions: none`, `browser_specific_settings.gecko.id` = `battlecrm@<domaine>` fixé une fois pour toutes, `update_url` vers `<APP_ORIGIN>/extension/updates.json`. `host_permissions` : LinkedIn et l'origine de l'app (plus `localhost` en dev) ; ni `tabs`, ni `activeTab`, ni `scripting`.
- **Origine** passée au build (`vars.APP_ORIGIN`, `http://localhost` en dev), rien en dur.
- **Dev** : `pnpm --filter @battlecrm/extension dev`, en dehors de `pnpm dev`, pointé sur `localhost`, avec un profil Firefox persistant dont le chemin est fixé dans un `web-ext.config.ts` git-ignoré (pour garder la session LinkedIn).

## 10. Tests

[Stack de l'extension](issues/05-stack-de-l-extension.md), [Fixtures de test du scraping](issues/10-fixtures-de-test-du-scraping.md).

- **Projet Vitest `extension`** dans `vitest.config.ts`, deux instances : **Firefox** (Playwright) pour la lecture de LinkedIn et les content scripts ; **Chromium** pour la sidebar, avec un faux background au niveau de `send()` (sans `WxtVitest()`, cassé dans ce mode). Le job CI et la note de `CLAUDE.md` passent à `playwright install chromium firefox`.
- **Fixtures** : les 7 copies de l'inspecteur anonymisées de `apps/extension/test/linkedin/` (5 profils, 2 pages de recherche) et leur `expected.json`. Les résultats attendus de la recherche sont à ajouter à `expected.json` avec la lecture de la recherche.
- **Cas limites par modification du DOM dans le test**, sur une page anonymisée : `h2` retiré (illisible), slug de l'URL changé (rien de lu), « (3) » dans le titre, `listitem` vidés (recherche illisible), expérience en cours retirée (Organisation vide, poste = headline).
- **Mise à jour des fixtures** : quand LinkedIn change, Romain enregistre de nouvelles copies dans `.private/linkedin/` et relance `apps/extension/scripts/anonymize-linkedin.ts` (configuration réelle dans `.private/linkedin/anonymize.json`) ; le garde-fou du script échoue sur toute fuite. Relire la sortie avant de la commiter est suggéré.
- **Côté API** : règle de la spec stack §13 (`app.request()` contre Postgres, au moins un test nominal par endpoint) ; les tests de sécurité générés tournent dans les deux modes (cookie et `bearer`) et donnent les mêmes refus.
- **Pas de bout en bout de l'extension** (Playwright ne charge pas d'extension Firefox ; Puppeteer n'atteint ni la sidebar ni les pages `moz-extension://` sans drapeau). La recette du §12 est suggérée.
- **Accessibilité** : axe sur chaque écran de la sidebar, dans les deux thèmes, comme les écrans de la SPA.

## 11. Livraison

[Livraison de l'extension](issues/11-livraison-de-l-extension.md) ; ADR 0013.

- **Une version signée à chaque tag**, même sans changement de son code, au numéro de l'app (AMO refuse toute version déjà envoyée et tout suffixe).
- **Job `extension`** dans `release.yml`, avant `images` : `wxt build -b firefox`, puis `web-ext sign --channel unlisted` (`--approval-timeout` 30 min, `timeout-minutes: 40`). **Son échec bloque la livraison** : rien n'est déployé, l'app en place continue.
- **Relance** : avant de signer, le job demande à l'API d'AMO si la version existe déjà ; si oui, il télécharge le fichier signé, sinon il signe. « Re-run failed jobs » marche toujours. La relivraison d'un tag (`workflow_dispatch`) ne signe rien : elle réutilise l'image `web` du tag.
- **Hébergement** : le `.xpi` signé (`battlecrm-<version>.xpi`, un seul par image) et `updates.json` sont copiés dans l'image `web`, servis par nginx sous `/extension/`. Le `.xpi` est aussi joint à la GitHub Release. Un retour arrière sert l'ancien `updates.json` ; Firefox ne rétrograde pas : l'extension N reste face à l'API N-1 le temps du retour arrière (accepté).
- **Première installation** : Réglages › Préférences de l'app, ligne « Extension Firefox » avec « Installer l'extension » vers `/extension/battlecrm-<version>.xpi` (la SPA connaît sa version), visible dans tous les navigateurs avec la mention « Pour Firefox ». Ensuite Firefox vérifie `updates.json` toutes les 24 h.
- **`MIN_EXTENSION_VERSION`** : constante de l'API, à la première version qui contient l'extension ; montée à la main, dans la PR même d'une étape « contract » qui retire ce dont l'extension se sert.
- **Secrets** : `WEB_EXT_API_KEY` et `WEB_EXT_API_SECRET` (compte AMO de Romain) en secrets du dépôt ; `vars.APP_ORIGIN` en variable (le domaine est public). La procédure va dans `docs/ops/install.md` §5 ; la première version envoyée crée le module sur AMO, sans démarche à la main.

## 12. Recette suggérée, jamais obligatoire

Sur le vrai LinkedIn, avec l'extension installée ; conseillée par une ligne de « Livrer une version » (`docs/ops/install.md`) avant un tag qui change la lecture de LinkedIn. Rien dans le workflow ni dans les notes de release.

1. Un profil avec une expérience en cours est lu en entier (nom, poste, Organisation).
2. Un profil sans expérience donne le nom seul (poste = headline).
3. Une recherche de personnes montre ses pastilles, page 2 comprise.
4. « Coordonnées » ouverte, puis « Relire la page » : l'e-mail est lu.

Une fois, au début du chantier : les points 🔎 de [research/18](../battlecrm-stack/research/18-extension-firefox-auth.md) dans un vrai Firefox (`Origin`, contournement de CORS, aucun cookie en `credentials: 'omit'`), spec stack §15.

## 13. Arbitrages

Détails qu'aucun ticket ne tranchait, ou que deux tickets disaient autrement ; à relire par Romain.

- **A1 Tutoiement.** Les tickets 09 et 11 écrivaient « Remplissez », « Ouvrez », « Mettez » ; la spec UX §1 impose le tutoiement, comme le ticket 06 (« Ta session a expiré »). Toute la microcopie tutoie.
- **A2 Message du `426`.** Le ticket 06 renvoyait au menu Extensions et aux Réglages, le ticket 11 à `about:addons` : les deux sont gardés (texte du §3, lien vers Réglages › Préférences, où vit « Installer l'extension »).
- **A3 Badge d'un profil.** `presence` avec la seule URL du profil, à chaque changement d'URL, que la sidebar soit ouverte ou non ; `linkedin-profile`, plus lourd, seulement pour la sidebar.
- **A4 Déconnexion.** Aucun ticket ne la plaçait : dans le pied de la sidebar, sans confirmation, comme « Se déconnecter » de l'app (spec UX §5.9) ; elle révoque la session et efface le jeton et l'e-mail retenu.
- **A5 Pas de réglages.** La langue suit le navigateur, l'origine est fixée au build ; le thème de la sidebar suit le système, faute de pouvoir lire le thème de l'app (préférence d'appareil dans son `localStorage`). Les « réglages minimaux » du cadrage se réduisent à rien.
- **A6 Sans session** : badge `!` (comme une session expirée), pour inviter à cliquer sur l'icône.
- **A7 Accessibilité.** WCAG 2.2 AA de la spec UX §1 vaut pour la sidebar ; axe dans ses tests (§10).
- **A8 Console en anglais.** Le message du `console.warn` du ticket 09 était en français ; le code et ses messages de journal sont en anglais.
- **A9 Libellés après l'ajout.** Le ticket 07 ne donnait que « Ajouté au Vivier » : « Ajouté En prospection à <Étape> » et « Ajouté au Cercle » suivent le même modèle, sans les compteurs de la SPA (l'extension n'a pas le résumé).

## 14. Exigences `ST-xx`

### 14.1 API

| ID | Exigence | Sources |
|---|---|---|
| ST-90 | **Plugin `bearer` activé** : même ligne `session` que le cookie, mêmes droits ; une seule liste d'origines (`APP_ORIGIN`, `moz-extension://`) pour `trustedOrigins` et `csrf()` ; tests de sécurité générés dans les deux modes, mêmes refus. | 08, stack §9 |
| ST-91 | Une session ouverte par l'extension apparaît « Extension Firefox » dans « Appareils connectés », révocable ; `POST /sign-out` en bearer la révoque. | stack §9, A4 |
| ST-92 | `X-Client: extension/<version>` lu par l'API ; `426` en dessous de la constante `MIN_EXTENSION_VERSION`, qui démarre à la première version contenant l'extension. | 11, stack §9 |
| ST-93 | `normalizeLinkedInUrl` (`packages/domain`) décode les `%xx`, passe en NFC et coupe un profil à `/in/<slug>` ; une migration re-normalise les `contact.linkedin_url` existants et signale les Contacts qui tomberaient sur la même URL au lieu d'échouer en silence. ST-30 s'en complète. | 04 |
| ST-94 | `POST /contacts/presence` (module `views`) : lots de 50, URL normalisées par le serveur, invalides ignorées, Archivés trouvés, anonymisés jamais. | 08 |
| ST-95 | `GET /contacts/linkedin-profile` (module `views`) : la carte, ou `sameName`, `organizations` et `stages` (non archivées, ordre du Funnel) en un seul appel. | 07, 08 |
| ST-96 | `sameName` : `normalizeName` sur les noms des Contacts non anonymisés, Archivés compris, 5 au plus, dernière Interaction la plus récente d'abord ; vide sans nom. | 07, 08 |

### 14.2 Lecture de LinkedIn et page

| ID | Exigence | Sources |
|---|---|---|
| ST-100 | Lecture d'un profil depuis un `Document` et l'URL, d'après les règles du §6, garde-fou du slug compris ; « plutôt vide » champ par champ. | 04, 10 |
| ST-101 | Lecture d'une recherche de personnes : résultats `role="listitem"`, lien du nom, URL normalisée. | 04, 06 |
| ST-102 | Page illisible détectée au bout de 10 s (§7), signalée par `console.warn`, jamais à l'API. | 09 |
| ST-103 | Repères textuels de LinkedIn (français) regroupés en un seul endroit. | 04 |
| ST-104 | Badge par onglet (`✓`, `+`, `!`), recalculé à chaque changement d'URL, `pushState` compris. | 06 |
| ST-105 | Élément après le nom, posé une fois, seulement quand le nom du bon profil est affiché (10 s au plus) ; absent si le `h2` manque. | 06, 09 |
| ST-106 | Pastilles de la recherche, chaque résultat marqué avant la vérification par lot (jamais deux pastilles), repérées par Navigation API et `MutationObserver` avec debounce ; clic vers la fiche. | 04, 06 |
| ST-107 | UI injectée en DOM natif dans une racine d'ombre, CSS écrit à la main, couleurs selon le fond de la page, SVG en ligne, aucune ressource par URL ; libellé lisible, jamais la couleur seule. | 01, 05, 06 |

### 14.3 Sidebar

| ID | Exigence | Sources |
|---|---|---|
| ST-110 | Sidebar unique qui suit l'onglet actif, ouverte et fermée par l'icône (`toggle()` synchrone dans `action.onClicked`). | 01, 06 |
| ST-111 | Écrans et priorités du §3 : mise à jour (`426`), connexion avec second facteur, session expirée (e-mail rempli), API injoignable, profil, recherche illisible, ailleurs ; déconnexion dans le pied. | 06, 09, 11, A4 |
| ST-112 | Carte d'un Contact (§3) avec « Ouvrir sa fiche ↗ ». | 06, 08 |
| ST-113 | Formulaire d'ajout du §4 (pré-remplissage, Organisation reprise ou nouvelle avec type, État et Étape, même nom, « Relire la page », brouillon par profil, alerte de profil illisible). | 07, 09 |
| ST-114 | Après l'ajout : carte, badge `✓`, élément à jour, « Annuler » (10 s au moins) qui ramène au formulaire rempli ; `linkedin_url_taken` montre la carte. | 07, 08 |
| ST-115 | Langue du navigateur (`fr`, `en`, `en` à défaut) par `packages/i18n` ; thème du système. | 05, A5 |
| ST-116 | WCAG 2.2 AA ; axe sur chaque écran dans les deux thèmes. | UX §1, A7 |

### 14.4 Outillage, tests, livraison

| ID | Exigence | Sources |
|---|---|---|
| ST-120 | `packages/ui` reçoit par déplacement les primitives de `apps/web/src/components/ui` qui ne dépendent pas de la SPA. | 05 |
| ST-121 | `apps/extension` en WXT épinglé (§9), dans `pnpm check` (`wxt prepare`, `references`), background seul à appeler l'API, messages typés à la main. | 02, 05 |
| ST-122 | Manifeste : Firefox ≥ 140, `data_collection_permissions: none`, `gecko.id` fixé, `update_url`, `host_permissions` LinkedIn et origine de l'app seulement, origine passée au build. | 01, 05, 11 |
| ST-123 | Projet Vitest `extension` (Firefox pour la lecture, Chromium pour la sidebar), sur les fixtures anonymisées et leurs cas limites ; CI en `playwright install chromium firefox`. | 05, 10 |
| ST-124 | Job `extension` de `release.yml` : signature non listée à chaque tag, réutilisation du fichier signé à la relance, échec bloquant ; `.xpi` et `updates.json` dans l'image `web` sous `/extension/`, `.xpi` joint à la Release. | 11 |
| ST-125 | « Installer l'extension » dans Réglages › Préférences ; procédure (clés AMO, `vars.APP_ORIGIN`) et ligne de recette dans `docs/ops/install.md`. | 11 |

## 15. Découpage suggéré

Dans l'ordre ; entre crochets, ce dont chaque ticket dépend.

1. **`packages/ui`** : déplacement des primitives (ST-120).
2. **Plugin `bearer`** : activation, origines, `X-Client` et `426`, « Extension Firefox », tests de sécurité dans les deux modes (ST-90 à ST-92).
3. **Normalisation des URL LinkedIn** et sa migration (ST-93).
4. **Endpoints de présence et de profil** (ST-94 à ST-96) [3].
5. **Squelette de l'extension** : WXT, manifeste, background, messages, sidebar, connexion et déconnexion, écrans `426`, `401`, API injoignable et « ailleurs » ; projet Vitest et CI (ST-110, ST-111, ST-115, ST-116, ST-121 à ST-123) [1, 2].
6. **Lecture d'un profil** sur les fixtures (ST-100, ST-102, ST-103) [5].
7. **Badge et élément après le nom** (ST-104, ST-105, ST-107) [4, 6].
8. **Carte et formulaire d'ajout**, « Annuler » (ST-112 à ST-114) [4, 6].
9. **Recherche de personnes** : lecture, pastilles, message de recherche illisible (ST-101, ST-106) [4, 5, 7].
10. **Livraison** : job `extension`, image `web`, « Installer l'extension », `docs/ops/install.md` (ST-124, ST-125) [5].

Chaque ticket qui ajoute une migration l'applique à la base de dev (`CLAUDE.md`).

## 16. Microcopie de référence

| Situation | FR |
|---|---|
| Élément après le nom | logo et État (« ★ Allié », « En prospection »…) ; « + Ajouter à BattleCRM » ; « BattleCRM : se connecter » |
| Carte | « Dernier échange : 12 sept. » ou « Aucun échange » ; « Ouvrir sa fiche ↗ » |
| Même nom | « Même nom : Jean Dupont · Capgemini » — Ouvrir sa fiche |
| Type d'une nouvelle Organisation | « ESN · Client final » |
| Profil illisible | « BattleCRM n'a pas pu lire ce profil : LinkedIn a peut-être changé sa présentation. Remplis les champs à la main. » — Relire la page |
| Après l'ajout | « Ajouté au Vivier · Annuler » ; « Ajouté En prospection à <Étape> · Annuler » ; « Ajouté au Cercle · Annuler » |
| Recherche illisible | « BattleCRM n'a repéré aucun résultat sur cette page : LinkedIn a peut-être changé sa présentation. » |
| Ailleurs | « Ouvre un profil LinkedIn pour voir ou ajouter un Contact. » |
| Session expirée | « Ta session a expiré » (e-mail déjà rempli) |
| `426` | « Extension à mettre à jour » — « Firefox la met à jour tout seul. Pour ne pas attendre : about:addons › Rechercher des mises à jour. » |
| API injoignable | « BattleCRM ne répond pas » — Réessayer |
| Réglages de l'app | « Extension Firefox » — Installer l'extension — « Pour Firefox » |

L'anglais s'écrit avec les messages Paraglide, à l'implémentation, d'après les lignes `_EN_` de `CONTEXT.md`.

## 17. Hors périmètre

- Chromium (Chrome, Edge, Brave).
- Publication listée sur addons.mozilla.org.
- Modifier un Contact depuis l'extension ; lier un profil à un Contact existant.
- Gestes du Funnel depuis LinkedIn (utiliser un Positionnement, noter une Interaction, Prendre des nouvelles…).
- Plusieurs instances (URL saisie à la connexion).
- Ajout depuis la recherche de personnes.
- « Lire la page (IA) » ([Quand LinkedIn change son DOM](issues/09-quand-linkedin-change-son-dom.md)).
- LinkedIn dans une autre langue que le français.
- Tests de bout en bout de l'extension.
