# 37: Aujourd'hui : ce qui est à traiter

**What to build:** l'écran Aujourd'hui sur bureau montre, dans une seule liste triée par ancienneté du retard, les Relances du jour ou en retard et les Alliés à relancer, puis les Essais délai dépassé, avec leurs actions directes ; la navigation porte la pastille ambre « 3 à traiter, 2 Alliés à relancer ». Le bandeau Entrées et les tirages du jour arrivent au ticket 38, l'Activité au ticket 39. Sources : spec UX §5.1, §3.1 (pastilles) ; prototypes `prototype/01-aujourdhui` (B) et `prototype/03-page-cercle` (C) ; ST-46.

**Blocked by:** 29, 36

**Status:** ready-for-agent

- [ ] Calculé localement depuis le résumé par `contactAgenda` et `allySignal`, avec le fuseau en vigueur ; ligne d'un Allié marquée « Allié », « Rythme dépassé (n j) · n j sans contact »
- [ ] Actions directes : Relance (Relancer…, Reporter, Annuler, A répondu…) ; Essai délai dépassé (Sans suite, Relancer quand même) ; Allié (Prendre des nouvelles…) ; lien vers la fiche en panneau
- [ ] Colonne latérale : « Cercle 7/10 » avec lien, « À venir » (Relances de demain)
- [ ] Pastille ambre sur Aujourd'hui (nombre seul ; infobulle et libellé accessible « 3 à traiter, 2 Alliés à relancer ») ; aucune pastille sur Cercle
- [ ] États vides : premier jour (« Aucun Contact pour l'instant », les Étapes types, « Ajouter un Contact » `N`) ; rien de prévu
- [ ] Écran d'arrivée après la connexion ; axe sans erreur dans les deux thèmes
