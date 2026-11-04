# 08: Même nom, « Relire la page » et profil illisible

**What to build:** le formulaire d'ajout signale sans bloquer les Contacts qui portent le même nom (« Même nom : Jean Dupont · Capgemini », « Ouvrir sa fiche »). « Relire la page » relit le profil et ne remplit que les champs non touchés, par exemple après avoir ouvert « Coordonnées ». Quand le nom n'a pas été lu, la relecture se lance toute seule ; si le profil reste illisible, le formulaire s'affiche quand même, URL remplie, avec l'alerte « BattleCRM n'a pas pu lire ce profil… ». Sources : [spec extension](../../battlecrm-extension/spec.md) §4, §7, §8, §13 (A8), §16 ; ST-96, ST-102.

**Blocked by:** 07

**Status:** resolved

- [x] `sameName` dans `GET /contacts/linkedin-profile` (paramètre `name`) : `normalizeName` comparé dans l'API aux noms des Contacts non anonymisés (Archivés compris), sans nouvelle colonne ; 5 au plus, dernière Interaction la plus récente d'abord ; vide sans `name` ; tests contre Postgres, isolation comprise
- [x] Lignes discrètes « Même nom : … » avec « Ouvrir sa fiche », qui ne bloquent pas l'ajout
- [x] « Relire la page » ne remplit que les champs que l'Utilisateur n'a pas touchés ; lancé tout seul quand le nom n'a pas été lu, en attendant le bon profil, 10 s au plus
- [x] Profil illisible (pas de nom lu, ou aucune `componentkey` portant le slug, au bout de 10 s) : formulaire avec l'URL seule, sans « Même nom », alerte discrète non bloquante au-dessus, « Relire la page » toujours là ; un Contact trouvé garde sa carte normale, sans message ; badge inchangé
- [x] `console.warn("BattleCRM: unreadable profile, LinkedIn may have changed its layout")` ; rien n'est envoyé à l'API
- [x] Tests : relecture partielle et profil illisible (`h2` retiré sur une fixture) ; axe

## Comments

**2026-11-04, implémentation (agent).**

- API (`apps/api/src/views/index.ts`, `sameNameOf`) : `GET /contacts/linkedin-profile` accepte `name` ; pas un Contact → `sameName: [{ id, name, organizationName }]`. Noms des Contacts non anonymisés (Archivés compris) lus en entier et comparés en JS par `normalizeName`, sans nouvelle colonne ; triés par la dernière Interaction (de toute sorte, comme ST-96 le dit ; la carte, elle, compte la dernière Interaction faite), 5 au plus ; vide sans `name`. Tests contre Postgres : casse, accents, espaces, Archivé, supprimé, ordre, limite, autre Utilisateur.
- Content script : `profileShown` (l'ancienne attente `nameShown`, déplacée de `presence-element.ts` vers `profile.ts`) et `readProfileShown`, qui attend le bon profil 10 s au plus et rend `null` si l'onglet passe à un autre profil. Message `readProfile { url, wait }`.
- `console.warn("BattleCRM: unreadable profile, LinkedIn may have changed its layout")` : émis par la surveillance du profil (`presence-element.ts`) quand le nom du bon profil ne s'affiche pas en 10 s (pas de `h2`, ou aucune `componentkey` portant le slug), quelle que soit la réponse de `presence`, Contact trouvé compris. Elle attend donc aussi quand l'API est en erreur, pour pouvoir prévenir. Rien n'est envoyé à l'API.
- Background : `lookup { url, tabId, wait? }` lit l'onglet **d'abord**, puis appelle l'API avec le nom lu (`name` absent sans nom). L'onglet est donc lu aussi quand le profil est un Contact (lecture du DOM, sans coût réseau).
- Sidebar : le formulaire garde les champs que l'Utilisateur a modifiés (`Partial<Draft>`), le reste suit la dernière lecture : « Relire la page » (`lookup` avec `wait: true`) ne remplit que les champs non touchés. Relecture automatique, une fois, quand la première lecture n'a pas de nom. Alerte (`<output>`, annoncée, non bloquante) au-dessus du formulaire quand le nom reste illisible après la relecture ; « Relire la page » reste là. Lignes « Même nom : … · … » sous le nom, avec « Ouvrir sa fiche » (nouvel onglet). Un Contact trouvé garde sa carte, sans relecture ni alerte.
- Correctif (retour de Romain, sidebar ouverte, profil atteint par un chargement de page) : le formulaire restait vide, les deux lectures partaient avant que le content script de la nouvelle page existe. Le background redemande l'onglet toutes les 250 ms tant qu'aucun content script ne répond, dans les 10 s de la relecture (le message `readProfile` porte le temps qui reste, `timeoutMs`) ; le content script de la page qu'on quitte refuse au lieu de répondre « rien lu ». Vérifié par Romain dans Firefox le 2026-11-04 : le formulaire se remplit tout seul.
- Libellés `extension_same_name`, `extension_read_page_again`, `extension_unreadable_profile` (fr, en).
- Tests : API ; lecture qui attend le profil, `h2` retiré, onglet parti ; avertissement (`h2` retiré pour un Contact, un profil à ajouter, une API en erreur ; profil jamais affiché ; pas d'avertissement si l'adresse change ou si le profil s'affiche) ; background (nom envoyé, `wait`) ; sidebar (relecture partielle, relecture automatique, profil illisible, Contact trouvé, même nom) ; axe sur le formulaire avec « Même nom » et sur le profil illisible, deux thèmes.
- Pas de migration.
- Pour plus tard : une extension N face à une API N-1 (retour arrière accepté, spec §11) recevrait une réponse sans `sameName` et planterait sur le formulaire ; `?? []` dans le background le couvrirait si on le juge utile.
- Suggéré, jamais obligatoire : dans un vrai Firefox, ouvrir « Coordonnées » sur un profil qui n'est pas un Contact, puis « Relire la page » (recette §12, point 4).

