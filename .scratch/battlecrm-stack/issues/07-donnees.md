# Base de données et accès aux données

Type: grilling
Status: resolved
Blocked by: 03, 06

## Question

Quelle base, et comment le code y accède-t-il ?

À trancher :
- SQLite ou Postgres (voir « Base de données : SQLite ou Postgres »).
- ORM, constructeur de requêtes typé ou SQL brut ; outil de migrations.
- Ce que la base garantit par contrainte (unicités normalisées, au plus un Essai en cours…) et ce que garantit le code.
- Isolation par Utilisateur (ST-23) : mécanisme retenu.

## Comments

- 2026-10-06, premier tour avec Romain (accepté tel quel) : PostgreSQL 18 dédié, image `postgres:18` épinglée ; isolation par filtre applicatif + RLS en garde-fou (rôle propriétaire pour les migrations, rôle applicatif non propriétaire, `app.user_id` posé par transaction, tables Better Auth hors RLS) ; la base garantit les invariants structurels (FK, `NOT NULL`, `CHECK` d'énumérations, index uniques partiels « au plus un », unicité des colonnes normalisées, FK composites `(user_id, id)`), le code les règles calculées (Règle de victoire, Tirage, valeurs en vigueur, transitions d'État ; verrou sur la Battle) ; identifiants UUID v7 générés par la base ; `timestamptz` pour les instants, `date` lue en chaîne pour les jours locaux, historiques `(user_id, depuis_le, valeur)` ; anonymisation sur place avec `anonymise_le` et `CHECK`. Reste : bibliothèque d'accès, migrations, pose du contexte RLS, adaptateur Better Auth, pilote (recherche `research/07-acces-aux-donnees` en cours).
- Recherche disponible sur la branche `research/07-acces-aux-donnees`, fichier `.scratch/battlecrm-stack/research/07-acces-aux-donnees.md` (`git show research/07-acces-aux-donnees:.scratch/battlecrm-stack/research/07-acces-aux-donnees.md`). Recommandation : Drizzle 0.45 stable sur `pg` ; repli Kysely 0.29 + `pg`, migrations SQL à la main ; Prisma et SQL brut + générateur écartés.
- 2026-10-06, second tour avec Romain (accepté tel quel) : Drizzle 0.45 épinglé sur `pg`, style SQL seul ; migrations par un point d'entrée séparé sous le rôle propriétaire ; `withUser` explicite + `FORCE RLS` ; Better Auth sur l'adaptateur Drizzle ; contrat Zod écrit à la main ; pas de spike, ADR 0009.

## Answer

Tranché avec Romain le 2026-10-06 ; ADR [0009 L'isolation repose aussi sur la RLS de Postgres](../../../docs/adr/0009-isolation-aussi-par-la-rls.md). Détail des options : la recherche (voir Comments).

- **Base** : **PostgreSQL 18**, base dédiée dans son conteneur, image `postgres:18` épinglée sur la majeure.
- **Accès** : **Drizzle 0.45** épinglé, sur le pilote **`pg`**. Un seul style : le constructeur proche du SQL (`select`, `innerJoin`…), **pas de requêtes relationnelles** `db.query…` (refaites par la 1.0). Colonnes `date` en mode `string`. Passage à Drizzle 1.0 une fois stable, comme tâche planifiée. Repli nommé : Kysely 0.29 + `pg`. Écartés : Prisma (ni `CHECK` ni RLS dans son schéma, 8 en RC), SQL brut + générateur (pgtyped dormant).
- **Migrations** : générées par `drizzle-kit generate` depuis le schéma TS, **relues en revue** ; compléments (`GRANT`, fonctions) en migrations `--custom` ; en avant seulement, jamais de `down` ; `drizzle-kit push` interdit hors base jetable. Appliquées par un **point d'entrée séparé** de la même image (`migrate`), avec les seuls identifiants **propriétaires** ; l'API ne connaît que le rôle applicatif. L'enchaînement au déploiement revient à « Déploiement ».
- **Isolation (ST-23)** : filtre applicatif **et** RLS en garde-fou (ADR 0009). Rôle propriétaire et rôle applicatif non propriétaire ; `FORCE ROW LEVEL SECURITY` ; chaque table métier porte `user_id` et une politique `user_id = current_setting('app.user_id')::uuid`. Une requête métier ne s'écrit que dans **`withUser(userId, async (tx) => …)`** (transaction + `set_config('app.user_id', …, true)`) ; la connexion brute n'est pas exportée du module de données, une règle de lint interdit de l'importer ailleurs.
- **Ce que garantit la base** : clés étrangères partout, **composites `(user_id, id)`** ; `NOT NULL` par défaut ; `CHECK` sur les énumérations ; **index uniques partiels** pour les « au plus un » (Essai en cours, Relance planifiée, Battle ouverte par Étape) ; **index uniques sur colonnes normalisées** (ST-30), la normalisation calculée par du code partagé avec le front.
- **Ce que garantit le code** : Règle de victoire, Tirage, jour local et valeurs en vigueur (ADR 0003), transitions d'État permises ; Tirage et Horizon prennent un verrou sur la ligne de la Battle (`SELECT … FOR UPDATE`).
- **Identifiants** : **UUID v7** générés par la base (`uuidv7()`).
- **Temps** : instants en `timestamptz` ; jours locaux en `date`, calculés à l'écriture avec le fuseau en vigueur et lus comme chaînes `AAAA-MM-JJ`, jamais en `Date` JS ; valeurs en vigueur (fuseau, Objectif d'activité, Objectif d'entrées) dans des tables `(user_id, depuis_le, valeur)`.
- **Anonymisation (ST-38)** : **sur place** (champs identifiants et notes d'Interactions effacés, marqueur `anonymise_le`, `CHECK` qu'un Contact anonymisé n'a plus de champ identifiant). Les sauvegardes relèvent de leur rétention.
- **Better Auth** : **adaptateur Drizzle**, `better-auth` ≥ 1.7.7 (GHSA-44jh-23m7-hpcf corrigé) ; schéma généré par sa CLI dans un fichier Drizzle et migré comme le reste ; tables dans la même base et le même schéma, **hors RLS**, accédées par le rôle applicatif avec des `GRANT` limités ; `user.id` en UUID.
- **Contrat d'API** : schémas **Zod écrits à la main** dans le paquet partagé, indépendants des tables (pas de `drizzle-zod`) ; l'API fait la correspondance.
- Pas de spike : la première tranche d'implémentation sert d'épreuve.
