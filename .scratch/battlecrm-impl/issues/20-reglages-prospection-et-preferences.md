# 20: Réglages : Prospection et Préférences

**What to build:** l'écran Réglages, avec ses ancres, où l'Utilisateur règle son Objectif d'activité (dès le lendemain), son Objectif d'entrées (dès le lundi suivant), la Cadence par défaut, le Rythme des Alliés, la Taille visée du Cercle, la célébration, sa langue, son fuseau (dès le lendemain), le thème de l'appareil et les raccourcis à une touche. Enregistrement automatique avec « Annuler », sauf la Cadence par défaut. Sources : spec UX §5.8 (sauf la section Funnel, ticket 35), §3.3 ; spec stack §5.2 ; ADR 0003 ; ST-40, ST-42, ST-49 à ST-58.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Module `settings` : valeurs en vigueur `(user_id, effective_from, value)` pour le fuseau, l'Objectif d'activité, l'Objectif d'entrées (« aucun objectif » compris) ; `activityGoalOn(tx, date)`, `entryGoalForWeek(tx, monday)`, écritures « à partir du lendemain / du lundi suivant », testées aux changements d'heure et à minuit
- [ ] Préférences par Utilisateur portées par le résumé : langue, célébration (grisée quand l'Objectif est désactivé), raccourcis à une touche, Rythme des Alliés (28 j), Taille visée (10, désactivable), Cadence par défaut (intervalles et Délai de réponse, sans message, bouton « Enregistrer »)
- [ ] Microcopie « S'applique à partir de demain » / « S'applique à partir du lundi 12 oct. »
- [ ] Préférences par appareil : thème ; « Réduire les animations » suit le système sans réglage
- [ ] « Raccourcis à une touche » coupe `N`, `/`, `?`, `G` + lettre et `V` ; `Ctrl K` et `Échap` restent actifs
- [ ] Changer de langue change l'interface et `lang` ; mobile (Plus) : langue, thème, célébration, Compte
- [ ] Chaque enregistrement automatique est annulable (test nominal + Annuler)
