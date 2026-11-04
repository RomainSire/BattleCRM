# 06: Carte d'un Contact dans la sidebar

**What to build:** sur le profil LinkedIn d'un Contact, la sidebar montre sa carte : nom (★ pour un Allié), pastille d'État avec l'Étape s'il est En prospection, Organisation, poste, « Dernier échange : 12 sept. » ou « Aucun échange », et « Ouvrir sa fiche ↗ » qui ouvre sa fiche dans l'app, dans un nouvel onglet. Elle suit l'onglet actif et le profil affiché. Sources : [spec extension](../../battlecrm-extension/spec.md) §3, §8 ; ST-95 (branche Contact trouvé), ST-112.

**Blocked by:** 02, 04

**Status:** resolved

- [x] `GET /contacts/linkedin-profile?url=…` (module `views`) : Contact trouvé → `{ contact: { id, name, status, stageName, organizationName, jobTitle, lastDoneInteractionOn } }`, noms résolus côté serveur ; `lastDoneInteractionOn` = dernière Interaction faite (sortante ou entrante), la date d'ajout ne compte pas ; Archivé trouvé, anonymisé jamais ; pas un Contact → `{ contact: null }` (le reste de la réponse au ticket 07)
- [x] Un seul appel à l'ouverture de la sidebar et à chaque changement de profil dans l'onglet actif, jamais en continu
- [x] Carte d'un Contact Archivé comme les autres ; rien ne se modifie dans l'extension
- [x] Tests : endpoint contre Postgres ; carte en Chromium avec le faux background ; axe

## Comments

**2026-11-04, implémentation (agent).**

- `GET /contacts/linkedin-profile?url=…` (`apps/api/src/views/index.ts`, `linkedinProfileOf`) : URL normalisée par le serveur ; Contact trouvé → `{ contact: { id, name, status, stageName, organizationName, jobTitle, lastDoneInteractionOn } }`. `stageName` seulement En prospection (un Contact garde sa dernière Étape). `lastDoneInteractionOn` = jour local de la dernière Interaction sortante ou entrante, `null` sinon. Archivé trouvé, anonymisé jamais. Pas un Contact, ou une adresse qui n'est pas un profil : `{ contact: null }` (ignorée, pas refusée) ; sans `url`, `400`. Le paramètre `name` et le reste de la réponse viennent avec le ticket 07. Tests contre Postgres (`linkedin-profile.test.ts`), isolation par cookie et par jeton.
- Background : message `lookup { url }` → `Lookup` (`contact`, `notContact`, ou `ProfileUnknown` : `elsewhere`, `signedOut`, `error`, `outdated`). Ses refus et pannes sont traités au même endroit que `presence` (`aboutProfile`).
- Sidebar : `watchActiveTab` (`src/sidebar/active-tab.ts`) suit l'onglet actif de sa fenêtre (`tabs.query`, `onActivated`, `onUpdated`), sans la permission `tabs`. Un appel par profil affiché (clé = URL normalisée) : une autre page du même profil ne relance rien. Revenir sur un profil déjà vu le relit, parce que le Contact a pu changer dans l'app entre-temps. Sur `401`, l'écran de session reprend la main (« Ta session a expiré ») ; sur `426`, « Extension à mettre à jour » ; sur une erreur, « BattleCRM ne répond pas » avec « Réessayer », qui relit le profil.
- Carte (`src/sidebar/contact-card.tsx`) : nom (★ masqué au lecteur d'écran, l'État le dit en toutes lettres), pastille « En prospection · <Étape> », Organisation (« Sans Organisation » à défaut), poste s'il existe, « Dernier échange : 12 sept. » ou « Aucun échange », « Ouvrir sa fiche ↗ » vers `/contacts/<id>` dans un nouvel onglet. Rien de modifiable. Libellés `extension_last_done_interaction` et `extension_no_done_interaction` ; libellés des États partagés avec l'élément de la page (`src/status.ts`).
- Tests Chromium avec le faux background et un faux onglet (`fakeTab`) ; axe sur les cartes Prospection, Allié et Archivé, dans les deux thèmes.
- Pas de migration.
- Pour plus tard :
  - Un profil qui n'est pas un Contact laisse la sidebar vide (pied seulement) jusqu'au formulaire du ticket 07.
  - Le badge et l'élément après le nom ne suivent toujours pas une connexion ou une déconnexion depuis la sidebar (ticket 05) : à reprendre avec l'ajout (ticket 07).
  - `watchActiveTab` n'est pas testé (pas de bout en bout possible, spec §10) ; les tests jouent les changements d'adresse, pas un changement d'onglet.
  - La date du dernier échange n'a jamais d'année, comme dans la spec (§16) : ambiguë pour un échange vieux de plus d'un an.
  - Un `401` sur la lecture du profil suivi d'une session qui répond `200` (cas limite) laisse la sidebar vide.
- Suggéré, jamais obligatoire : dans un vrai Firefox, ouvrir la sidebar sur le profil d'un Contact, passer à un autre onglet LinkedIn puis à un autre site, et vérifier que la carte suit.
