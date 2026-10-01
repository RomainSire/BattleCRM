# L'historique conserve les valeurs en vigueur au moment des faits

Trois lectures du passé dépendent de réglages que l'Utilisateur peut changer : le sens avant ou arrière d'un changement d'Étape et le Taux de passage (ordre du Funnel), l'Activité d'un jour (fuseau horaire) et l'Objectif d'activité de ce jour. Nous conservons chaque valeur telle qu'elle était au moment des faits, plutôt que de recalculer le passé avec les réglages actuels : réordonner le Funnel, changer de fuseau ou d'Objectif ne réécrit jamais l'historique, et un changement de fuseau ou d'Objectif ne s'applique qu'à partir du lendemain. Recalculer aurait été plus simple, mais un réordonnancement aurait transformé des avancées en reculs, et un changement de fuseau aurait déplacé des Actions de prospection d'un jour à l'autre.

## Conséquences

- Chaque changement d'Étape retient la position relative des deux Étapes dans le Funnel du moment ; le fuseau et l'Objectif de l'Utilisateur sont conservés jour par jour.
- Une valeur qui n'a pas été conservée dès le premier jour ne peut plus être reconstituée.
