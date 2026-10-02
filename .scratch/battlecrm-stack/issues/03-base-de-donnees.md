# Base de données : SQLite ou Postgres

Type: research
Status: resolved
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

## Comments

- Recherche disponible sur la branche `research/03-base-de-donnees`, fichier `.scratch/battlecrm-stack/research/03-base-de-donnees.md` (`git show research/03-base-de-donnees:.scratch/battlecrm-stack/research/03-base-de-donnees.md`).

## Answer

Détail et sources : la recherche ci-dessus. Faits établis, sur lesquels s'appuiera « Base de données et accès aux données » :

- **Recommandation : PostgreSQL 18** dans son propre conteneur, image épinglée sur la majeure (`postgres:18`, jamais `latest` : Watchtower casserait les données à la majeure suivante). **SQLite reste défendable** (plus léger, rien à opérer) si le backend s'y prête mieux, avec des réglages obligatoires (`STRICT`, `foreign_keys=ON`, `busy_timeout`, `BEGIN IMMEDIATE`).
- **Fuseaux** (ST-40, ST-41) : Postgres connaît les fuseaux IANA, SQLite non. Quelle que soit la base, calculer le jour local à l'écriture et le stocker (cohérent avec ADR 0003).
- **Isolation** (ST-23) : RLS Postgres en garde-fou en plus du filtre applicatif (rôle applicatif non propriétaire, contexte Utilisateur posé par transaction) ; à confronter à l'ORM retenu.
- **Unicité normalisée** (ST-30) : normaliser dans le code, partagé avec le front (ST-64), stocker dans une colonne dédiée sous index unique simple ; ni collation ICU ni `unaccent` dans l'index.
- **« Au plus un »** (Essai en cours, Relance planifiée, Battle ouverte) : index uniques partiels, dans les deux bases ; Tirage et Horizon demandent en plus un verrou sur la ligne de la Battle.
- **Anonymisation** (ST-38) : aucune base ne nettoie une sauvegarde déjà faite : ST-38 repose sur une rétention bornée des sauvegardes.
- **Sauvegardes** : `pg_dump` quotidien avec essai de restauration documenté ; les instantanés hebdomadaires de l'hébergeur ne suffiront pas pour ouvrir les inscriptions.
- **Coût** : ~100 Mo par défaut (documenté, non mesuré : à confirmer par « Relevé du VPS »), une majeure manuelle tous les quelques ans.
