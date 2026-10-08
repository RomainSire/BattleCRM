# 41: Palette de commandes et raccourcis

**What to build:** `Ctrl K` ou `/` ouvre la palette : sans saisie, les Contacts à traiter et les Alliés à relancer ; pendant la frappe, des groupes (Contacts, Organisations, Actions, Créer, Aller à, Préférences) ; un Contact se choisit puis ses actions s'affichent, ou l'Utilisateur tape un verbe (« relancer jul »). Les raccourcis `G` + lettre et l'aide `?` complètent la navigation au clavier ; sur mobile, la loupe de l'en-tête ouvre la même palette. Sources : spec UX §3.3, §3.2 ; ST-63, ST-65.

**Blocked by:** 30, 36

**Status:** ready-for-agent

- [ ] Palette (Autocomplete React Aria) en fenêtre centrée, recherche en mémoire sur le résumé ; « Rechercher… » de la navigation l'ouvre
- [ ] Sans saisie : à traiter et Alliés à relancer mêlés par ancienneté du retard
- [ ] Contact d'abord : `→` ou `Tab` affiche ses actions filtrées par son État (liste de la spec UX §3.3, jamais le verbe de l'État actuel) ; `⌫` dans le champ vide revient ; `Entrée` ouvre la fiche en page ; sans résultat, propose d'ajouter ce nom
- [ ] Verbe d'abord : un mot du verbe suffit (« nouvelles », « cercle », « entrer », « archiver », « vivier »…)
- [ ] `G` puis `A` `E` `C` `F` `B` `P` `I` `R` avec repère « G … » affiché ; `?` ouvre l'aide des raccourcis ; jamais dans un champ de saisie ; respect de « Raccourcis à une touche »
- [ ] Tests de composant au clavier ; axe sans erreur dans les deux thèmes
