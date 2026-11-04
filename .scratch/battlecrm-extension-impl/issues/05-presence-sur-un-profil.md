# 05: Présence sur un profil : badge et élément après le nom

**What to build:** en naviguant sur LinkedIn, l'icône de l'extension porte `✓` sur le profil d'un Contact, `+` sur un autre profil, `!` sans session ou en cas d'erreur d'API, et rien hors d'un profil, y compris après une navigation interne de LinkedIn. Juste après le nom du profil, un élément montre le logo et l'État du Contact (★ pour un Allié), « + Ajouter à BattleCRM » sinon, ou « BattleCRM : se connecter ». Sources : [spec extension](../../battlecrm-extension/spec.md) §2, §5, §6, §8, §13 (A3, A6) ; ST-94, ST-100 (nom et garde-fou), ST-104, ST-105, ST-107.

**Blocked by:** 02, 04

**Status:** resolved

- [x] `POST /contacts/presence` (module `views`) : `{ linkedinUrls }`, 50 au plus (`400` au-delà), URL normalisées par le serveur, invalides ignorées, réponse `{ matches: [{ linkedinUrl, contactId, status }] }` clé = l'URL envoyée ; Archivé trouvé, anonymisé jamais ; tests contre Postgres (isolation comprise)
- [x] Lecture du nom sur un `Document` et l'URL : titre de la page (sans « (3) ») confirmé par un `h2` au texte exact ; garde-fou : une `componentkey` se termine par le slug de l'URL ; tests Firefox sur les fixtures anonymisées et leurs cas limites (`h2` retiré, slug changé, compteur dans le titre)
- [x] Content script sur LinkedIn : changements d'URL repérés (Navigation API), badge de l'onglet recalculé à chaque changement, `pushState` compris (appel `presence` à une URL)
- [x] Élément posé dans une racine d'ombre, DOM natif, CSS à la main, couleurs selon le fond mesuré, SVG en ligne ; posé une seule fois, seulement quand le nom du bon profil est affiché (10 s au plus), jamais si le `h2` manque ; libellé lisible, jamais la couleur seule ; il n'est pas un bouton
- [x] Repères textuels de LinkedIn (français) regroupés en un seul endroit

## Comments

**2026-11-04, implémentation (agent).**

- `POST /contacts/presence` (`apps/api/src/views/index.ts`, `presenceOf`) : `{ linkedinUrls }`, `PRESENCE_MAX_URLS` = 50 dans `packages/contract` (`400` au-delà, comme un corps qui n'est pas une liste de textes). Chaque URL est normalisée par le serveur, les invalides ignorées ; deux URL envoyées qui désignent le même profil ont chacune leur ligne, sous l'adresse envoyée. Archivé trouvé, supprimé (anonymisé) jamais. Tests contre Postgres (`presence.test.ts`) : isolation par cookie et par jeton de l'extension.
- Lecture (`src/linkedin/profile.ts`) : `profileUrlOf(url)` et `profileName(page, url)` → `{ name, heading }`. Titre sans « (3) », `h2` au texte exact, garde-fou : une `componentkey` se termine par le slug normalisé (NFC, minuscules). Repères dans `src/linkedin/landmarks.ts` (pour l'instant : le motif du titre et le nom de l'attribut). Tests Firefox sur les 5 profils et les cas limites (`h2` retiré, slug changé, compteur, slug encodé ou accentué) ; `test/linkedin/pages.ts` charge une fixture en `Document`.
- Badge : message `presence { url }`. Le background appelle l'API avec la seule URL de l'onglet (A3) et pose `✓` (teal), `+` (gris), `!` (ambre : sans session, `401`, réseau, `5xx`, `426`), rien hors d'un profil (sans appel). Une réponse à une adresse dépassée ne touche pas le badge.
- Content script `linkedin.content.ts` sur `https://www.linkedin.com/*` : recalcule à chaque `currententrychange` (Navigation API, `pushState` compris). Un Firefox sans Navigation API ne suit que les chargements de page.
- Élément (`src/linkedin/presence-element.ts`, `createProfileWatch`) : `span` juste après le `h2` du nom, racine d'ombre, DOM natif, CSS et SVG du logo en ligne. Couleurs du thème choisies d'après le premier fond opaque derrière le nom ; un test vérifie 4,5:1 sur un LinkedIn clair et un sombre. Il attend le nom du bon profil 10 s au plus (MutationObserver), n'est jamais posé sans `h2`, et il n'y en a jamais deux (celui du profil est réutilisé). Il est lu « BattleCRM : Allié » (★ masqué au lecteur d'écran), « + Ajouter à BattleCRM » ou « BattleCRM : se connecter ». Ce n'est pas un bouton. Rien dans la page sur une erreur d'API ou un `426` : le badge `!` le dit. Libellés dans `packages/i18n` (`extension_presence_*`), dans la langue du navigateur.
- Pas de migration.
- Pour plus tard :
  - Après une connexion ou une déconnexion depuis la sidebar, le badge et l'élément ne changent qu'au changement d'URL suivant. À reprendre avec la carte (ticket 06) ou l'ajout (ticket 07).
  - Les couleurs de l'élément et du badge sont recopiées de `packages/theme` (CSS écrit à la main, spec §5), sans rien qui vérifie qu'elles restent identiques.
  - Aucune limite de longueur par URL dans `presence` : une URL invalide est ignorée, pas refusée.
- Suggéré, jamais obligatoire : dans un vrai Firefox, ouvrir un profil Contact puis un autre profil par un lien interne, et vérifier le badge et l'élément, en clair et en sombre.
