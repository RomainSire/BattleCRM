# Architecture : où vivent les règles du domaine

Type: grilling
Status: open
Blocked by: 06, 07

## Question

Comment le code est-il découpé, et où vivent les règles du domaine ? Consulter `codebase-design`.

À trancher :
- Modules et frontières : Funnel, Contacts et Organisations, Positionnements, Battles, Essais et Tirage, Relances et Cadence, Activité.
- Où se calculent la Règle de victoire (ADR 0001, ST-45), le Tirage équilibré par Cible (ST-34, ADR 0002), les valeurs en vigueur (ADR 0003 : ordre du Funnel, fuseau, Objectif d'activité), les états « à traiter / en attente / sans prochaine action » (ST-46, ST-47).
- Isolation par Utilisateur (ST-23) : tranchée par « [Base de données et accès aux données](07-donnees.md) » (`withUser`, RLS forcée, ADR 0009) ; reste où vit le module de données et comment les modules l'appellent.
- Le domaine est-il partagé avec le front (calculs côté client pour la fluidité, la consultation hors ligne) ?

- Auth (« [Auth : bibliothèque, sessions et client extension](08-auth.md) », ADR 0010) : un module `auth` seul à toucher les tables d'auth, qui n'expose que « qui est l'Utilisateur de cette requête » ; reste son emplacement et sa frontière avec le module de données. Un planificateur tourne dans le processus de l'API (tâches d'auth) : d'autres modules y auront-ils des tâches ?
