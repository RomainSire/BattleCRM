# Déploiement

Type: grilling
Status: resolved
Blocked by: 05, 06, 07

## Question

Comment l'app est-elle construite, livrée et configurée sur le VPS ?

À trancher :
- Images (une ou plusieurs), conteneurs, réseau Traefik ; migrations au déploiement. Trois apps à servir : la SPA, l'API Hono et la landing page Astro statique (« [Forme de l'app et langages](06-forme-app-langages.md) »).
- Adresses : préférence de Romain, landing sur `battlecrm.romainsire.com`, app sur `app.battlecrm.romainsire.com`, API sur la même origine sous `/api` ; passage possible plus tard à un domaine dédié par la seule configuration.
- Chaîne GitHub Actions → GHCR → VPS : déclenchement, Watchtower ou déploiement explicite, retour arrière.
- Configuration par variables d'environnement (dont l'ouverture des inscriptions) et secrets (SMTP Gmail).
- Budget mémoire sur le VPS au regard des autres apps : limites `mem_limit` par conteneur (il n'y a pas de swap).
- Watchtower : exclure chaque conteneur BattleCRM par label (Postgres compris), ou laisser Watchtower livrer l'app.
- Accès SSH d'Actions : clé verrouillée par une commande forcée (`restrict,command=…`) ou utilisateur dédié, plutôt qu'un compte personnel.
- En-têtes de sécurité et limitation de débit : à déclarer par labels Traefik, puisqu'aucun middleware global n'existe.
- Bascule depuis la V1 : la supprimer (conteneurs, volume `battlecrm_pgdata`, `/opt/docker/battlecrm`) et reprendre `battlecrm.romainsire.com`.

- Migrations : point d'entrée `migrate` séparé, même image, identifiants du rôle **propriétaire** ; l'API n'a que ceux du rôle applicatif (« [Base de données et accès aux données](07-donnees.md) », ADR 0009). Comment l'enchaîner avant l'API, et où vivent les deux jeux d'identifiants.

Faits du VPS : voir « [Relevé du VPS](05-releve-vps.md) ».

- Auth (« [Auth : bibliothèque, sessions et client extension](08-auth.md) ») : `SIGNUPS_OPEN` (fermé par défaut) ; Traefik doit transmettre `X-Forwarded-For` et l'API déclarer `trustedProxies`, sinon la limitation par IP met tout le monde dans un seau partagé ; un seul conteneur d'API (le planificateur tourne en processus, sans verrou distribué) ; dumps chiffrés.

- Pièces jointes des Positionnements (ST-35), renvoyées par « [Architecture : où vivent les règles du domaine](09-architecture.md) » : stockage (volume Docker monté dans l'API, servi par une route qui vérifie le propriétaire), taille maximale, sauvegarde avec la base.

## Answer

Tranché avec Romain le 2026-10-07 ; ADR [0013 Livraison explicite par tag, hors Watchtower](../../../docs/adr/0013-livraison-explicite-par-tag-hors-watchtower.md).

- **Images** : deux, publiques sur GHCR (le dépôt est public, il sert aussi de vitrine), en `linux/amd64` seul :
  - `api` : `node:24-alpine`, construite en plusieurs étapes avec `pnpm deploy --prod` ; porte aussi le point d'entrée `migrate` ;
  - `web` : nginx non privilégié, sert la SPA et la landing selon l'hôte ; la landing reste en ligne quand l'API redémarre.
- **Conteneurs** (`/opt/docker/battlecrm/docker-compose.prod.yml`) : `web`, `api`, `postgres` (`postgres:18.x`, épinglé sur une mineure, montée par PR Dependabot), `migrate` (ponctuel). **Tous** exclus de Watchtower par label. Une seule instance d'API (planificateur sans verrou) : un déploiement coupe l'API quelques secondes, la SPA vit sur sa copie locale pendant ce temps (ADR 0004).
- **Adresses** : landing sur `battlecrm.romainsire.com`, SPA sur `app.battlecrm.romainsire.com`, API sous `/api` du même hôte ; Traefik route `Host(app…) && PathPrefix(/api)` vers `api` (priorité haute), le reste vers `web` ; `/api` reste dans Hono (`basePath`), sans `StripPrefix`, pour que le proxy de Vite voie les mêmes chemins en dev. Pas de `www`. Hôtes lus dans l'environnement (`APP_HOST`, `SITE_HOST`) : un domaine dédié ne change que la configuration.
- **Livraison** : un push sur `main` lance la CI (lint, types, tests) et ne livre rien. Un tag SemVer `v*`, posé par `pnpm version` (version unique, `package.json` racine), lance le workflow `release` :
  1. refuse un tag qui ne pointe pas sur un commit de `main`, rejoue la CI ;
  2. construit et pousse les images, étiquetées `1.2.3` et `sha-<court>` ;
  3. lance `deploy.sh v1.2.3` en SSH ;
  4. crée la GitHub Release avec les notes générées.
  Retour arrière manuel : `workflow_dispatch` avec un tag existant.
- **`deploy.sh <tag>`** : `docker compose run --rm migrate` (un échec arrête tout, l'ancienne API tourne encore), `up -d`, attente du healthcheck `/api/health` ; en cas d'échec, retour automatique au tag précédent, noté dans `deployed_tag`. Vérifier à l'implémentation que `pnpm version` crée bien le tag préfixé `v` dans le workspace.
- **Compatibilité** : le retour arrière ne défait que les images. Toute migration et tout changement d'endpoint restent compatibles avec la version précédente (expand/contract : ajouter d'abord, retirer une version plus tard) ; règle de revue.
- **Décalage SPA / API** : l'API renvoie `X-App-Version` ; quand la SPA voit une autre version que la sienne, elle demande au service worker de se mettre à jour (`registration.update()`), le nouveau télécharge le front en arrière-plan, puis « Nouvelle version disponible, recharger » appelle `updateSW(true)` (`skipWaiting` + rechargement). Jamais forcé ; un panneau ouvert survit (ST-70). Un simple `F5` ne suffirait pas tant que l'ancien service worker contrôle l'onglet.
- **SSH d'Actions** : utilisateur dédié `battlecrm-deploy`, dans le groupe `docker`, sans sudo ; sa clé est verrouillée par `restrict,command="/opt/docker/battlecrm/deploy.sh"`, le script valide le tag lu dans `SSH_ORIGINAL_COMMAND` (`^v\d+\.\d+\.\d+$`). Les secrets GitHub ne portent que la clé et l'hôte ; aucun jeton GHCR (images publiques).
- **Configuration et secrets** : écrits à la main sur le VPS, droits 600, jamais dans GitHub ; un fichier par service, chargé par `env_file`, pour que l'API ne voie jamais le mot de passe du propriétaire :
  - `postgres.env` : superutilisateur ;
  - `migrate.env` : rôle propriétaire ;
  - `api.env` : rôle applicatif, `BETTER_AUTH_SECRET`, SMTP Gmail, `SIGNUPS_OPEN=false`, hôtes.
  Rôles propriétaire (`NOSUPERUSER`) et applicatif créés par un script `docker-entrypoint-initdb.d`. Configuration validée par Zod au démarrage (refus de démarrer si elle manque) ; un `.env.example` versionné par fichier.
- **Mémoire** (`mem_limit`, sans swap) : `api` 384 Mio (`--max-old-space-size=256`), `postgres` 512 Mio (`shared_buffers=128MB`, `max_connections=20`), `web` 64 Mio, `migrate` 256 Mio ; environ 1 Gio au pire, à revoir après une semaine de `docker stats`.
- **En-têtes et débit** : les en-têtes vivent avec le code. nginx (configuration versionnée) pose HSTS, CSP stricte, `nosniff`, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy` ; Hono `secureHeaders` pour `/api`. Traefik ne porte qu'un ratelimit grossier par IP sur `/api`, en filet ; la limitation fine reste celle de Better Auth en base. Traefik, en bordure, écrase les `X-Forwarded-*` des clients non fiables ; l'API n'accepte `X-Forwarded-For` que depuis `traefik-public` (`trustedProxies`).
- **Pièces jointes (ST-35)** : dans Postgres, `bytea` dans une table à part (`attachment_blob`), sous RLS ; 5 Mio par fichier, quota de 100 Mio par Utilisateur ; tous types acceptés, toujours servis en `Content-Disposition: attachment` avec `nosniff`, par une route qui lit sous `withUser`. Derrière une interface de stockage du module `funnel` (`put`, `get`, `delete`). Elles suivent ainsi la base dans le même dump et dans les mêmes transactions (« Annuler », ADR 0011). Écarté pour l'instant : un S3 auto-hébergé (Garage), qui ajouterait un conteneur, une seconde sauvegarde et la cohérence entre deux systèmes, sans gain mesurable à cette échelle ; l'interface en garde la porte ouverte.
- **Réglages du compose** : journaux `json-file` (`max-size: 10m`, `max-file: 3`), `restart: unless-stopped`, Postgres sur le seul réseau interne sans port publié, `web` et `api` non root avec système de fichiers en lecture seule où c'est possible, `postgresql.conf` versionné et monté.
- **Bascule** : la V1 (un POC) est supprimée sans dump ni archive : conteneurs, volume `battlecrm_pgdata`, `/opt/docker/battlecrm` ; l'ancienne clé de déploiement est retirée ; la V2 s'installe au même endroit. Créer l'entrée DNS de `app.battlecrm.romainsire.com` si elle manque.
