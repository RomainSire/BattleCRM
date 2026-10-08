# 33: Funnel en kanban

**What to build:** l'écran Funnel en kanban : une colonne par Étape non archivée, avec la Battle ouverte en en-tête, et dans chaque colonne les Contacts En prospection rangés en lignes À traiter, En attente, Sans prochaine action. L'Utilisateur change un Contact d'Étape en le glissant (souris ou clavier), ou d'État en le déposant sur les zones Vivier, Cercle et Archivé, et agit depuis la carte. Sources : spec UX §5.2 ; CONTEXT (À traiter, En attente, Sans prochaine action) ; prototype `prototype/03-vue-funnel` (C), qui ne fait pas foi sur les États ; ST-61, ST-67.

**Blocked by:** 30

**Status:** ready-for-agent

- [ ] `contactAgenda(contact, today)` dans `packages/domain` (si pas déjà là) : À traiter / En attente / Sans prochaine action, avec le tri par urgence de la spec UX §5.2 ; « today » calculé avec le fuseau en vigueur du résumé, pas celui de l'appareil
- [ ] En-tête : nom, But, nombre de Contacts, Battle ouverte (Champion vs Challenger, Essais sur l'Horizon) ; menu Renommer et « Gérer les Étapes… »
- [ ] Carte : nom, Organisation, Cible, prochaine action, raccourcis d'action, menu `⋯` (Changer d'Étape…, Remettre au Vivier…, Ajouter au Cercle…, Archiver…, Changer d'État…, ouvrir la fiche en panneau non modal)
- [ ] Glisser-déposer sur GridList + `useDragAndDrop` de React Aria, clavier compris, annoncé ; dépôt → fenêtre de conséquences (ticket 30) ou de changement d'État (ticket 19) ; pas de glisser tactile ; `E`, `S`, flèches sur une carte
- [ ] Vérifié tôt : le kanban sur React Aria tient ST-61 et ST-62, sinon repli shadcn base Base UI (spec stack §15)
- [ ] Filtres : nom ou Organisation, Cible, Battle, Organisation, signal ; aucun indicateur ; défilement horizontal en largeur étroite
- [ ] axe sans erreur dans les deux thèmes ; parcours clavier testé en composant
