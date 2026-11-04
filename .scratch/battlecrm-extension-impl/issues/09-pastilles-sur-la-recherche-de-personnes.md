# 09: Pastilles sur la recherche de personnes

**What to build:** sur une recherche de personnes LinkedIn, chaque résultat déjà Contact porte, juste après son nom, une pastille avec le logo « B » et son État (★ pour un Allié). Un clic ouvre sa fiche dans l'app, dans un nouvel onglet. Les pastilles suivent la pagination sans rechargement et ne sont jamais posées deux fois. Si aucun résultat n'est repéré, la sidebar ouverte sur cette page dit « BattleCRM n'a repéré aucun résultat sur cette page : LinkedIn a peut-être changé sa présentation. ». Sources : [spec extension](../../battlecrm-extension/spec.md) §3, §5, §6, §7 ; ST-101, ST-106.

**Blocked by:** 05

**Status:** resolved

- [x] Lecture d'une recherche sur un `Document` : chaque `role="listitem"` porteur d'un lien `/in/`, identifié par son URL normalisée ; lien du nom = le lien `/in/` de la ligne du nom (un `p`), pas le premier lien du résultat ; résultats attendus ajoutés à `expected.json` pour les deux pages ; cas « `listitem` vidés » (illisible)
- [x] `MutationObserver` avec debounce ; un appel `POST /contacts/presence` par lecture (lots de 50) ; chaque résultat marqué avant la vérification par lot, jamais deux pastilles
- [x] Pastille en ligne avant le degré « · 2e », DOM natif en racine d'ombre, couleurs selon le fond mesuré, libellé lisible
- [x] Recherche illisible : rien dans la page, badge inchangé, message dans la sidebar, `console.warn`
- [x] Tests Firefox sur les deux pages anonymisées

## Comments

**2026-11-04, implémentation (agent).**

- Lecture (`apps/extension/src/linkedin/search.ts`) : `readSearch(page)` rend chaque `role="listitem"` porteur d'un lien `/in/`, identifié par l'URL normalisée de son premier lien `/in/` ; lien du nom = le lien `/in/` avec un texte, dans un `p`, qui mène au même profil (ni la photo, ni les relations en commun). `isSearchPage(url)` : `/search/results/people`. `searchShown` attend des résultats 10 s au plus. Résultats attendus ajoutés à `expected.json` pour les deux pages.
- Attente commune : `wait.ts` (`shownWithin`), qui sert aussi à `profileShown`. Apparence commune : `mark.ts` (logo, couleurs selon le fond mesuré, État en mots), utilisé par l'élément après le nom et par la pastille.
- Pastilles (`search-pills.ts`, `createSearchWatch`) : `MutationObserver` (nœuds et `href`, LinkedIn pouvant montrer un autre membre dans le nœud d'un résultat) avec debounce de 300 ms, lu de toute façon après 4 debounces si la page ne se calme jamais. Chaque résultat est marqué (`data-battlecrm-result` = son URL) avant la vérification ; un seul message `searchPresence` par lecture, découpé par le background en lots de 50 (`PRESENCE_MAX_URLS`). Pastille en ligne juste après le lien du nom, avant « • 2e », racine d'ombre, lien vers `/contacts/<id>` dans un nouvel onglet, libellé « BattleCRM : Allié »… (★ masqué aux lecteurs d'écran). Une pastille retirée par un nouveau rendu de LinkedIn est remise sans redemander. Sans session, API en erreur, `426` ou background muet : pas de pastille, les résultats redemandés à la lecture suivante. Chaque nouvelle adresse (page suivante, filtre) repart de zéro.
- Recherche illisible : aucun résultat au bout de 10 s → `console.warn("BattleCRM: unreadable search, LinkedIn may have changed its layout")`, rien dans la page, rien à l'API, badge inchangé. Sidebar : message `readSearch` (background → content script, redemandé tant que la page charge) → « BattleCRM n'a repéré aucun résultat sur cette page : LinkedIn a peut-être changé sa présentation. » (`<output>`), sinon l'écran « Ailleurs ». Libellé `extension_unreadable_search` (fr, en).
- Tests : lecture sur les deux pages et `listitem` vidés (Firefox) ; pastilles (place, lien, ★, un seul appel, debounce, lectures concurrentes, page suivante, nœud réutilisé, pastille retirée, échecs, hors recherche, avertissement, contraste clair et sombre) ; background (lots de 50, badge inchangé, erreurs, `readSearch`) ; sidebar (lisible, illisible, inconnu, page suivante) ; axe sur la recherche illisible, deux thèmes.
- Pas de migration.
- Limite connue : contrairement au profil (garde-fou du slug), la recherche n'a pas de garde-fou contre le DOM de la page précédente pendant un `pushState` ; si cette page-là avait des `listitem` avec des liens `/in/`, la recherche serait jugée lisible trop tôt (rien de faux n'est posé : les pastilles suivent le DOM réel).
- Suggéré, jamais obligatoire : dans un vrai Firefox, une recherche de personnes avec un Contact connu, puis « Suivant » (recette §12).
