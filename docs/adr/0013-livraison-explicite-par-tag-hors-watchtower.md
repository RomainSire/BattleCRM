# Livraison explicite par tag, hors Watchtower

Seul un tag SemVer `v*` posé sur un commit de `main` livre BattleCRM : le workflow rejoue la CI, construit les images au numéro de version, puis appelle en SSH un script de déploiement verrouillé par une commande forcée, qui passe les migrations, redémarre l'app, attend sa santé et revient au tag précédent si elle échoue. Tous les conteneurs de BattleCRM, Postgres compris, portent `com.centurylinklabs.watchtower.enable=false`, alors que le reste du VPS suit Watchtower chaque nuit. Laisser Watchtower livrer des images `:latest` aurait été moins de code, mais il redémarre la base à 4 h sans prévenir, livre des images sans passer par la CI ni par les migrations, et ne sait pas revenir en arrière ; livrer à chaque push sur `main` aurait interdit de pousser du travail qui n'est pas prêt à partir.

## Consequences

- Un push sur `main` sans tag ne livre rien ; la version vient du `package.json` racine (`pnpm version`).
- Les mises à jour de `postgres` (épinglé sur une mineure) et des images de base arrivent par des PR Dependabot, puis par une release comme le reste.
- Le retour arrière ne touche que les images : chaque migration et chaque changement d'endpoint doivent rester compatibles avec la version précédente (ajouter d'abord, retirer une version plus tard).
