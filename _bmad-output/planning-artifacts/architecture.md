---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-02-03'
lastUpdated: '2026-03-01'
lastUpdateReason: 'Added Epic 8 - Browser Extension Architecture (WXT, Adonis opaque tokens, MV3 patterns)'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/analysis/brainstorming-extension-linkedin-2026-02-28.md
documentCounts:
  prdCount: 1
  uxDesignCount: 1
  briefCount: 0
  researchCount: 0
  projectDocsCount: 0
  projectContextCount: 0
workflowType: 'architecture'
project_name: 'BattleCRM'
user_name: 'Romain'
date: '2026-02-03'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

64 FRs organisés en 8 domaines fonctionnels :

| Domaine | FRs | Complexité Architecturale |
|---------|-----|---------------------------|
| Prospect Management | FR1-FR9 | Standard CRUD + soft delete + drill-down |
| Positioning Management | FR10-FR17 | Standard CRUD + relations prospects |
| Interaction Management | FR18-FR28 | CRUD + timeline + pré-remplissage intelligent |
| Performance Analytics | FR29-FR37 | **Élevée** - Bayesian calculations, Battle tracking |
| Funnel Configuration | FR38-FR44 | Configuration dynamique (max 15 étapes) |
| Data Import/Export | FR45-FR50 | **Élevée** - CSV parsing, duplicate detection, mapping |
| User Management | FR51-FR56 | Adonis native auth + backend-enforced multi-tenant |
| Battle Management | FR57-FR64 | **Élevée** - A/B test state machine per funnel stage |

**Non-Functional Requirements:**

67 NFRs définissant les contraintes qualité :

| Catégorie | NFRs | Impact Architectural |
|-----------|------|---------------------|
| Performance | NFR1-NFR9 | Page load <2s, bundle <300KB, CSV import <5min |
| Security | NFR10-NFR20 | Adonis sessions, HTTPS, CSRF, backend user isolation |
| Data Integrity | NFR21-NFR28 | **Critique** - Transactions, soft delete, zero bug policy |
| Accessibility | NFR29-NFR40 | WCAG 2.1 Level A, shadcn/ui built-in |
| Usability | NFR41-NFR48 | 3-click rule, <1min logging, pre-fill |
| Maintainability | NFR49-NFR61 | TypeScript strict, tests, Docker |
| Compatibility | NFR62-NFR67 | Chrome/Firefox latest, responsive |

**Scale & Complexity:**

- Primary domain: **Full-stack Web SPA**
- Complexity level: **Medium** (unique business logic, limited scope)
- Estimated architectural components: **~15-20** (3 views + analytics + auth + config + import)
- Multi-tenancy: **Yes** (via backend middleware + user_id query filtering, low user count)
- Real-time: **No** (standard request/response)
- Compliance: **No** (personal tool)

### Technical Constraints & Dependencies

**Stack Decisions (from PRD - non-negotiable):**

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React 18+ / Vite | Fast dev, optimized builds |
| Styling | Tailwind CSS + shadcn/ui | Modern, accessible, Tailwind-native |
| Backend | Adonis.js | TypeScript, batteries-included |
| Database | PostgreSQL 16 (Docker) | Self-hosted, no external dependency |
| Deployment | Docker + Docker Compose | Primary: production on VPS; also usable for local dev |
| Monorepo | pnpm workspaces | Fast, disk-efficient |

**Technical Constraints:**

1. **TypeScript Strict Mode** - Enforced across frontend and backend
2. **Shared Types (Very Nice-to-Have)** - `/packages/shared` for DTOs and schemas if monorepo setup allows without excessive complexity. Fallback: manage types separately in front/back if shared package proves too complex to configure.
3. **No Legacy Browsers** - Chrome/Firefox latest 2 versions only
4. **Light Mode Only** - User preference (dark mode nice-to-have)
5. **Desktop-First** - Mobile responsive but not primary target

### Cross-Cutting Concerns Identified

| Concern | Impact | Implementation Approach |
|---------|--------|------------------------|
| **Multi-tenant Isolation** | All queries | Backend middleware + `WHERE user_id = :currentUser` on all queries |
| **Soft Delete** | All entities | `deleted_at` field, archive search toggle |
| **Data Validation** | All mutations | Backend validation + frontend UX |
| **Error Handling** | All operations | Inline errors, no popups, clear messages |
| **Audit Trail** | Interactions | Timestamps, user_id on all records |
| **Statistical Calculations** | Analytics | Bayesian service for conversion rates |

## Starter Template Evaluation

### Primary Technology Domain

**Full-stack Web SPA** avec architecture frontend/backend séparés dans un monorepo pnpm.

### Starter Options Considered

| Option | Description | Decision |
|--------|-------------|----------|
| T3 Stack | Full-stack Next.js + tRPC + Prisma | ❌ Rejected - Imposes Next.js, tRPC, Prisma which conflict with PRD choices |
| RedwoodJS | Full-stack React + GraphQL | ❌ Rejected - Imposes GraphQL, not REST |
| create-next-app | Next.js starter | ❌ Rejected - SSR not needed, Vite preferred |
| Turborepo | Monorepo build system | ❌ Rejected - Overkill for solo dev with 2-3 packages. Remote caching and complex pipelines not needed. pnpm workspaces native suffices. |
| **Composed Setup** | Vite + Adonis.js + pnpm workspaces | ✅ Selected - Aligns with PRD, maximum flexibility |

### Selected Approach: Composed Monorepo Setup

**Rationale for Selection:**

1. **PRD Alignment** - Stack already defined (React/Vite + Adonis.js + PostgreSQL/Docker)
2. **Separation of Concerns** - Frontend and backend evolve independently
3. **Tool Currency** - Each tool can be updated independently
4. **No Lock-in** - Not dependent on opinionated framework decisions
5. **Simplicity** - pnpm workspaces native is sufficient; Turborepo adds complexity without benefit for solo dev

### Initialization Commands

**Note:** Commands assume execution from existing `BattleCRM/` project root (already contains BMAD structure).

**1. Monorepo Root Setup:**

```bash
pnpm init
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
EOF
```

**2. Frontend Application (React + Vite + TypeScript):**

```bash
mkdir -p apps
cd apps
npm create vite@latest frontend -- --template react-ts
cd frontend
pnpm install
npx shadcn@latest init
cd ../..
```

**3. Backend Application (Adonis.js 6 API):**

```bash
cd apps
npm init adonisjs@latest backend -- --kit=api --db=postgres --auth-guard=session
cd ..
```

**4. Shared Package (Optional - if complexity allows):**

```bash
mkdir -p packages/shared
cd packages/shared
pnpm init
# Add TypeScript config and shared types/DTOs
cd ../..
```

**5. Install all dependencies:**

```bash
pnpm install
```

### Architectural Decisions Provided by Tools

**Language & Runtime:**
- TypeScript strict mode (both frontend and backend)
- Node.js ≥20.6 (Adonis.js requirement)
- ES Modules throughout

**Frontend (Vite + React):**
- React 18+ with Fast Refresh HMR
- Vite for build optimization and tree-shaking
- ESLint preconfigured
- TypeScript with strict config

**Backend (Adonis.js 6):**
- API starter kit (no views, REST-focused)
- PostgreSQL database driver
- Session authentication guard (httpOnly cookies)
- Ace CLI for commands and migrations

**UI Components (shadcn/ui):**
- Radix UI primitives (accessible)
- Tailwind CSS integration
- Copy-paste components (no runtime dependency)
- CSS variables for theming

**Monorepo (pnpm workspaces):**
- Disk-efficient with content-addressable storage
- Strict node_modules (no phantom dependencies)
- `workspace:*` for internal package links
- Parallel task execution with `pnpm -r --parallel`

### Project Structure

```
BattleCRM/
├── _bmad/                       # BMAD installation (existing)
├── _bmad-output/                # Planning artifacts (existing)
├── pnpm-workspace.yaml
├── package.json                 # Root scripts, shared devDependencies
├── tsconfig.base.json           # Shared TypeScript config (optional)
├── .gitignore
├── docker-compose.yml
├── apps/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/          # shadcn components
│   │   │   │   └── custom/      # FunnelCard, HeatmapCell, etc.
│   │   │   ├── pages/           # Route components
│   │   │   ├── lib/             # Utilities, API client
│   │   │   └── main.tsx
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   └── tsconfig.json
│   └── backend/
│       ├── app/
│       │   ├── controllers/
│       │   ├── models/
│       │   ├── services/        # Business logic (Bayesian, Battles)
│       │   └── validators/
│       ├── config/
│       ├── database/
│       │   └── migrations/
│       ├── start/
│       │   └── routes.ts
│       ├── package.json
│       └── tsconfig.json
└── packages/
    └── shared/                  # @battlecrm/shared — TypeScript types shared between backend and frontend
        ├── src/
        │   ├── index.ts         # Re-exports all types
        │   └── types/           # One file per entity: auth.ts, funnel-stage.ts, prospect.ts, positioning.ts, ...
        ├── dist/                # Compiled .d.ts files (generated, gitignored)
        ├── tsconfig.json        # emitDeclarationOnly: true, composite: true
        └── package.json         # exports.types → ./dist/index.d.ts
```

**Note:** Project initialization using these commands should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Authentication strategy (Sessions with httpOnly cookies)
- State management approach (TanStack Query + Context/Zustand)
- Validation strategy (VineJS both sides, separate)

**Important Decisions (Shape Architecture):**
- API documentation (Swagger/OpenAPI)
- Environment configuration (root .env)
- Logging strategy (Pino backend, console.log frontend)

**Deferred Decisions (Post-MVP):**
- External logging service (Sentry, etc.)
- Advanced caching strategies

### Authentication & Security

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Auth Method** | Adonis Sessions + httpOnly cookies | Simpler than JWT for same-origin SPA, no refresh token management, secure by default |
| **Auth Provider** | Adonis native auth (scrypt hashing) | Users stored in local PostgreSQL, Adonis manages all auth |
| **Authorization** | Backend middleware + user_id query filtering | All queries scoped to authenticated user_id; no RLS (not available without Supabase) |

**Implementation Notes:**
- Configure Adonis session guard (not access tokens)
- Frontend uses `credentials: 'include'` for fetch calls
- CORS configured for same-origin or specific frontend URL

### Frontend Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **State Management** | TanStack Query (server state) + Context/Zustand (UI state) | Query handles caching/loading/errors for API data; Context for simple UI state, Zustand for complex cases |
| **Query Keys** | Centralized in dedicated file | Prevents typos, easier invalidation, better organization |
| **Routing** | React Router v7 (declarative mode) | Sufficient for ~5 routes, well-documented, no complex search params needed |
| **Forms** | React Hook Form + VineJS validation | Minimal re-renders, VineJS consistency with backend |

**Implementation Notes:**
- Create `src/lib/queryKeys.ts` for centralized query key management
- TanStack Query DevTools enabled in development
- React Router with simple route config (no loaders/actions needed)

### Data & Validation

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Backend Validation** | VineJS (Adonis built-in) | Native integration, performant, TypeScript support |
| **Frontend Validation** | VineJS (separate schemas) | Syntax consistency with backend, easy migration to shared later |
| **Shared Types** | `@battlecrm/shared` workspace package | Single source of truth for TypeScript types shared between backend and frontend; implemented from Epic 3 onwards |

**Implementation Notes:**
- Backend: Standard Adonis validators in `app/validators/`
- Frontend: VineJS schemas in `src/schemas/`
- Schemas are similar but intentionally separate (allows UI-specific fields)

### API & Communication Patterns

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **API Style** | REST with Adonis conventions | Simple, well-understood, matches Adonis patterns |
| **API Documentation** | Swagger/OpenAPI (adonis-autoswagger) | AI-assisted development benefits from explicit API spec |
| **Error Format** | Adonis default format | Zero config, VineJS integration, consistent structure |
| **API Versioning** | None for MVP | Single client, no backwards compatibility concerns |

**Error Response Structure (Adonis Default):**
```json
{
  "errors": [
    {
      "message": "The name field is required",
      "field": "name",
      "rule": "required"
    }
  ]
}
```

### Infrastructure & Configuration

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Environment Config** | Single `.env` at monorepo root | DRY, simpler Docker Compose, single source of truth |
| **Backend Logging** | Adonis Logger (Pino) | Built-in, structured JSON, performant |
| **Frontend Logging** | console.log (dev only) | Sufficient for personal tool, no external service needed |
| **External Services** | None for MVP | Sentry/LogTail can be added post-MVP if needed |

**Environment Setup:**
- Root `.env` file with all variables
- Vite config: `envDir: '../../'`
- Adonis: `node ace serve --env-path=../../.env`
- Docker Compose: reads root `.env` by default

### Decision Impact Analysis

**Implementation Sequence:**
1. Monorepo + environment setup (root .env)
2. Backend scaffolding with session auth
3. Frontend scaffolding with TanStack Query setup
4. API routes with Swagger documentation
5. Validation schemas (VineJS both sides)

**Cross-Component Dependencies:**
- Session auth requires CORS + credentials config on both sides
- TanStack Query keys should mirror API route structure
- VineJS schemas should align between front/back (but remain separate)

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (PostgreSQL):**

| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | `prospects`, `interactions`, `funnel_stages` |
| Columns | snake_case | `created_at`, `user_id`, `lead_score` |
| Foreign keys | `{singular_table}_id` | `prospect_id`, `positioning_id` |
| Indexes | `idx_{table}_{columns}` | `idx_prospects_user_id` |

**API Endpoints:**

| Element | Convention | Example |
|---------|------------|---------|
| Routes | snake_case, plural | `/api/prospects`, `/api/funnel_stages` |
| Params | snake_case | `/api/prospects/:prospect_id` |
| Query params | snake_case | `?include_archived=true` |

**Code (TypeScript):**

| Element | Convention | Example |
|---------|------------|---------|
| Component files | PascalCase | `ProspectCard.tsx`, `FunnelCard.tsx` |
| Page components | PascalCase + `Page` suffix | `DashboardPage.tsx`, `ProspectsPage.tsx` |
| Utils/hooks files | camelCase | `useProspects.ts`, `queryKeys.ts` |
| Components | PascalCase | `export function ProspectCard()` |
| Functions/variables | camelCase | `getProspects`, `prospectId` |
| Types | PascalCase + `Type` suffix | `ProspectType`, `BattleType`, `InteractionType` |
| Interfaces | PascalCase | `interface ApiResponse` |
| Constants | SCREAMING_SNAKE | `const MAX_FUNNEL_STAGES = 15` |

**JSON API (request/response):**
- **Request bodies:** snake_case fields (e.g. `funnel_stage_id`, `include_archived`) — matches URL query params convention
- **Response bodies:** camelCase fields — Lucid v3 ORM serializes camelCase by default (e.g. `funnelStageId`, `deletedAt`, `createdAt`)
- ⚠️ **Known divergence from original spec:** Lucid v3 does NOT do snake_case→camelCase transformation for free — it simply outputs whatever the TypeScript property name is (which is camelCase by Adonis/Lucid convention). All frontend code and `@battlecrm/shared` types must use camelCase for response fields.

### Structure Patterns

**Frontend (Feature-Based Organization):**

```
apps/frontend/src/
├── components/                # SHARED components (used by 2+ features)
│   ├── ui/                    # shadcn components
│   └── common/                # Shared custom components
├── hooks/                     # SHARED hooks
├── lib/                       # Utils, API client, queryKeys
├── schemas/                   # Shared VineJS schemas
├── types/                     # Shared TypeScript types
│
├── features/                  # Feature-based organization
│   ├── dashboard/
│   │   ├── DashboardPage.tsx
│   │   ├── DashboardPage.test.tsx
│   │   ├── components/        # Feature-specific components
│   │   └── hooks/             # Feature-specific hooks
│   ├── prospects/
│   │   ├── ProspectsPage.tsx
│   │   ├── ProspectsPage.test.tsx
│   │   ├── components/
│   │   └── hooks/
│   ├── positionings/
│   ├── interactions/
│   └── settings/
│
└── routes.tsx
```

**Rule:**
- Used by **1 feature only** → inside feature folder
- Used by **2+ features** → in shared `src/components/`, `src/hooks/`, etc.

**Backend (Adonis Standard):**

```
apps/backend/
├── app/
│   ├── controllers/           # ProspectsController, BattlesController
│   ├── models/                # Prospect, Interaction, Positioning
│   ├── services/              # BayesianService, CsvImportService
│   └── validators/            # VineJS validators
├── config/
├── database/
│   └── migrations/
└── start/
    └── routes.ts
```

**Tests:**
- Co-located with source files (`ProspectCard.test.tsx` next to `ProspectCard.tsx`)
- E2E tests in separate `tests/e2e/` folder if needed

### Format Patterns

**API Response Formats:**

```json
// GET /api/prospects (list) - wrapped with meta
{
  "data": [...],
  "meta": { "total": 42, "page": 1, "per_page": 20 }
}

// GET /api/prospects/:id (single) - direct
{
  "id": 1,
  "name": "Jean Dupont",
  "company": "ESN Corp"
}

// Errors - Adonis default format
{
  "errors": [
    { "message": "The name field is required", "field": "name", "rule": "required" }
  ]
}
```

**Data Formats:**
- Dates: ISO 8601 strings (`"2026-02-03T14:30:00Z"`)
- Nulls: Explicit `null` (not absent fields)
- JSON response fields: camelCase (Lucid v3 default)
- JSON request fields (body + query params): snake_case

### Process Patterns

**Error Handling:**

| Level | Approach |
|-------|----------|
| Global crashes | React Error Boundary |
| API errors | TanStack Query `onError` + toast notification |
| Form validation | Inline errors under fields (Adonis format) |

**Loading States:**

| Pattern | Convention |
|---------|------------|
| Naming | `isLoading`, `isPending`, `isFetching` (TanStack Query native) |
| Lists | Skeleton loaders |
| Actions | Discrete spinner on button |
| Avoid | Full-page blocking overlays |

**Soft Delete:**

| Action | Behavior |
|--------|----------|
| Delete | Set `deleted_at = now()`, keep in DB |
| Lists | Filter `WHERE deleted_at IS NULL` by default |
| Archives | Toggle includes soft-deleted records |
| Restore | Set `deleted_at = NULL` |

**Optimistic Updates:**
- Used for quick actions (toggle lead score, archive)
- Automatic rollback on API error (TanStack Query built-in)

### Enforcement Guidelines

**All AI Agents MUST:**
- Follow naming conventions exactly (no variations)
- Place files in correct feature folders
- Use snake_case for DB columns and API request fields; camelCase for API response fields
- Add new entity types to `packages/shared/src/types/` FIRST, before coding backend controllers
- Create a serializer function in `apps/backend/app/serializers/` for each entity (provides compile-time API contract verification)
- Import all API types from `@battlecrm/shared` in frontend code (never redefine locally)
- Suffix types with `Type`, pages with `Page`
- Co-locate tests with source files
- Use Adonis default error format
- Implement soft delete (never hard delete)

**Pattern Verification:**
- Biome v2 for linting/formatting (replaces ESLint + Prettier)
- TypeScript strict mode catches type mismatches
- PR review checklist includes pattern compliance

### Shared Package Pattern (`@battlecrm/shared`)

**Purpose:** Single source of truth for TypeScript types used by both `apps/backend` and `apps/frontend`. Provides compile-time verification that API responses match declared contracts.

**Structure:**
```
packages/shared/src/types/
├── auth.ts            # UserType, AuthResponse
├── funnel-stage.ts    # FunnelStageType, FunnelStageListResponse
├── prospect.ts        # ProspectType, ProspectsListResponse, CreateProspectPayload, UpdateProspectPayload, StageTransitionType, ProspectsFilterType
├── positioning.ts     # PositioningType, PositioningListResponse, CreatePositioningPayload, UpdatePositioningPayload
└── ...                # One file per domain entity
```

**Implementation workflow (mandatory for every new entity):**
1. **Add type to shared first** — create `packages/shared/src/types/{entity}.ts`, export from `index.ts`
2. **Build shared** — `pnpm --filter @battlecrm/shared build` (generates `.d.ts` files)
3. **Create backend serializer** — `apps/backend/app/serializers/{entity}.ts` with `serialize{Entity}(model: Model): EntityType` — TypeScript enforces the shape
4. **Use serializer in controller** — `return response.ok(serializeEntity(model))` — no raw `.toJSON()` or inline object literals
5. **Import from shared in frontend** — `import type { EntityType } from '@battlecrm/shared'` in feature `lib/api.ts` and components

**Rules:**
- Frontend NEVER redefines types locally or re-exports from `lib/api.ts` — import directly from `@battlecrm/shared`
- Backend NEVER returns raw Lucid model `.toJSON()` — always use the serializer
- VineJS schemas are NOT shared (backend schemas are stricter; frontend schemas are UX-focused) — each app defines its own
- `withCount('relation', cb)` result is in `$extras.relation_count` (string) — serializer maps it with `Number($extras.relation_count ?? 0)`

**Technical details:**
- Compiled to `.d.ts` only (`emitDeclarationOnly: true`) — no runtime code
- TypeScript resolves types via `exports.types` in package.json (no `paths` config needed in apps)
- `rootDir` constraint in AdonisJS backend (no `.ts` source files outside app dir) is bypassed by using compiled `.d.ts`
- NodeNext moduleResolution requires `.js` extensions in `index.ts` re-exports

## Project Structure & Boundaries

### Complete Project Directory Structure

```
BattleCRM/
├── _bmad/                           # BMAD installation
├── _bmad-output/                    # Planning artifacts
│
├── .env                             # Root environment variables
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json                     # Root scripts
├── pnpm-workspace.yaml
├── README.md
│
├── apps/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/          # SHARED (ui/, common/)
│   │   │   ├── hooks/               # SHARED hooks
│   │   │   ├── lib/                 # api.ts, queryKeys.ts, utils.ts
│   │   │   ├── schemas/             # VineJS validation schemas (frontend-only, UX validation)
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/       # FunnelCard, PerformanceMatrix
│   │   │   │   ├── prospects/       # CsvImportWizard
│   │   │   │   ├── positionings/
│   │   │   │   ├── interactions/
│   │   │   │   └── settings/        # FunnelConfig
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── routes.tsx
│   │   ├── package.json
│   │   └── [config files per official docs]
│   │
│   └── backend/
│       ├── app/
│       │   ├── controllers/
│       │   ├── models/
│       │   ├── serializers/         # serialize*() functions — map Lucid instances to @battlecrm/shared types
│       │   ├── services/            # BayesianService, CsvImportService
│       │   ├── validators/          # VineJS validators (backend-only, strict validation)
│       │   └── middleware/
│       ├── config/
│       ├── database/migrations/
│       ├── start/routes.ts
│       ├── tests/
│       ├── package.json
│       └── [config files per official docs]
│
└── packages/
    └── shared/                      # @battlecrm/shared — single source of truth for TypeScript types
```

**Note:** Specific config files (vite.config.ts, tailwind.config.js, etc.) to be determined during implementation based on current official documentation.

### Requirements to Structure Mapping

| Feature | Frontend Location | Backend Location |
|---------|-------------------|------------------|
| Dashboard / Performance Matrix | `features/dashboard/` | `services/bayesian_service.ts`, `controllers/battles_controller.ts` |
| Prospect Management | `features/prospects/` | `controllers/prospects_controller.ts`, `models/prospect.ts` |
| Positioning Management | `features/positionings/` | `controllers/positionings_controller.ts`, `models/positioning.ts` |
| Interaction Management | `features/interactions/` | `controllers/interactions_controller.ts`, `models/interaction.ts` |
| Battle Management (A/B Testing) | `features/dashboard/` | `services/battle_service.ts`, `controllers/battles_controller.ts` |
| CSV Import | `features/prospects/components/CsvImportWizard/` | `services/csv_import_service.ts`, `controllers/csv_import_controller.ts` |
| Funnel Configuration | `features/settings/` | `controllers/funnel_stages_controller.ts` |
| Authentication | `features/auth/` | `controllers/auth_controller.ts`, `middleware/auth_middleware.ts` |

### API Boundaries

| Endpoint Group | Purpose |
|----------------|---------|
| `/api/auth/*` | Login, logout, session management |
| `/api/prospects/*` | CRUD + archive + restore |
| `/api/positionings/*` | CRUD positioning variants |
| `/api/interactions/*` | CRUD + timeline |
| `/api/battles/*` | Battle management per funnel stage |
| `/api/funnel_stages/*` | Funnel configuration |
| `/api/import/csv` | CSV import with duplicate detection |

### Data Flow

```
Frontend (React)              Backend (Adonis)              Database
────────────────              ────────────────              ────────
TanStack Query                Controllers                   PostgreSQL
    │                              │                        (Docker, user_id isolated)
    │──── HTTP/REST ──────────────►│                              │
    │     (credentials: include)   │                              │
    │                              ▼                              │
    │                         Services                            │
    │                    (Bayesian, Battle,                       │
    │                     CsvImport, etc.)                        │
    │                              │                              │
    │                              ▼                              │
    │                         Lucid ORM ─────────────────────────►│
    │                              │                              │
    ◄────── JSON Response ─────────┘                              │
```

### Integration Points

**Session Auth Flow:**
- Frontend: `credentials: 'include'` on all fetch calls
- Backend: Adonis session middleware + CORS config
- Cookie: httpOnly, secure, same-site

**Soft Delete Pattern:**
- All models include `deleted_at` column
- Controllers filter by default, include archived on request
- Frontend toggle "Show archives" passes `?include_archived=true`

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices work together without conflicts:
- Sessions + React SPA: Compatible (same-origin, credentials: include)
- TanStack Query + REST Adonis: Standard pattern, works seamlessly
- VineJS both sides: Same syntax, easy future migration to shared
- pnpm workspaces + Vite/Adonis: Both support ES modules, TypeScript

**Pattern Consistency:**
- Naming conventions consistent (snake_case DB/API, camelCase code, PascalCase components)
- Feature-based structure aligns with TanStack Query per-feature hooks
- Soft delete pattern implemented consistently across all entities

**Structure Alignment:**
- Project structure supports all architectural decisions
- Clear boundaries between frontend features and backend services
- Integration points well-defined (REST endpoints, session auth)

### Requirements Coverage Validation ✅

**Functional Requirements:** 75/75 covered
- All 8 FR categories have corresponding frontend features and backend services
- Complex features (Bayesian, Battles, CSV Import) have dedicated services
- FR65-FR75: Browser extension covered (see Epic 8 section below)

**Non-Functional Requirements:** 74/74 addressed
- Performance: Vite optimization, TanStack Query caching
- Security: Session auth, CORS, httpOnly cookies; Bearer tokens + message passing isolation for extension
- Data Integrity: Soft delete, VineJS validation, Adonis transactions
- Accessibility: shadcn/ui WCAG compliance
- Maintainability: TypeScript strict, documented patterns
- NFR68-NFR74: Browser extension NFRs covered (see Epic 8 section below)

### Implementation Readiness Validation ✅

**Decision Completeness:**
- All critical decisions documented with rationale
- Technology choices specified (versions to be confirmed at implementation)
- Patterns comprehensive with examples

**Structure Completeness:**
- Complete directory structure defined
- Feature-to-folder mapping explicit
- Config files deferred to official docs (appropriate)

**Pattern Completeness:**
- Naming conventions comprehensive
- Error handling patterns defined
- Soft delete pattern specified
- Loading states documented

### Gap Analysis Results

**Critical Gaps:** None

**Important Gaps (to address during implementation):**
- Bayesian calculation formulas: Define exact statistical approach when implementing BayesianService
- Swagger/OpenAPI setup: Consult adonis-autoswagger docs during backend setup

**Nice-to-Have Gaps (post-MVP):**
- E2E testing strategy
- CI/CD pipeline details
- Monitoring/alerting setup

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (64 FRs, 67 NFRs)
- [x] Scale and complexity assessed (Medium)
- [x] Technical constraints identified (TypeScript strict, no legacy browsers)
- [x] Cross-cutting concerns mapped (RLS, soft delete, validation)

**✅ Architectural Decisions**
- [x] Critical decisions documented (auth, state, validation, etc.)
- [x] Technology stack fully specified
- [x] Integration patterns defined (REST, sessions, RLS)
- [x] Performance considerations addressed (TanStack Query, Vite)

**✅ Implementation Patterns**
- [x] Naming conventions established (DB, API, code)
- [x] Structure patterns defined (feature-based frontend, Adonis standard backend)
- [x] Communication patterns specified (REST, JSON snake_case)
- [x] Process patterns documented (errors, loading, soft delete)

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** ✅ READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

**Key Strengths:**
- Coherent technology choices (React/Vite + Adonis + PostgreSQL/Docker)
- Clear separation of concerns (frontend/backend/database)
- Well-defined patterns preventing AI agent conflicts
- Feature-based organization scales well
- Proven stack with strong documentation
- Fully self-contained deployment (no external DB dependency)

**Areas for Future Enhancement:**
- Shared types package (evaluate after initial development)
- E2E testing framework selection
- CI/CD pipeline configuration
- Performance monitoring setup

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Consult official documentation for specific config files
- Refer to this document for all architectural questions

**First Implementation Priority:**
1. Initialize monorepo with pnpm workspace
2. Scaffold frontend with Vite + React + TypeScript
3. Scaffold backend with Adonis.js API kit
4. Configure root .env and Docker Compose (including PostgreSQL service)
5. Run database migrations to create schema

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2026-02-03
**Document Location:** `_bmad-output/planning-artifacts/architecture.md`

### Final Architecture Deliverables

**Complete Architecture Document**
- All architectural decisions documented with rationale
- Implementation patterns ensuring AI agent consistency
- Complete project structure with feature-based organization
- Requirements to architecture mapping (64 FRs, 67 NFRs)
- Validation confirming coherence and completeness

**Implementation Ready Foundation**
- 8 core architectural decisions made (auth, state, validation, routing, etc.)
- Comprehensive naming and structure patterns defined
- 6 main feature areas specified (dashboard, prospects, positionings, interactions, settings, auth)
- 131 requirements fully supported

**AI Agent Implementation Guide**
- Technology stack: React/Vite + Adonis.js + PostgreSQL (Docker) + pnpm workspaces
- Consistency rules preventing implementation conflicts
- Project structure with clear boundaries (feature-based frontend, Adonis standard backend)
- Integration patterns (REST, sessions, RLS)

### Quality Assurance Checklist

**✅ Architecture Coherence**
- [x] All decisions work together without conflicts
- [x] Technology choices are compatible
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**✅ Requirements Coverage**
- [x] All 64 functional requirements are supported
- [x] All 67 non-functional requirements are addressed
- [x] Cross-cutting concerns are handled (RLS, soft delete, validation)
- [x] Integration points are defined

**✅ Implementation Readiness**
- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts
- [x] Structure is complete and unambiguous
- [x] Feature-to-folder mapping is explicit

---

**Architecture Status:** ✅ READY FOR IMPLEMENTATION

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.

---

## Browser Extension Architecture (Epic 8)

_Added: 2026-03-01 — Validated against current docs (WXT, Chrome MV3, AdonisJS 6 auth, Firefox MV3)._

### Technology Stack

| Layer | Choice | Validation |
|-------|--------|------------|
| Framework | **WXT** (Vite-based) | ✅ Leader incontesté en 2026 — bundle ~400KB (43% plus léger que Plasmo), React module v1.1.5, maintenance active |
| UI | React + Tailwind (même config que `apps/frontend`) | ✅ Zéro nouvelle dépendance, mêmes design tokens |
| Manifest | V3 | ✅ Supporté Chrome + Firefox via WXT |
| Permissions | `storage`, `activeTab`, `scripting` | ✅ Minimum nécessaire |
| Host permissions | `*://www.linkedin.com/*` | ✅ Scope réduit au strict nécessaire |

### Backend : AdonisJS Opaque Access Tokens (Built-in)

**Décision : Utiliser le système built-in `@adonisjs/auth` Access Tokens Guard plutôt qu'une table `extension_tokens` custom.**

Le brainstorming proposait une table custom. AdonisJS 6 fournit nativement tout ce dont on a besoin :

| Feature | Built-in AdonisJS |
|---------|------------------|
| Génération du token | ✅ Prefix + random string + CRC32 checksum |
| Stockage | ✅ Haché en DB (jamais brut) |
| `last_used_at` | ✅ Colonne built-in, mise à jour auto |
| `expires_at` | ✅ Configurable à la génération |
| Révocation | ✅ Delete from DB |
| Nom du token | ✅ Champ `name` supporté |
| Abilities/scopes | ✅ Supporté (pour futur découpage de permissions) |

**Implémentation :**
- Table standard : `auth_access_tokens` avec `type = 'extension_token'`
- Pas de migration custom pour la structure du token — Adonis la génère
- Guard séparé `extension` dans `config/auth.ts` utilisant `AccessTokensGuard`
- Révocation : `user.related('tokens').query().where('id', tokenId).delete()`

**Pourquoi c'est mieux qu'une table custom :**
- Battle-tested, code generation et hashing éprouvés
- Patterns Adonis standards (familier pour les futurs devs)
- Réduction du code à maintenir

### Token Hashing : bcrypt vs HMAC-SHA256

Le brainstorming proposait bcrypt. **Verdict :**

- bcrypt est conçu pour les mots de passe (faible entropie, choisis par des humains)
- Les tokens API sont déjà haute entropie — le bcrypt work factor ajoute de la latence sans bénéfice sécurité
- bcrypt a un **bug de troncature à 72 bytes** (tokens > 72 bytes silencieusement tronqués)
- HMAC-SHA256 est plus rapide et approprié pour des tokens aléatoires

**Décision :** Le système built-in Adonis utilise bcrypt-equivalent. Pour notre volume (personal tool), la performance est acceptable. **Si performance issue à l'usage, migrer vers HMAC-SHA256 avec secret key.** Ne pas sur-optimiser dès le MVP.

### Stockage du Token Côté Extension : `chrome.storage.local`

**Décision : `chrome.storage.local` — avec isolation via message passing.**

| Storage | Persistance | Accessible content scripts |
|---------|------------|---------------------------|
| `chrome.storage.local` | ✅ Survive aux redémarrages | ⚠️ Oui, par défaut |
| `chrome.storage.session` | ❌ Effacé quand le service worker s'arrête | ✅ Non, par défaut |

`chrome.storage.session` garantit l'isolation mais force l'utilisateur à se reconnecter après chaque redémarrage du navigateur — incompatible avec NFR73 (persistance entre sessions).

**`chrome.storage.local` est le bon choix, mais avec la règle suivante :**

> **Règle critique :** Le content script ne lit JAMAIS directement `chrome.storage.local`. Tout appel API nécessitant le token passe par message passing vers le service worker.

```
Content Script  →  chrome.runtime.sendMessage()  →  Service Worker  →  API call avec Bearer token
```

**Pourquoi c'est sécurisé :** Le content script tourne dans le contexte de linkedin.com mais ne peut pas exfiltrer le token — il ne le connaît jamais. Seul le service worker (contexte trusted) accède au storage et fait les appels API.

### Cycle de Vie du Service Worker (MV3)

**Contrainte MV3 :** Le service worker se termine après **30 secondes d'inactivité**. Les variables globales sont perdues.

**Impact sur notre archi :** Notre cas d'usage est **event-driven**, pas persistant :
- Détection de profil → event → appel API (< 1s) → service worker peut se terminer ✅
- Aucun état critique en mémoire — tout est dans `chrome.storage.local`

**Règle :** Ne jamais stocker d'état dans les variables globales du service worker. Utiliser `chrome.storage.local` pour tout état devant survivre au redémarrage.

**Pas besoin du workaround Offscreen Document** — notre use case ne nécessite pas un service worker persistant.

### Détection de Navigation LinkedIn SPA

**Décision : Navigation API en primaire + MutationObserver en fallback.**

La Navigation API est maintenant stable sur Chrome et Firefox (Interop 2025, janvier 2026). C'est la méthode recommandée pour détecter les changements de route SPA.

```typescript
// Primaire : Navigation API (stable Jan 2026, Chrome + Firefox)
navigation.addEventListener('navigate', (event) => {
  const url = new URL(event.destination.url)
  if (url.pathname.match(/^\/in\/[^/]+\/?$/)) {
    triggerProspectCheck(normalizeLinkedInUrl(url.href))
  }
})

// Fallback : MutationObserver (support universel)
// Utilisé en safety net pour les edge cases où Navigation API ne fire pas
```

**Normalisation de l'URL :** Toujours normaliser avant le check (supprimer les query params, trailing slash) pour éviter les faux doublons :
```typescript
// linkedin.com/in/john-doe?utm_source=... → linkedin.com/in/john-doe
function normalizeLinkedInUrl(url: string): string {
  const parsed = new URL(url)
  return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`
}
```

### CORS Configuration

**Approche :** Variable d'environnement `EXTENSION_ORIGINS` dans le `.env` racine.

```typescript
// config/cors.ts
origin: (requestOrigin) => {
  const allowedOrigins = [
    env.get('FRONTEND_URL'),
    ...env.get('EXTENSION_ORIGINS', '').split(',').filter(Boolean)
  ]
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : false
}
```

**Points clés :**
- Extension Bearer tokens (pas de cookies) → pas besoin de `credentials: true` pour les endpoints `/api/extension/*`
- La config CORS existante pour la session auth frontend reste inchangée
- En dev : fixer l'ID de l'extension via le champ `key` dans `wxt.config.ts` pour éviter de mettre à jour `EXTENSION_ORIGINS` à chaque rechargement

**`.env` example :**
```
EXTENSION_ORIGINS=chrome-extension://abcdefghijklmnopqrstuvwxyz123456,moz-extension://uuid-here
```

### Gotcha : `activeTab` + `chrome.windows.create`

**Comportement documenté :** Quand le popup est ouvert via `chrome.windows.create` (et non le standard action popup), la permission `activeTab` n'est **pas** automatiquement accordée à la nouvelle fenêtre.

**Impact sur notre archi :** Aucun — notre flow n'a pas besoin d'injecter des scripts depuis la fenêtre flottante. Le content script est déclaré dans le manifest et injecté au chargement de page (pas via `scripting.executeScript()` depuis la fenêtre). La fenêtre flottante communique avec le service worker via message passing uniquement.

**Garder `activeTab` dans les permissions** pour la flexibilité future, mais ne pas en dépendre depuis la fenêtre flottante.

### Structure `apps/extension/`

```
apps/extension/
├── src/
│   ├── entrypoints/
│   │   ├── background.ts          # Service worker — message handler, API calls, badge updates
│   │   ├── content.ts             # Content script — détection profil LinkedIn, scraping DOM
│   │   ├── popup/                 # Action popup (état neutre + settings)
│   │   │   ├── index.html
│   │   │   └── App.tsx
│   │   └── panel/                 # Fenêtre flottante add/edit (chrome.windows.create)
│   │       ├── index.html
│   │       └── App.tsx
│   ├── components/
│   │   ├── AuthForm.tsx           # Login screen
│   │   ├── ProspectForm.tsx       # Formulaire ajout/édition
│   │   └── ProspectCard.tsx       # Mode lecture (prospect existant)
│   ├── lib/
│   │   ├── api.ts                 # Client API typé (fetch + Bearer)
│   │   ├── storage.ts             # Wrapper chrome.storage.local
│   │   └── linkedin.ts            # Scraping DOM LinkedIn (h1, headline, experience)
│   └── types/
│       └── index.ts               # Types spécifiques à l'extension
├── public/
│   └── icons/                     # 16, 32, 48, 128px (format WebP ou PNG)
├── wxt.config.ts
├── package.json
└── tsconfig.json
```

**WXT Entrypoints :**
- `background.ts` → compilé en service worker (`background.service_worker`)
- `content.ts` → injecté sur `*://www.linkedin.com/in/*`
- `popup/` → action popup par défaut (état neutre / settings)
- `panel/` → fenêtre flottante, ouverte via `chrome.windows.create`

### Routes API Extension

| Méthode | Endpoint | Auth | Rôle |
|---------|----------|------|------|
| POST | `/api/extension/auth/login` | ∅ | Login, retourne token brut (une seule fois) |
| POST | `/api/extension/auth/logout` | Bearer | Révoque le token |
| GET | `/api/extension/prospects/check` | Bearer | Vérifie l'existence par `linkedin_url` |
| POST | `/api/extension/prospects` | Bearer | Crée un prospect (auto premier funnel stage) |
| PATCH | `/api/extension/prospects/:id` | Bearer | Met à jour un prospect existant |

**Localisation dans le backend :**

```
app/
├── controllers/
│   └── extension/
│       ├── auth_controller.ts
│       └── prospects_controller.ts
├── middleware/
│   └── bearer_token_middleware.ts  # Valide token Adonis opaque
└── ...

start/routes.ts
└── router.group(() => { ... }).prefix('/api/extension')
```

### Index DB

```sql
-- Lookup rapide pour le check prospect (NFR72 : < 1s)
CREATE UNIQUE INDEX idx_prospects_user_linkedin
  ON prospects (user_id, linkedin_url)
  WHERE linkedin_url IS NOT NULL AND deleted_at IS NULL;

-- Index pour la validation des tokens
-- (géré par Adonis sur auth_access_tokens, déjà prévu dans le built-in)
```

### Flux de Données

```
LinkedIn Page
    │
    │ Navigation API 'navigate' event
    ▼
Content Script (content.ts)
    │ chrome.runtime.sendMessage({ type: 'CHECK_PROSPECT', url })
    │ chrome.runtime.sendMessage({ type: 'GET_PANEL_DATA' })
    ▼
Service Worker (background.ts)
    │ chrome.storage.local.get('token', 'baseUrl')
    │ fetch(baseUrl + '/api/extension/prospects/check?linkedin_url=...')
    ▼
Backend Adonis
    │ BearerTokenMiddleware → validate token → authenticate user
    │ ProspectsController → query with user_id + linkedin_url index
    ▼
Response → Service Worker → chrome.action.setBadgeText() + setBadgeBackgroundColor()

// Sur clic icône :
Service Worker → chrome.windows.create({ url: 'panel/index.html', type: 'popup' })
Panel App (panel/App.tsx) → chrome.runtime.sendMessage('GET_PANEL_DATA')
                         → Service Worker → retourne { found, prospect, scrapedData }
```

### Couverture des Requirements

| Requirement | Couverture | Notes |
|------------|-----------|-------|
| FR65 (auth) | ✅ | Adonis opaque tokens |
| FR66 (détection profil) | ✅ | Content script + host permissions manifest |
| FR67 (check silencieux) | ✅ | Navigation API → message passing → service worker |
| FR68 (badge) | ✅ | `chrome.action.setBadgeText()` + `setBadgeBackgroundColor()` |
| FR69 (formulaire pré-rempli) | ✅ | `chrome.windows.create` + scraping DOM |
| FR70 (warning prospect existant) | ✅ | Réponse `check` endpoint + panel READ mode |
| FR71 (ajout prospect) | ✅ | `POST /api/extension/prospects` |
| FR72 (mise à jour) | ✅ | `PATCH /api/extension/prospects/:id` |
| FR73 (persistance token) | ✅ | `chrome.storage.local` |
| FR74 (config URL instance) | ✅ | Settings UI dans action popup |
| FR75 (logout + révocation) | ✅ | `POST /api/extension/auth/logout` + delete token DB |
| NFR68 (Chrome + Firefox) | ✅ | WXT cross-browser build |
| NFR69 (sécurité stockage) | ✅ | `chrome.storage.local` + règle message passing |
| NFR70 (token jamais affiché) | ✅ | One-time display, jamais stocké brut |
| NFR71 (fenêtre reste ouverte) | ✅ | `chrome.windows.create` confirmé |
| NFR72 (check < 1s) | ✅ | Index `(user_id, linkedin_url)` |
| NFR73 (dégradation gracieuse) | ✅ | Badge neutre si serveur inaccessible, pas de crash |
| NFR74 (SPA navigation) | ✅ | Navigation API primary + MutationObserver fallback |
