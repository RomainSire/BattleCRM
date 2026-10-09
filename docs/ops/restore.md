# Restaurer la base

Les sauvegardes sont les dumps nocturnes de `backup.sh` (spec stack §12) : `/opt/docker/battlecrm/backups/battlecrm-<date UTC>.dump`, au format `pg_dump -Fc`, 30 jours. Toutes les commandes se lancent en root sur le VPS, dans `/opt/docker/battlecrm`.

Le dump contient les tables, leurs droits et la RLS, pas les rôles : `battlecrm_owner` et `battlecrm_app` existent déjà, créés au premier démarrage de Postgres par `postgres/initdb/01-roles.sh`.

## Vérifier un dump sans toucher à la prod

À faire après l'installation, puis de temps en temps : une restauration jamais essayée n'est pas une sauvegarde.

```sh
cd /opt/docker/battlecrm
dump=$(ls -1 backups/battlecrm-*.dump | tail -n 1)
docker exec battlecrm-postgres createdb -U postgres -O battlecrm_owner battlecrm_restore_check
docker exec -i battlecrm-postgres pg_restore -U postgres -d battlecrm_restore_check --exit-on-error <"$dump"
# Les migrations appliquées, et le nombre de lignes des tables de son choix :
docker exec battlecrm-postgres psql -U postgres -d battlecrm_restore_check \
  -c 'SELECT count(*) FROM drizzle.__drizzle_migrations'
docker exec battlecrm-postgres dropdb -U postgres battlecrm_restore_check
```

## Remplacer la base de prod par un dump

Tout ce qui a été écrit depuis le dump est perdu (au plus 24 h). La landing et la SPA restent servies ; la SPA passe en consultation seule tant que l'API est arrêtée (ADR 0004).

1. Choisir le dump :

   ```sh
   cd /opt/docker/battlecrm
   ls -l backups/
   dump=backups/battlecrm-AAAAMMJJTHHMMSSZ.dump
   ```

2. Arrêter l'API, pour qu'aucune connexion ne tienne la base :

   ```sh
   docker stop battlecrm-api-1
   ```

3. Recréer une base vide qui appartient au propriétaire, puis y restaurer le dump, en superutilisateur :

   ```sh
   docker exec battlecrm-postgres dropdb -U postgres --force battlecrm
   docker exec battlecrm-postgres createdb -U postgres -O battlecrm_owner battlecrm
   docker exec -i battlecrm-postgres pg_restore -U postgres -d battlecrm --exit-on-error <"$dump"
   ```

4. Redémarrer l'API et vérifier sa santé (200, avec la version livrée) :

   ```sh
   docker start battlecrm-api-1
   docker exec battlecrm-api-1 wget -q -O - http://127.0.0.1:3000/api/health
   ```

Si l'API répond 503, le dump date d'avant une migration de la version livrée : `./deploy.sh "$(cat deployed_tag)"` la repasse.

## VPS perdu

Les dumps sont sur le VPS : s'il est perdu, la base revient de l'instantané hebdomadaire de l'hébergeur (une semaine de perte au plus, spec stack §12). Sur un VPS réinstallé, suivre [l'installation](install.md) jusqu'à la première livraison, puis la section précédente avec un dump repris de l'instantané.
