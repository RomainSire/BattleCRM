# Candidats backend

Type: research
Status: open
Blocked by:

## Question

Quels couples langage + framework backend sont les meilleurs candidats pour BattleCRM, au regard des critères de la carte (lisibilité par les agents, maintenance solo et robustesse, légèreté sur le VPS, rapidité) ?

À couvrir :
- Candidats : TypeScript sur Node ou Bun (Hono, Fastify, AdonisJS, NestJS…), Go, Elixir/Phoenix, C#/.NET, Kotlin, Rust ; en écarter vite ceux qui ne tiennent pas, avec la raison.
- Pour chacun : typage, qualité du code produit par des agents (volume d'entraînement, conventions fortes), maturité et rythme des ruptures de version, empreinte mémoire d'un conteneur au repos, latence typique d'une API CRUD, écosystème (validation, ORM ou requêtes typées, migrations, e-mail, i18n).
- Partage de types avec le front et avec un client extension Firefox (monorepo).
- Ce qui donne un **backend rapide** à cette échelle (quelques Utilisateurs) : le langage compte-t-il, ou surtout la latence réseau et le nombre d'allers-retours ?

Livrable : `.scratch/battlecrm-stack/research/01-candidats-backend.md`, avec sources primaires et un classement argumenté (3 finalistes au plus).
