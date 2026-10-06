# L'isolation repose aussi sur la RLS de Postgres

Chaque requête métier filtre par Utilisateur dans le code, et la Row Level Security de Postgres rattrape celle qui l'aurait oublié : une politique `user_id = current_setting('app.user_id')::uuid` sur chaque table métier, avec `FORCE ROW LEVEL SECURITY`. Des agents écriront beaucoup de requêtes, et un filtre oublié est le seul bug qui montrerait à un Utilisateur les données d'un autre (ST-23) ; un filtre applicatif seul aurait été plus simple, mais n'aurait reposé que sur la discipline de chaque requête.

## Consequences

- Deux rôles Postgres : un **propriétaire** qui possède le schéma et lance les migrations, depuis un point d'entrée séparé ; un **rôle applicatif**, le seul que l'API connaisse, qui ne possède aucune table.
- Une requête métier ne s'écrit que dans `withUser(userId, async (tx) => …)`, qui ouvre la transaction et pose `app.user_id` par `set_config(…, true)`. La connexion brute n'est jamais exportée hors du module de données, et le lint l'interdit ailleurs.
- Les clés étrangères sont composites `(user_id, id)`, pour fermer ce que la RLS ne voit pas : une référence vers la ligne d'un autre Utilisateur.
- Les tables de Better Auth restent hors RLS : il faut les lire avant de connaître l'Utilisateur.
