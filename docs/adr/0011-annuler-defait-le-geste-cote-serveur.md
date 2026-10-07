# « Annuler » défait le geste côté serveur, sans trace comptée

Un geste (utiliser un Positionnement, changer d'État, supprimer une Étape…) s'enregistre tout de suite côté serveur, et « Annuler juste après coup » (ST-62) le défait par une transaction inverse : ce que le geste a créé est **supprimé** (Interaction, Essai, changement d'État), ce qu'il a modifié est **restauré**, de sorte qu'un changement annulé ne laisse aucune trace comptée (ST-39). Chaque geste renvoie un jeton d'annulation ; une table `gesture` retient ce qu'il faut défaire, et chaque module écrit l'inverse de ses propres gestes, à côté du geste. Retarder l'envoi côté client jusqu'à la fin du toast aurait été plus simple, mais un onglet fermé aurait perdu le geste, un autre appareil ne l'aurait pas vu, et « Utiliser un Positionnement » révèle de toute façon le Tirage côté serveur.

## Conséquences

- **Le Tirage révélé survit à l'annulation** (ADR 0002) : sinon annuler permettrait de tirer à nouveau.
- Le serveur accepte l'annulation pendant 15 minutes (le toast se met en pause au survol ou au focus, sans limite), puis la refuse ; il la refuse aussi si un geste ultérieur a touché le même Contact ou la même Battle.
- Une célébration déjà affichée (ST-44) n'est pas défaite ; l'Activité, calculée depuis les Interactions, suit d'elle-même.
- Tout nouveau geste doit fournir son inverse : un geste sans inverse n'est pas annulable, et l'UX doit le savoir.
