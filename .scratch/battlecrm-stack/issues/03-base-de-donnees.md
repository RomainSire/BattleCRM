# Base de données : SQLite ou Postgres

Type: research
Status: open
Blocked by:

## Question

Pour BattleCRM (quelques Utilisateurs, quelques centaines de Contacts chacun, un VPS sans base partagée), SQLite ou Postgres ?

À couvrir :
- Unicité par Utilisateur du nom d'Organisation normalisé (casse, accents, espaces) et de l'URL LinkedIn normalisée (ST-30) : collations, `unaccent`, colonnes générées, index uniques.
- Agrégats de l'Activité par jour dans le fuseau en vigueur de chaque jour (ST-40, ST-41, ST-42) et Taux de passage (ST-43) : calcul en base ou applicatif.
- Isolation stricte par Utilisateur (ST-23) : Row Level Security ou filtre applicatif, ce que chaque option permet.
- Intégrité du modèle par contraintes (au plus un Essai en cours, au plus une Relance planifiée, une Battle ouverte par Étape) : index partiels, transactions, concurrence.
- Anonymisation définitive (ST-38, ADR 0006) et sauvegardes : WAL, sauvegarde à chaud, restauration, rétention.
- Exploitation en conteneur sur le VPS : mémoire, mises à jour majeures, maintenance.

Livrable : `.scratch/battlecrm-stack/research/03-base-de-donnees.md`, avec sources primaires et une recommandation.
