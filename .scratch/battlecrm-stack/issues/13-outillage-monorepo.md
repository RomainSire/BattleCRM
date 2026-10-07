# Outillage du monorepo

Type: grilling
Status: resolved
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

## Answer

Tranché avec Romain le 2026-10-07 ; ADR [0014 TypeScript 7 et Oxlint, sans typescript-eslint](../../../docs/adr/0014-typescript-7-et-oxlint-sans-typescript-eslint.md). État de l'outillage vérifié à cette date : TS 7.0 stable depuis le 2026-07-08 sans API programmatique (7.1 stable prévue le 2026-11-24) ; vérification typée d'Oxlint stable (tsgolint v7, 2026-07-22) ; oxfmt en 0.x ; Vite+ en bêta.

- **Workspaces** (portée `@battlecrm/*`) : `apps/web` (SPA), `apps/api`, `apps/site` (landing Astro) ; `packages/domain`, `packages/contract`, `packages/theme` (jetons Tailwind partagés par web et site), `packages/i18n` (un seul projet Paraglide, messages de l'app et de la landing). `tsconfig.base.json` à la racine, sans paquet de configuration. Composants shadcn éjectés dans `apps/web`, leur seul consommateur. Paquets **source seule** (`exports` vers les `.ts`, pas de build).
- **TypeScript 7** partout (`tsgo -b`), sauf `apps/site` qui garde TS 6 pour `astro check` jusqu'à son portage, ou s'en passe. Options : `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`, `erasableSyntaxOnly` (pas d'`enum` ni de `namespace`, unions de chaînes). `packages/domain` : `lib: ["ES2024"]` sans DOM, `types: []`, donc `fetch`, `process`, `fs` ne compilent pas.
- **Lint** : **Oxlint en mode typé** (`oxlint --type-aware`), règles natives seulement (pas de plugins JS, en alpha). **Format** : **Prettier** + `prettier-plugin-tailwindcss` ; oxfmt quand il sera en 1.0. Biome écarté (types vus fichier par fichier).
- **Exécution de l'API** : en dev, `node --watch src/main.ts` (TS natif de Node 24 ; les liens du workspace se résolvent hors de `node_modules`) ; en prod, **bundle tsdown** (`dist/main.js`, paquets du workspace inclus, `migrate` en second point d'entrée), car Node refuse le TS sous `node_modules`, où `pnpm deploy` copierait les paquets.
- **Orchestration** : scripts pnpm récursifs seuls, pas de Turborepo ni de Vite+. Commande unique **`pnpm check`** (format, lint, types, tests). Turborepo à reconsidérer seulement si la CI dépasse ~5 min.
- **pnpm** : `packageManager` épinglé ; **catalogs** pour toute dépendance partagée ; `minimumReleaseAge` 7 jours ; liste blanche explicite des scripts d'installation.
- **Mises à jour** : **Renovate** (remplace Dependabot dans « [Déploiement](10-deploiement.md) » et l'ADR 0013) : catalogs, images Docker, Actions épinglées par SHA ; hebdomadaire et groupé ; correctifs d'outils de dev fusionnés automatiquement si la CI passe ; Drizzle, Better Auth et `postgres` toujours en PR manuelle, en versions exactes (sans `^`).
- **Interdictions** :
  - **Modules de l'API** : `no-restricted-imports` interdit d'entrer dans le dossier d'un autre module (`apps/api/src/<module>/…`), on ne passe que par son `index.ts`. Tables dans `<module>/tables.ts`, importables par leur module et par `views` seul (jamais celles d'`auth`) ; `drizzle-kit` les ramasse par `src/*/tables.ts`. N'écrire que ses tables, et `views` en lecture seule : revue.
  - **Données** : `withoutIsolation` importable par `auth/` et `migrate` seuls. Pas de `schema` passé à `drizzle()`, donc `db.query…` ne compile pas. `drizzle-kit push` : aucun script, consigne dans `CLAUDE.md`.
  - **`packages/domain`** : aucune dépendance (imports relatifs seuls) ; `no-restricted-globals` sur `crypto`, `performance` ; `Date.now` et `Math.random` par `no-restricted-properties` si Oxlint l'a nativement, sinon en revue ; `new Date()` sans argument en revue et attrapé par les tests (« maintenant » en paramètre).
  - **Paquets bannis**, avec un message qui nomme l'alternative retenue : `@base-ui/react`, `@radix-ui/*`, `radix-ui`, `cmdk`, `vaul`, `sonner`, `next-themes`, `react-router`, `i18next`, `react-i18next`, `@prisma/client`, `drizzle-zod`.
  - **Code en anglais** : pas de vérification automatique (cspell écarté) ; consigne dans `CLAUDE.md`, un mot français égaré n'est pas grave.
- **CI** : un workflow `ci` (push et PR), réutilisé par `release` : install avec cache pnpm, `prettier --check`, `oxlint --type-aware`, `tsgo -b`, tests (outils : « [Stratégie de test](15-strategie-de-test.md) »), build ; tout bloquant. Node dans `.node-version`, lu par `setup-node` et le `Dockerfile`, monté par Renovate. `.editorconfig` et extensions VS Code recommandées (Oxc, Prettier, TS natif).
- **Pas de hooks git** : la CI bloque, `pnpm check` suffit.
- **`CLAUDE.md` racine**, court, qui renvoie aux ADR : `pnpm check` avant de rendre la main ; code en anglais d'après les `_EN_` de `CONTEXT.md` ; une notion sans terme se règle d'abord dans le glossaire ; jamais d'import profond d'un autre module ; jamais de `drizzle-kit push` ni d'édition d'une migration livrée ; expand/contract. Pas de `CLAUDE.md` par app tant que la racine suffit.
