# Forme de l'app et langages

Type: grilling
Status: resolved
Blocked by: 01, 02, 04, 11, 12

## Question

Quelle forme prend l'app, et avec quels langages et frameworks ?

À trancher :
- SPA + API séparée, ou framework full-stack (rendu serveur) ; ce que chaque option implique pour l'extension Firefox (même API) et le hors-ligne en consultation.
- Le langage et le framework backend : **TypeScript (Hono, NestJS ou AdonisJS), Rust ou Go** (C# / .NET écarté par préférence de Romain), à la lumière de « Candidats backend » et de « Rust, Go et TypeScript au banc d'essai ».
- Le framework front et les bibliothèques d'interface, parmi les finalistes de « Candidats front », et la couche de composants (« shadcn/ui face aux bibliothèques headless »).
- Poids de la couverture auth (« Auth : ce que couvrent les bibliothèques ») dans le choix de l'écosystème, sachant qu'écrire soi-même n'est pas un défaut en soi (une dépendance en moins).

## Answer

Tranché avec Romain le 2026-10-06 ; ADR [0008 TypeScript de bout en bout](../../../docs/adr/0008-typescript-de-bout-en-bout.md).

- **Forme** : SPA Vite + API séparée, dans ce dépôt (monorepo). Pas de rendu serveur pour l'app. La même API sert la SPA et l'extension Firefox.
- **Trois apps** dans le monorepo : l'**app** (SPA), l'**API**, et une **landing page** statique pour présenter l'app (portfolio). S'y ajoutera l'extension, hors de cette carte.
- **Backend** : TypeScript `strict` sur **Node LTS**, **Hono**, **Zod**. Sans spike comparatif : le critère n° 1 et les types partagés penchent déjà vers TS, et l'avantage d'un compilateur plus strict n'est pas démontré. Repli nommé : Go.
- **Auth** : **Better Auth**, réduit au minimum. Le reste (plugins, ce qu'on écrit pour ST-17, ST-19, ST-21, sessions, jeton de l'extension) appartient à « [Auth : bibliothèque, sessions et client extension](08-auth.md) ».
- **Front** : **React 19**, **TanStack Router** (routes, liens et paramètres de recherche typés, validés par Zod : ST-70), **TanStack Query**, **Paraglide** (messages compilés en fonctions typées : une clé absente casse la compilation ; préféré à i18next pour cette raison), **vite-plugin-pwa**, **tinykeys**. Écartés : React Router (typage en SPA faible, API qui a changé trois fois), i18next (clés en chaînes).
- **Composants** : **shadcn/ui en base `aria`** (React Aria Components) sur **Tailwind 4**, puis `shadcn eject` (le CLI reste un générateur ponctuel, jamais une dépendance). Toast maison sur React Aria (ST-62), panneau non modal et kanban à écrire depuis les exemples Adobe. Pas de spike : la première tranche du kanban sert d'épreuve ; repli shadcn base Base UI.
- **Landing page** : **Astro statique**, en FR/EN avec **Paraglide** (une seule convention de messages dans le monorepo), mêmes **jetons de thème** que l'app via un paquet partagé du workspace. **Vitrine seule** pour l'instant (pas de compte de démo). Son contenu relève d'une session de grilling dédiée, hors de cette carte.
- **Gestionnaire de paquets** : **pnpm** seul, épinglé par `packageManager` ; npm, yarn et bun exclus. Retenu pour ses gardes de chaîne d'approvisionnement (scripts d'installation bloqués par défaut, `minimumReleaseAge`) et ses *catalogs*.
- **Adresses (préférence transmise à « Déploiement »)** : landing sur `battlecrm.romainsire.com`, app sur `app.battlecrm.romainsire.com`, API sur la même origine sous `/api` (cookie sur un seul hôte, pas de CORS pour la SPA). Un futur domaine dédié (`battlecrm.com`, `app.battlecrm.com`) ne changerait que la configuration.
