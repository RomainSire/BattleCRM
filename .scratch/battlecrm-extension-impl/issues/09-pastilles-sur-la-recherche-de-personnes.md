# 09: Pastilles sur la recherche de personnes

**What to build:** sur une recherche de personnes LinkedIn, chaque résultat déjà Contact porte, juste après son nom, une pastille avec le logo « B » et son État (★ pour un Allié). Un clic ouvre sa fiche dans l'app, dans un nouvel onglet. Les pastilles suivent la pagination sans rechargement et ne sont jamais posées deux fois. Si aucun résultat n'est repéré, la sidebar ouverte sur cette page dit « BattleCRM n'a repéré aucun résultat sur cette page : LinkedIn a peut-être changé sa présentation. ». Sources : [spec extension](../../battlecrm-extension/spec.md) §3, §5, §6, §7 ; ST-101, ST-106.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Lecture d'une recherche sur un `Document` : chaque `role="listitem"` porteur d'un lien `/in/`, identifié par son URL normalisée ; lien du nom = le lien `/in/` de la ligne du nom (un `p`), pas le premier lien du résultat ; résultats attendus ajoutés à `expected.json` pour les deux pages ; cas « `listitem` vidés » (illisible)
- [ ] `MutationObserver` avec debounce ; un appel `POST /contacts/presence` par lecture (lots de 50) ; chaque résultat marqué avant la vérification par lot, jamais deux pastilles
- [ ] Pastille en ligne avant le degré « · 2e », DOM natif en racine d'ombre, couleurs selon le fond mesuré, libellé lisible
- [ ] Recherche illisible : rien dans la page, badge inchangé, message dans la sidebar, `console.warn`
- [ ] Tests Firefox sur les deux pages anonymisées
