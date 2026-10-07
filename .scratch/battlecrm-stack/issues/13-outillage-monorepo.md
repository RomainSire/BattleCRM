# Outillage du monorepo

Type: grilling
Status: open
Blocked by:

## Question

Comment le monorepo TypeScript (pnpm) est-il outillé, pour que des agents y écrivent du code homogène et que les erreurs sortent avant l'exécution ?

À trancher :
- Disposition des workspaces : `apps/` (SPA, API, landing) et `packages/` (jetons de thème, messages Paraglide, schémas Zod et types partagés) ; la place d'un éventuel paquet du domaine viendra d'« Architecture : où vivent les règles du domaine ».
- Lint et format : Biome, ou ESLint + Prettier (règles de typage, règles React et d'accessibilité) ; contrôles qui bloquent en CI.
- TypeScript : `tsconfig` partagé, niveau de rigueur (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`…), exécution TS native de Node pour l'API ou étape de build.
- pnpm : *catalogs*, `minimumReleaseAge`, scripts d'installation autorisés, Renovate (rythme, regroupement).
- Orchestration des tâches : scripts pnpm récursifs, ou un outil (Turborepo, Nx) ; cache en CI.
- Interdictions vérifiées automatiquement (paquets bannis par « shadcn/ui face aux bibliothèques headless » : `@base-ui/react`, radix, cmdk, vaul, sonner, next-themes).

- Interdictions liées aux données (« [Base de données et accès aux données](07-donnees.md) ») : importer la connexion brute hors du module de données, les requêtes relationnelles Drizzle `db.query…`, `drizzle-kit push` hors base jetable ; versions de Drizzle et Better Auth épinglées.

Décisions d'entrée : « [Forme de l'app et langages](06-forme-app-langages.md) ».

- Interdiction liée à l'auth (« [Auth : bibliothèque, sessions et client extension](08-auth.md) ») : importer les tables d'auth ou l'instance Better Auth hors du module `auth`.

- Architecture (« [Architecture : où vivent les règles du domaine](09-architecture.md) ») : paquets `packages/domain` (pur : interdire toute E/S, horloge et hasard, et tout import de `contract`) et `packages/contract` (Zod) ; modules de l'API `prospecting`, `battles`, `funnel`, `organizations`, `settings`, `views`, `auth`, `db`, `jobs`, chacun seul à importer ses tables ; `withoutIsolation` importable par `auth` seul. **Tout le code en anglais** : vérification possible (lint de commentaires ?) ou revue seule.
