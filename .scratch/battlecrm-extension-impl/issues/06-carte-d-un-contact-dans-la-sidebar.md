# 06: Carte d'un Contact dans la sidebar

**What to build:** sur le profil LinkedIn d'un Contact, la sidebar montre sa carte : nom (★ pour un Allié), pastille d'État avec l'Étape s'il est En prospection, Organisation, poste, « Dernier échange : 12 sept. » ou « Aucun échange », et « Ouvrir sa fiche ↗ » qui ouvre sa fiche dans l'app, dans un nouvel onglet. Elle suit l'onglet actif et le profil affiché. Sources : [spec extension](../../battlecrm-extension/spec.md) §3, §8 ; ST-95 (branche Contact trouvé), ST-112.

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [ ] `GET /contacts/linkedin-profile?url=…` (module `views`) : Contact trouvé → `{ contact: { id, name, status, stageName, organizationName, jobTitle, lastDoneInteractionOn } }`, noms résolus côté serveur ; `lastDoneInteractionOn` = dernière Interaction faite (sortante ou entrante), la date d'ajout ne compte pas ; Archivé trouvé, anonymisé jamais ; pas un Contact → `{ contact: null }` (le reste de la réponse au ticket 07)
- [ ] Un seul appel à l'ouverture de la sidebar et à chaque changement de profil dans l'onglet actif, jamais en continu
- [ ] Carte d'un Contact Archivé comme les autres ; rien ne se modifie dans l'extension
- [ ] Tests : endpoint contre Postgres ; carte en Chromium avec le faux background ; axe
