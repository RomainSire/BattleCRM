# Candidats backend

Type: research
Status: resolved
Blocked by:

## Question

Quels couples langage + framework backend sont les meilleurs candidats pour BattleCRM, au regard des critères de la carte (lisibilité par les agents, maintenance solo et robustesse, légèreté sur le VPS, rapidité) ?

À couvrir :
- Candidats : TypeScript sur Node ou Bun (Hono, Fastify, AdonisJS, NestJS…), Go, Elixir/Phoenix, C#/.NET, Kotlin, Rust ; en écarter vite ceux qui ne tiennent pas, avec la raison.
- Pour chacun : typage, qualité du code produit par des agents (volume d'entraînement, conventions fortes), maturité et rythme des ruptures de version, empreinte mémoire d'un conteneur au repos, latence typique d'une API CRUD, écosystème (validation, ORM ou requêtes typées, migrations, e-mail, i18n).
- Partage de types avec le front et avec un client extension Firefox (monorepo).
- Ce qui donne un **backend rapide** à cette échelle (quelques Utilisateurs) : le langage compte-t-il, ou surtout la latence réseau et le nombre d'allers-retours ?

Livrable : `.scratch/battlecrm-stack/research/01-candidats-backend.md`, avec sources primaires et un classement argumenté (3 finalistes au plus).

## Comments

- Recherche disponible sur la branche `research/01-candidats-backend`, fichier `.scratch/battlecrm-stack/research/01-candidats-backend.md` (`git show research/01-candidats-backend:.scratch/battlecrm-stack/research/01-candidats-backend.md`).

## Answer

Détail, mesures et sources : la recherche ci-dessus. Faits établis, sur lesquels s'appuiera « Forme de l'app et langages » :

- **1er : TypeScript sur Node LTS (Node 26, LTS le 2026-10-28) + Hono**, Zod, Better Auth : plus gros volume d'entraînement, un seul langage pour front, back, extension et schémas, client RPC typé sans génération de code.
- **2e : C# / .NET 10 LTS + Minimal APIs**, Identity, EF Core : écosystème le plus complet et typage fort, mais deux langages dans le dépôt et un client TypeScript à générer depuis OpenAPI.
- **3e : Go 1.27**, bibliothèque standard + sqlc : le plus stable et le plus léger, mais auth et types partagés presque entièrement à écrire.
- **Écartés** : Bun (1.4 réécrite en Rust, six semaines d'âge), AdonisJS (ni TOTP ni sessions listées), NestJS (cérémonie), Phoenix (typage graduel, LiveView mal accordé à ST-03), Kotlin, Rust.
- **Rapidité** : route JSON triviale sous la milliseconde partout ; la fluidité tient au nombre d'allers-retours par écran, aux mises à jour optimistes et à la copie locale, pas au langage. **Mémoire** (mesurée sur poste local, ordres de grandeur) : Node ~30 Mio au repos et ~90 sous charge, .NET 14/35, Go 2/10 : la légèreté ne départage presque rien sur 8 Go.
- **Tension avec « Auth : ce que couvrent les bibliothèques »** : cette recherche-ci présente Better Auth comme un atout net ; l'autre relève une limitation par IP seulement (pas par compte) et une veille de sécurité lourde (37 avis, dont 3 critiques). À peser dans « Forme de l'app et langages ».
- **Vigilance pour la suite** : Drizzle 1.0 et Prisma 8 encore en RC, Kysely en 0.x (« Base de données et accès aux données ») ; RPC Hono ou OpenAPI (« Architecture »). Deux affirmations écrites de mémoire, non vérifiées : `SecurityStamp` d'Identity, étape de build imposée par AdonisJS.
