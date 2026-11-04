# 07: Ajouter un Contact depuis un profil

**What to build:** sur le profil LinkedIn de quelqu'un qui n'est pas un Contact, la sidebar ouvre le formulaire d'ajout rapide, pré-rempli avec ce qui se lit sur la page (nom, poste, Organisation, e-mail et téléphone si « Coordonnées » est ouverte) et l'URL LinkedIn affichée, désactivée. L'Utilisateur corrige, choisit l'État (Vivier par défaut, En prospection à une Étape, ou Allié) et ajoute par `Entrée`. La sidebar passe alors à la carte du Contact, le badge à `✓`, l'élément de la page à l'État, avec « Ajouté au Vivier · Annuler ». Sources : [spec extension](../../battlecrm-extension/spec.md) §4, §6, §8, §13 (A9), §16 ; ST-95, ST-100, ST-103, ST-113, ST-114.

**Blocked by:** 05, 06

**Status:** resolved

- [x] `GET /contacts/linkedin-profile` pour un profil qui n'est pas un Contact : `organizations` (toutes, avec leur type) et `stages` (non archivées, dans l'ordre du Funnel)
- [x] Lecture complète, « jamais de mauvaise valeur, plutôt vide » : poste de l'expérience en cours, sinon le headline ; Organisation du lien `/company/` de l'expérience en cours seulement, sans type de contrat, jamais l'école ; e-mail (`mailto:`) et téléphone sans son type seulement si « Coordonnées » est déjà ouverte ; tests Firefox sur les 5 profils de `expected.json` et le cas « expérience en cours retirée »
- [x] Formulaire : tous les champs visibles, nom seul obligatoire, note jamais pré-remplie ; Organisation reprise si même nom après `normalizeName`, sinon nouvelle Organisation au nom pré-rempli avec type « ESN · Client final » obligatoire, sans présélection ; liste filtrée et « Aucune Organisation » comme dans la SPA ; État Vivier · En prospection · Allié (Vivier par défaut, jamais retenu), Étape par défaut la première non archivée ; `Entrée` ajoute, pas de `Ctrl Entrée`
- [x] Ajout par `POST /contacts` tel quel (`newOrganization` compris) ; erreurs par `ErrorMessage` et `FieldErrorMessage`
- [x] Après l'ajout : carte relue, badge `✓`, élément à jour ; ligne « Ajouté au Vivier · Annuler » (ou « Ajouté En prospection à <Étape> », « Ajouté au Cercle »), 10 s au moins, pause au survol et au focus ; « Annuler » (`POST /gestures/:id/undo`) ramène au formulaire rempli et remet le badge à `+`
- [x] `linkedin_url_taken` (ajout depuis deux onglets) : la sidebar relit le profil et montre la carte du Contact existant
- [x] Brouillon perdu au changement de profil ou d'onglet, sans confirmation
- [x] Tests de la sidebar en Chromium (faux background) ; axe

## Comments

**2026-11-04, implémentation (agent).**

- `GET /contacts/linkedin-profile` (`apps/api/src/views/index.ts`) : pas un Contact → `{ contact: null, organizations, stages }`. `organizations` : toutes, avec leur type, par nom (`summaryOrganizations`) ; `stages` : non archivées, dans l'ordre du Funnel (`funnelStages`). Un Contact trouvé garde la réponse du ticket 06. `sameName` et le paramètre `name` restent pour le ticket 08. Test contre Postgres (`linkedin-profile.test.ts`).
- Lecture (`src/linkedin/profile.ts`, `readProfile(page, url)`) : `null` sans nom lu (garde-fou du slug ou `h2` manquant). Poste et Organisation : premier élément d'Expérience, cherché dans la `section` du bloc `…ExperienceTopLevelSection<slug>` (les éléments sont à côté du bloc, pas dedans), seulement si ses dates finissent par « aujourd’hui » ; Organisation du lien `/company/` (après le titre pour un poste seul, en tête pour plusieurs postes), type de contrat retiré s'il est connu, vide sinon. À défaut, le headline (premier `p` après les `p` de degré, rien sans degré). E-mail (`mailto:`) et téléphone sans son type, seulement dans une fenêtre « Coordonnées » ouverte (`dialog[open]` ou `role="dialog"`) qui porte un lien vers ce profil. Repères dans `landmarks.ts`. Tests Firefox : les 5 profils de `expected.json`, expérience en cours retirée, plusieurs postes dans une Organisation, type de contrat inconnu, « Coordonnées » fermée, autre profil.
- Background : `lookup { url, tabId }` lit l'onglet par son content script (`browser.tabs.sendMessage`, message `readProfile`) quand le profil n'est pas un Contact. `addContact { tabId, contact }` → `POST /contacts` tel quel ; `undo { tabId, undoToken }` → `POST /gestures/:id/undo`. Après un ajout, un `linkedin_url_taken` ou une annulation, le background dit `refresh` au content script, qui relance `presence` : badge et élément après le nom suivent. Un onglet sans content script ne lit rien.
- Sidebar : formulaire `src/sidebar/add-contact.tsx`, tous les champs visibles, URL LinkedIn désactivée, note vide, Vivier à chaque fois, Étape par défaut la première, `Entrée` ajoute. `OrganizationField` est **déplacé** de `apps/web` vers `packages/ui` pour être partagé (liste filtrée, « Aucune Organisation », type d'une nouvelle Organisation sans présélection) ; `targetText` reste dans l'app (`contacts/target.ts`). Erreurs par `ErrorMessage` et `FieldErrorMessage` ; `unknown_stage` et `organization_taken` relisent le profil, le brouillon gardé.
- Après l'ajout : la sidebar relit le profil (le bouton reste désactivé jusque-là) et montre la carte, avec la ligne `added-line.tsx` (« Ajouté au Vivier », « Ajouté En prospection à <Étape> », « Ajouté au Cercle », `Annuler`) : 10 s, recomptées après chaque pause au survol ou au focus ; elle reste tant qu'une annulation est en cours ou a échoué (« Ce geste ne peut plus être annulé. »). « Annuler » ramène le formulaire tel qu'envoyé. `linkedin_url_taken` : carte du Contact existant. Brouillon perdu au changement de profil ou d'onglet (clé = onglet + profil ; `WatchActiveTab` donne maintenant l'id de l'onglet).
- Libellés `extension_added_pool`, `extension_added_prospecting`, `extension_added_ally` (fr, en).
- Tests : background (lecture, ajout, refus, annulation) ; sidebar en Chromium avec le faux background (pré-remplissage, Organisation reprise ou nouvelle, nom seul obligatoire, États, Étape, ligne et minuterie, annulation, `taken`, refus, brouillon perdu) ; axe sur le formulaire et la carte après l'ajout, deux thèmes.
- Pas de migration.
- Pour plus tard :
  - Le profil est lu une seule fois, à la lecture de la sidebar : si LinkedIn n'a pas fini d'afficher la page, le formulaire est vide sauf l'URL. Le « Relire la page » automatique du ticket 08 le corrige.
  - Une panne pendant l'ajout ou l'annulation (réseau, `5xx`) s'affiche dans le formulaire ou la ligne (« Quelque chose n'a pas fonctionné… »), pas comme l'écran « BattleCRM ne répond pas » : le brouillon n'est pas perdu.
  - En prospection sans aucune Étape dans le Funnel : le sélecteur ne s'affiche pas, et l'API refuse (`unknown_stage`), avec le message « Cette Étape n'est plus dans le Funnel ».
  - Le badge et l'élément ne suivent toujours pas une connexion ou une déconnexion depuis la sidebar (tickets 05 et 06).
- Suggéré, jamais obligatoire : dans un vrai Firefox, ouvrir un profil qui n'est pas un Contact, la sidebar ouverte, l'ajouter, vérifier le badge `✓` et l'élément, puis « Annuler ».
