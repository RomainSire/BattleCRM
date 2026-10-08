# 42: Indicateurs

**What to build:** l'écran Indicateurs, sur une période choisie (30 jours, 3 mois, 12 mois, depuis le début) : chiffres d'effort en tête (Actions de la semaine et de la période, Essais terminés, Entrées de la semaine face à l'Objectif d'entrées, Taille du Cercle), graphe d'Activité sur 12 mois avec « Voir en tableau », tableau du Funnel avec Taux de passage, sorties par État et par Étape, Entrées par semaine. Sources : spec UX §5.7 ; CONTEXT (Taux de passage, Activité) ; ADR 0003 ; prototype `prototype/09-indicateurs` (B) ; ST-41, ST-43, ST-49.

**Blocked by:** 30, 20

**Status:** ready-for-agent

- [ ] Agrégats calculés par le module `views`, chargés à la demande (hors résumé), filtrés par période
- [ ] Activité : graphe journalier sur 12 mois (intensité seule, jour vide neutre, aucune marque d'Objectif), au survol ou au focus « 2 Actions · objectif du jour : 3 » (Objectif en vigueur ce jour-là), totaux hebdomadaires sans ligne d'objectif, « Voir en tableau », synthèse « 214 actions sur 12 mois »
- [ ] Funnel : vrai tableau des passages par Étape dans l'ordre actuel, Taux de passage depuis l'historique des changements d'Étape avec l'ordre d'alors (Étapes sautées comprises, Étapes précédant l'entrée exclues), Étapes archivées sur demande sans Taux
- [ ] Sorties par État (Allié, Vivier, Archivé) et par Étape ; Entrées par semaine avec la moyenne, survol « 6 entrées · objectif : 5 »
- [ ] Aucun taux en tête ni taux personnel ; rien porté par la couleur seule ; axe sans erreur dans les deux thèmes
- [ ] Tests des agrégats avec fuseau changé en cours de période
