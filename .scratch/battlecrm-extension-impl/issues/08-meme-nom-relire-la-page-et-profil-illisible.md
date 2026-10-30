# 08: Même nom, « Relire la page » et profil illisible

**What to build:** le formulaire d'ajout signale sans bloquer les Contacts qui portent le même nom (« Même nom : Jean Dupont · Capgemini », « Ouvrir sa fiche »). « Relire la page » relit le profil et ne remplit que les champs non touchés, par exemple après avoir ouvert « Coordonnées ». Quand le nom n'a pas été lu, la relecture se lance toute seule ; si le profil reste illisible, le formulaire s'affiche quand même, URL remplie, avec l'alerte « BattleCRM n'a pas pu lire ce profil… ». Sources : [spec extension](../../battlecrm-extension/spec.md) §4, §7, §8, §13 (A8), §16 ; ST-96, ST-102.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] `sameName` dans `GET /contacts/linkedin-profile` (paramètre `name`) : `normalizeName` comparé dans l'API aux noms des Contacts non anonymisés (Archivés compris), sans nouvelle colonne ; 5 au plus, dernière Interaction la plus récente d'abord ; vide sans `name` ; tests contre Postgres, isolation comprise
- [ ] Lignes discrètes « Même nom : … » avec « Ouvrir sa fiche », qui ne bloquent pas l'ajout
- [ ] « Relire la page » ne remplit que les champs que l'Utilisateur n'a pas touchés ; lancé tout seul quand le nom n'a pas été lu, en attendant le bon profil, 10 s au plus
- [ ] Profil illisible (pas de nom lu, ou aucune `componentkey` portant le slug, au bout de 10 s) : formulaire avec l'URL seule, sans « Même nom », alerte discrète non bloquante au-dessus, « Relire la page » toujours là ; un Contact trouvé garde sa carte normale, sans message ; badge inchangé
- [ ] `console.warn("BattleCRM: unreadable profile, LinkedIn may have changed its layout")` ; rien n'est envoyé à l'API
- [ ] Tests : relecture partielle et profil illisible (`h2` retiré sur une fixture) ; axe
