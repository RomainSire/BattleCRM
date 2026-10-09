# 02: API, base et isolation

**What to build:** une API Hono qui démarre contre un Postgres 18 local, migrée par son point d'entrée `migrate` sous le rôle propriétaire, et qui répond `GET /api/health`. Toute requête métier future passe par `withUser`, et la RLS est prouvée par un test. C'est aussi le harnais de test de toutes les tranches suivantes. Sources : spec stack §5, §6, §11, §13 ; ADR 0009, 0011.

**Blocked by:** 01

**Status:** resolved

- [x] Hono sous `/api`, Node 24 LTS ; config validée par Zod au démarrage (refus de démarrer si elle manque) ; `node --watch` en dev, bundle tsdown en prod (`main` et `migrate`)
- [x] Racine de composition `createApp({ clock, random, email, hibp, config, alert })` : horloge pilotable et hasard scriptable en test
- [x] Postgres 18 via un compose de dev ; script d'init qui crée le rôle propriétaire (`NOSUPERUSER`) et le rôle applicatif ; `migrate` applique les migrations Drizzle sous le propriétaire
- [x] Module `db` : `withUser(userId, fn)` (transaction + `set_config('app.user_id', …, true)`) et `withoutIsolation` réservé à `auth` et `migrate` (lint) ; aucun `schema` passé à `drizzle()`
- [x] Une table de démonstration (ou la première table métier réelle) prouve la RLS forcée : une requête sans filtre sous `withUser` ne voit que les lignes de son Utilisateur
- [x] Harnais de test : une base par exécution migrée par le vrai `migrate`, connexion sous le rôle applicatif, test de garde qui refuse superutilisateur et `BYPASSRLS` ; `services: postgres` en CI ; dérive Drizzle bloquante et migrations rejouées depuis zéro
- [x] `GET /api/health` public : `SELECT 1` et dernière migration de cette version appliquée ; 200 `{ status, version }` ou 503
- [x] pino en JSON, une ligne par requête (méthode, route modèle, statut, durée, `userId`, `requestId`), `X-Request-Id` renvoyé ; `redact` avec un test qui prouve que mots de passe, jetons, cookies, `Authorization` et corps ne sortent jamais
- [x] `X-App-Version` sur chaque réponse ; `secureHeaders` ; contrôle d'origine (`csrf()`) sur une liste d'origines unique dans la config ; `X-Forwarded-For` accepté seulement depuis le réseau Traefik

## Comments

**2026-10-09, implémentation (agent).**

- **Table de démonstration de test seulement** : `rls_probe` est créée par le harnais (`apps/api/test/global-setup.ts`) sous le propriétaire, avec le modèle de toute table métier (`user_id`, RLS activée et forcée, politique `using` + `with check`, `GRANT` au rôle applicatif). Rien de factice n'est livré en prod. Le test `src/db/isolation.test.ts` prouve qu'un `select` sans filtre sous `withUser` ne voit que son Utilisateur, qu'on ne peut pas écrire pour un autre, et qu'une table métier est illisible hors `withUser`. On l'a vérifié par mutation : sans la RLS, trois tests échouent.
- **Rôles** : leurs noms sont fixés, `battlecrm_owner` et `battlecrm_app`, parce que les migrations leur accordent des droits. Ils sont créés par `ops/postgres/initdb/01-roles.sh`, le même script pour le compose de dev, la CI et la prod (ticket 04). La base appartient au propriétaire, sans `CREATEDB`.
- **Première migration** `0000_app_role_access` (`--custom`) : le rôle applicatif lit `drizzle.__drizzle_migrations` pour `/api/health`. Chaque table accordera ses propres droits, sans `ALTER DEFAULT PRIVILEGES`, pour garder des `GRANT` limités sur les tables de Better Auth. drizzle-kit refuse de tourner sans fichier de schéma : `src/db/tables.ts` est donc vide pour l'instant.
- **Santé** : `created_at >= when` de la dernière entrée du journal Drizzle, importée dans le bundle. Une base injoignable donne 503 sans détail.
- **Harnais** : une base `battlecrm_test_<uuid>` par exécution, créée par le superutilisateur du Postgres de dev ou de CI, migrée par `runMigrations` (la fonction du point d'entrée `migrate`), puis supprimée, y compris quand la mise en place échoue. La garde superutilisateur / `BYPASSRLS` arrête toute l'exécution dans le `globalSetup` ; on l'a vérifiée en la pointant sur le superutilisateur. `TEST_POSTGRES_HOST` change l'hôte si besoin.
- **`withoutIsolation`** : Oxlint ne gère `importNames` que sous `paths`, donc l'interdiction énumère `./`, `../`, `../../` et `../../../db/index.ts`. **Le ticket 06 doit ajouter l'exception de `auth/`** (override ou commentaire de désactivation justifié). `migrate` n'en a pas besoin, il appelle `runMigrations`.
- **`createApp({ config, clock, random, logger })`** : `email`, `hibp` et `alert` arriveront avec leurs tickets (05, 06), pour ne rien déclarer à vide. Les doubles de test sont `testClock().advance('P7D')` et `scriptedRandom(…)` (`apps/api/test/doubles.ts`).
- **Configuration** : `APP_ORIGIN` (origine complète, `http://` en dev) remplace `APP_HOST` côté API, et sert de liste unique d'origines (`csrf()`, puis `trustedOrigins` de Better Auth). Les autres variables sont `TRUSTED_PROXIES` (sous-réseau de `traefik-public`), `APP_VERSION`, `MIGRATION_DATABASE_URL` pour `migrate`, et `PORT` et `LOG_LEVEL` en facultatif. La spec stack §10.4 et §8 est mise à jour. Le message d'erreur nomme la variable sans jamais afficher sa valeur.
- **`X-Forwarded-For`** : le résultat est posé dans `c.var.clientIp`, et la dernière entrée n'est crue que si le pair est dans `TRUSTED_PROXIES`. Le ticket 07 le branchera sur la limitation.
- **`X-Request-Id`** : il est toujours généré par l'API. Celui d'un client est ignoré, pour qu'il ne puisse pas forger de lignes de journal.
- **`csrf()` de Hono** ne contrôle que les types de formulaire (urlencoded, multipart, text/plain). Un POST JSON déclenche déjà un preflight CORS refusé. Si l'on veut un contrôle d'origine sur tout POST, ce sera à trancher avec l'auth (ticket 06/07).
- **Dev** : `docker compose -f compose.dev.yml up -d`, `pnpm --filter @battlecrm/api db:migrate`, puis `pnpm --filter @battlecrm/api dev` (`node --watch` avec `pino-pretty`). En prod, `node dist/main.js` et `node dist/migrate.js` (tsdown, `../drizzle` résolu pareil depuis `src/` et `dist/`).
- **À prévoir** : Node refuse d'effacer les types sous `node_modules`. Le jour où l'API importera un paquet `@battlecrm/*` en source seule, `node --watch src/main.ts` cassera, et il faudra un chargeur (tsx) ou un bundle en dev.
- **CI** : un service `postgres:18.6-alpine`, les rôles posés par le même script, puis `db:drift` après les tests (bloquant : on a vérifié qu'un `pgTable` ajouté sans migration le fait échouer).
- **Dépendances** : à cause de `minimumReleaseAge`, on a pris `hono` 4.13.12, `@hono/node-server` 2.1.3, `drizzle-orm` 0.45.3 (exact), `pino-pretty` 13.1.3. Le script d'installation d'`esbuild` est refusé explicitement (`allowBuilds`) : son binaire vient de son paquet de plateforme.
