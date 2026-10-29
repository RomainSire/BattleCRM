# Enregistrer des pages LinkedIn de référence

Type: task
Status: open
Blocked by:

## Question

Disposer de pages LinkedIn réelles, connecté, pour juger ce qui se scrape et pour servir de référence aux tests. Aucun agent ne peut les charger : Romain les enregistre.

Checklist (Firefox, « Enregistrer la page sous… » → **Page web, HTML seulement**, puis aussi **Page web complète** pour la première) dans `.private/linkedin/` :

- [ ] `profil-esn.html` : un ingénieur d'affaires d'ESN, expérience en cours visible.
- [ ] `profil-client.html` : une personne chez un client final.
- [ ] `profil-sans-experience.html` : un profil pauvre (pas d'expérience, ou une école seulement).
- [ ] `profil-hors-reseau.html` : un profil de 3e degré ou hors réseau (nom parfois masqué).
- [ ] `recherche-personnes.html` : une page de résultats `/search/results/people/` avec au moins un Contact déjà dans BattleCRM.
- [ ] `recherche-personnes-page2.html` : la page 2 de la même recherche, atteinte par la pagination (pas de rechargement).
- [ ] Noter dans `.private/linkedin/README.md` : date, langue de l'interface LinkedIn, et pour chaque profil ce que **toi** tu lis à l'écran (nom, poste, Organisation) : c'est la vérité de référence.

Aucun contenu de ces pages ne quitte `.private/`.
