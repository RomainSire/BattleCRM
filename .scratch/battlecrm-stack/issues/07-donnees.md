# Base de données et accès aux données

Type: grilling
Status: open
Blocked by: 03, 06

## Question

Quelle base, et comment le code y accède-t-il ?

À trancher :
- SQLite ou Postgres (voir « Base de données : SQLite ou Postgres »).
- ORM, constructeur de requêtes typé ou SQL brut ; outil de migrations.
- Ce que la base garantit par contrainte (unicités normalisées, au plus un Essai en cours…) et ce que garantit le code.
- Isolation par Utilisateur (ST-23) : mécanisme retenu.
