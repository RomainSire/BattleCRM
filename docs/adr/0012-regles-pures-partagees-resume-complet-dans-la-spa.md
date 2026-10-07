# Règles pures partagées, résumé de travail complet dans la SPA

Les règles du domaine qui se calculent (Règle de victoire, choix du Tirage, états à traiter / en attente / sans prochaine action, signaux des Alliés, jour local, normalisation) vivent dans un paquet `packages/domain` sans aucune E/S, « maintenant » et fuseau passés en paramètre, importé par l'API **et** la SPA. La SPA tient le **résumé de travail complet** de l'Utilisateur (chaque Contact avec son État, son Étape, sa Relance planifiée, son Essai en cours et ses dernières dates d'Interaction, et chaque Organisation), chargé en une lecture et mis à jour par les lignes que renvoie chaque geste ; elle en tire la pastille, « Aujourd'hui », la palette, la recherche et la vérification des doublons sans aller-retour, et hors ligne (ADR 0004). L'API reste seule juge à l'écriture et appelle les mêmes fonctions. Des listes paginées et une recherche serveur auraient tenu à toute échelle, mais avec un aller-retour par frappe et un « Aujourd'hui » figé hors ligne ; à l'échelle visée (quelques collègues, quelques centaines de Contacts chacun), le résumé pèse quelques dizaines de Ko.

## Conséquences

- Les états du jour ne sont jamais stockés ; la SPA calcule « aujourd'hui » avec le fuseau en vigueur porté par le résumé, pas celui de l'appareil.
- La Règle de victoire se calcule de façon exacte et déterministe (pas de Monte-Carlo), pour que la jauge de la SPA et l'API donnent le même chiffre ; seul le hasard du Tirage reste côté API.
- Monter au-delà de quelques milliers de Contacts par Utilisateur obligerait à revenir sur ce choix.
