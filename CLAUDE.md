# BattleCRM — Guide pour Claude Code

## 1. Architecture du projet

Monorepo **pnpm** avec 3 applications et 1 package partagé :

```
battlecrm/
├── apps/
│   ├── backend/       # AdonisJS 6 (API REST, auth, BDD)
│   ├── frontend/      # React 19 + Vite 8 (SPA)
│   └── extension/     # Extension Chrome (WXT + React)
├── packages/
│   └── shared/        # @battlecrm/shared — types TypeScript partagés (.d.ts only)
├── docker-compose.yml # 3 services : postgres, backend, frontend
└── biome.json         # Linter/formatter global (Biome v2)
```

### Backend (`apps/backend`)

- **Framework** : AdonisJS 6 + Lucid ORM v22 (PostgreSQL)
- **Auth** : Session native AdonisJS (scrypt, cookies httpOnly) — PAS Supabase
- **Validation** : VineJS v4
- **Tests** : Japa (`tests/unit/`, `tests/functional/`)
- **ORM** : Lucid v22 — les réponses JSON sont en **camelCase** (comportement par défaut Lucid, pas snake_case)

Import aliases (définis dans `package.json#imports`) :
```
#controllers/*   → app/controllers/
#models/*        → app/models/
#serializers/*   → app/serializers/
#validators/*    → app/validators/
#middleware/*    → app/middleware/
#mixins/*        → app/mixins/
#helpers/*       → app/helpers/
#services/*      → app/services/
#start/*         → start/
#database/*      → database/
```

**Modèles Lucid :**
- `User`, `FunnelStage`, `Prospect` (SoftDeletes), `ProspectStageTransition`
- `Positioning`, `ProspectPositioning`, `Interaction`, `Battle`

**Sérialisation :** fonctions `serializeX()` dans `app/serializers/` retournant les types de `@battlecrm/shared`.

### Frontend (`apps/frontend`)

- **React 19** + **Vite 8** + **TypeScript**
- **Routing** : React Router v7 (layout routes pour guards `AuthGuard`/`GuestGuard` via `<Outlet />`)
- **State serveur** : TanStack Query v5
- **Formulaires** : react-hook-form v7 + VineJS (validation côté client)
- **UI** : shadcn/ui (Radix) + Tailwind CSS v4
- **Drag & drop** : dnd-kit
- **i18n** : react-i18next

Organisation par features : `src/features/{auth,dashboard,prospects,positionings,interactions,settings}/`

Composants shadcn installés : `accordion`, `button`, `input`, `label`, `field`, `text-field`, `dialog`, `card`, `skeleton`, `separator`, `alert-dialog`, `sonner`, `password-input`, `textarea`, `select`, `command`, `popover`, `scroll-area`, `switch`, `toggle-group`, `button-group`, `drawer`, `badge`, `tooltip`.

Custom : `phone-input.tsx` (`@/components/ui/phone-input`) via `react-phone-number-input`, format E.164.

### Extension (`apps/extension`)

- **Framework** : [WXT](https://wxt.dev/) + React 19 + TypeScript
- **UI** : shadcn/ui + Tailwind CSS v4 (via `@tailwindcss/postcss` — PAS `@tailwindcss/vite`, conflit Vite 7/8)
- **i18n** : react-i18next, locales dans `src/locales/fr.json` + `en.json`
- **Tests** : Vitest (unitaires uniquement) — E2E extension via Playwright (`pnpm test:e2e:extension`)
- **`tsconfig.json` standalone** — ne pas utiliser `extends: .wxt/tsconfig.json` (incompatibilité Vite 7/esbuild)
- **`browser.*`** est auto-importé par WXT dans tous les contextes (pas besoin d'import manuel)
- **Auth** : tokens d'accès (SHA-256, pas bcrypt) — migration écrite manuellement (`0011_create_auth_access_tokens_table.ts`)

Structure `src/` :
```
entrypoints/
├── popup/         # Unique point d'entrée UI (chrome.windows.create abandonné)
├── background.ts  # Service worker
└── content.ts     # Content script LinkedIn
features/
├── auth/
└── prospects/
locales/
├── fr.json
└── en.json
```

Persistance d'état : `chrome.storage.session` (clé = URL LinkedIn normalisée) — survit au close/reopen du popup, flushé sur navigation vers un autre profil.

### Package partagé (`packages/shared`)

Types TypeScript uniquement (`emitDeclarationOnly: true`). Ajouter tout nouveau type d'entité ici **avant** de coder le contrôleur backend.

### Infrastructure

- **Base de données** : PostgreSQL via Docker (`docker compose up postgres -d` depuis la racine)
- **Pas de RLS**, pas de Supabase, pas de `DB_SSL`
- Après un `docker compose up postgres -d` sur un volume vierge : `ENV_PATH=../../ node ace migration:run`

---

## 2. Commandes essentielles

### Racine (monorepo)

```bash
pnpm dev                  # Démarre backend + frontend en parallèle
pnpm build                # Build toutes les apps
pnpm lint                 # Biome check (lecture seule)
pnpm format               # Biome check --write (auto-fix)
pnpm lint:fix             # Biome check --write --unsafe
pnpm type-check           # Build shared puis tsc --noEmit sur tout
pnpm test                 # Lance tous les tests (hors E2E)
pnpm test:e2e             # Playwright chromium (NE PAS lancer automatiquement)
pnpm test:e2e:ui          # Playwright avec UI
pnpm test:e2e:extension   # Playwright extension
pnpm shared:build         # Build le package partagé
pnpm check:all            # lint + type-check + backend tests + build extension + E2E
```

### Backend (`apps/backend`)

Toutes les commandes `node ace` requièrent le préfixe **`ENV_PATH=../../`** (monorepo, `.env` à la racine).

```bash
ENV_PATH=../../ node ace serve --hmr          # Dev avec hot reload
ENV_PATH=../../ node ace test                  # Tous les tests Japa
ENV_PATH=../../ node ace test unit             # Tests unitaires uniquement
ENV_PATH=../../ node ace test functional       # Tests fonctionnels uniquement
ENV_PATH=../../ node ace migration:run         # Appliquer les migrations
ENV_PATH=../../ node ace migration:rollback    # Rollback
ENV_PATH=../../ node ace make:migration name   # Créer une migration
ENV_PATH=../../ node ace make:model name       # Créer un modèle
ENV_PATH=../../ node ace make:controller name  # Créer un contrôleur
```

### Frontend (`apps/frontend`)

```bash
pnpm --filter @battlecrm/frontend dev          # Dev Vite
pnpm --filter @battlecrm/frontend type-check   # tsc --noEmit
```

### Extension (`apps/extension`)

```bash
pnpm dev:extension          # WXT dev (Chrome)
pnpm build:extension        # WXT build (Chrome)
pnpm --filter @battlecrm/extension build:firefox  # Build Firefox
pnpm --filter @battlecrm/extension zip            # Zip pour publication
pnpm --filter @battlecrm/extension type-check     # wxt prepare + tsc --noEmit
pnpm --filter @battlecrm/extension test           # Vitest (run)
pnpm --filter @battlecrm/extension test:watch     # Vitest (watch)
```

---

## 3. Conventions de code

### Général

- **Linter/Formatter** : Biome v2 — PAS ESLint, PAS Prettier
- Biome trie les imports alphabétiquement : packages `@` scoped → aliases `#` → imports relatifs
- Auto-fix : `pnpm biome check --write .`
- **TypeScript strict** partout

### Backend

- Toujours créer le type dans `packages/shared/src/types/` en premier
- Toujours créer un `serializeX()` dans `app/serializers/` retournant le type partagé
- **Champs nullable** : toujours assigner explicitement (`model.field = payload.field ?? null`) — ne jamais laisser `undefined` en mémoire
- **UUID en query param** : valider avec regex UUID avant d'utiliser dans une requête Lucid (sinon PostgreSQL lève une erreur 500)
- **`withCount()`** : le résultat est dans `$extras`, mapper manuellement avec `Number($extras.count ?? 0)`
- **SoftDeletes + sous-ressources** : ajouter `.withTrashed()` quand un parent archivé doit rester accessible
- **Tests fonctionnels** : utiliser `loginAs(user)` du plugin Japa AdonisJS ; ne pas mocker la BDD (tests d'intégration réels)
- `assert.isDefined(model.id)` plutôt que `assert.property(model, 'id')` (instances Lucid)
- Pour tester `null` après création : recharger avec `await Model.findOrFail(id)` avant d'asserter

### Frontend

- **HTML sémantique** : `<main>`, `<header>`, `<section>`, `<nav>` — pas de `<div>` générique quand un élément sémantique existe
- **Toujours** préférer les composants shadcn aux éléments HTML bruts
- **Pattern formulaire** : `Label` (shadcn) pour les labels, `FieldError` (de `@/components/ui/field`) pour les erreurs
- **Phone input** : utiliser `Controller` de react-hook-form (pas `register`), `defaultCountry="FR"`
- `SelectTrigger` nécessite `className="w-full"` pour s'étirer en pleine largeur
- `credentials: 'include'` sur **tous** les appels `fetch` (cookies de session)
- Types API importés depuis `@battlecrm/shared` directement (pas de ré-exports dans les features)
- **Lucid sérialise en camelCase** : utiliser `funnelStageId` (pas `funnel_stage_id`) dans les réponses

### Extension

- **Tailwind** : utiliser `@tailwindcss/postcss` (PAS `@tailwindcss/vite` — conflit Vite 7/8)
- **`tsconfig.json`** : standalone, ne pas `extends: .wxt/tsconfig.json`
- **APIs browser** : `browser.*` est auto-importé par WXT — ne pas importer `webextension-polyfill` manuellement
- **État formulaire** : persister via `chrome.storage.session` avec la clé = URL LinkedIn normalisée ; flusher sur changement de profil
- **Entrypoint unique** : tout passe par `popup/` — ne pas créer de panels ou nouvelles fenêtres (`chrome.windows.create` abandonné)
- **Auth** : utiliser les tokens d'accès (SHA-256) — PAS les cookies de session (contexte extension ≠ navigateur standard)
- **Types API** : importer depuis `@battlecrm/shared` comme pour le frontend

### Tests

- Cycle **red-green-refactor** : écrire le test qui échoue d'abord, puis l'implémentation
- Backend : Japa (fonctionnels + unitaires) — E2E frontend : Playwright — Extension : Vitest (unitaires)
- Tests E2E Playwright : NE PAS lancer automatiquement — demander à Romain
- **Ne jamais mentir sur les tests** : les tests doivent exister et passer à 100%

---

## 4. Ce qu'il ne faut pas faire

- **Ne jamais** utiliser `npx <tool>` pour un outil déjà dans le workspace — toujours passer par les scripts `package.json`
- **Ne jamais** lancer les tests E2E automatiquement — demander à Romain (trop lents, lancer manuellement)
- **Ne pas** utiliser Supabase Auth SDK, Supabase RLS, ou `DB_SSL`
- **Ne pas** utiliser ESLint ou Prettier — Biome v2 uniquement
- **Ne pas** omettre `ENV_PATH=../../` devant les commandes `node ace`
- **Ne pas** utiliser `#kernel` comme alias — utiliser `#start/kernel`
- **Ne pas** utiliser `assert.property(model, 'id')` sur des instances Lucid — utiliser `assert.isDefined(model.id)`
- **Ne pas** mocker la base de données dans les tests fonctionnels — tests d'intégration réels obligatoires
- **Ne pas** passer un UUID non validé directement à Lucid `.where()` sur une colonne UUID (erreur PostgreSQL 500)
- **Ne pas** oublier `.withTrashed()` quand un endpoint de sous-ressource doit accéder à un parent archivé
- **Ne pas** faire de `git push --force` sans confirmation explicite de Romain
- **Ne pas** committer sans y être explicitement invité

---

## 5. Contexte métier

**BattleCRM** est un CRM personnel pour la **recherche d'emploi** avec des capacités de **A/B testing** (les "Battles").

### Concept clé : le "Battle"

L'utilisateur teste différentes **Positionings** (façons de se présenter : message, angle, accroche) auprès de ses **Prospects** (contacts professionnels). Il mesure quel Positioning génère le plus d'interactions positives. C'est le mécanisme central de "battle" entre variantes.

### Entités principales

| Entité | Rôle |
|---|---|
| `User` | Propriétaire de toutes les données (isolation totale par user) |
| `FunnelStage` | Étape du funnel de recherche (ex: "Cible", "Contacté", "Entretien") |
| `Prospect` | Contact LinkedIn/email à cibler (SoftDeletes pour archivage) |
| `ProspectStageTransition` | Historique des changements d'étape d'un prospect |
| `Positioning` | Variante de présentation à tester (titre, message, angle) |
| `ProspectPositioning` | Jonction Prospect ↔ Positioning avec `outcome` (`pending`/`success`/`failure`) |
| `Interaction` | Log d'une interaction avec un prospect (message envoyé, réponse reçue, etc.) |
| `Battle` | Comparaison de performance entre plusieurs Positionings |

### Signal de succès

`prospect_positionings.outcome = 'success'` est **le signal métier clé** indiquant qu'un Positioning a fonctionné avec un Prospect. (L'ancien `interaction.status` a été supprimé en migration `0010`.)

### Extension Chrome

Permet de capturer des prospects directement depuis LinkedIn. Un seul entrypoint `popup/`. L'état du formulaire est persisté via `chrome.storage.session` (clé = URL LinkedIn normalisée) pour survivre au close/reopen du popup.
