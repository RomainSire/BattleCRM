---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-02-03'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
documentCounts:
  prdCount: 1
  uxDesignCount: 1
  briefCount: 0
  researchCount: 0
  projectDocsCount: 0
  projectContextCount: 0
workflowType: 'architecture'
project_name: 'tiny-crm'
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
| User Management | FR51-FR56 | Supabase Auth + RLS multi-tenant |
| Battle Management | FR57-FR64 | **Élevée** - A/B test state machine per funnel stage |

**Non-Functional Requirements:**

67 NFRs définissant les contraintes qualité :

| Catégorie | NFRs | Impact Architectural |
|-----------|------|---------------------|
| Performance | NFR1-NFR9 | Page load <2s, bundle <300KB, CSV import <5min |
| Security | NFR10-NFR20 | Supabase RLS, HTTPS, CSRF, user isolation |
| Data Integrity | NFR21-NFR28 | **Critique** - Transactions, soft delete, zero bug policy |
| Accessibility | NFR29-NFR40 | WCAG 2.1 Level A, shadcn/ui built-in |
| Usability | NFR41-NFR48 | 3-click rule, <1min logging, pre-fill |
| Maintainability | NFR49-NFR61 | TypeScript strict, tests, Docker |
| Compatibility | NFR62-NFR67 | Chrome/Firefox latest, responsive |

**Scale & Complexity:**

- Primary domain: **Full-stack Web SPA**
- Complexity level: **Medium** (unique business logic, limited scope)
- Estimated architectural components: **~15-20** (3 views + analytics + auth + config + import)
- Multi-tenancy: **Yes** (via Supabase RLS, low user count)
- Real-time: **No** (standard request/response)
- Compliance: **No** (personal tool)

### Technical Constraints & Dependencies

**Stack Decisions (from PRD - non-negotiable):**

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React 18+ / Vite | Fast dev, optimized builds |
| Styling | Tailwind CSS + shadcn/ui | Modern, accessible, Tailwind-native |
| Backend | Adonis.js | TypeScript, batteries-included |
| Database | Supabase (PostgreSQL) | Auth + RLS + managed infra |
| Deployment | Docker + Docker Compose | Consistent envs, VPS-ready |
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
| **Multi-tenant Isolation** | All queries | Supabase RLS policies on all tables |
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

1. **PRD Alignment** - Stack already defined (React/Vite + Adonis.js + Supabase)
2. **Separation of Concerns** - Frontend and backend evolve independently
3. **Tool Currency** - Each tool can be updated independently
4. **No Lock-in** - Not dependent on opinionated framework decisions
5. **Simplicity** - pnpm workspaces native is sufficient; Turborepo adds complexity without benefit for solo dev

### Initialization Commands

**Note:** Commands assume execution from existing `tiny-crm/` project root (already contains BMAD structure).

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
npm init adonisjs@latest backend -- --kit=api --db=postgres --auth-guard=access_tokens
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
- PostgreSQL database driver (for Supabase)
- Access tokens authentication guard
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
tiny-crm/
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
    └── shared/                  # Optional: DTOs, types, schemas
        ├── src/
        │   ├── types/
        │   └── schemas/
        └── package.json
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
- Shared types package (evaluate after initial development)
- External logging service (Sentry, etc.)
- Advanced caching strategies

### Authentication & Security

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Auth Method** | Adonis Sessions + httpOnly cookies | Simpler than JWT for same-origin SPA, no refresh token management, secure by default |
| **Auth Provider** | Supabase Auth + Adonis session guard | Supabase handles user storage, Adonis handles session |
| **Authorization** | Supabase RLS + backend middleware | Defense in depth - RLS at DB level, middleware at API level |

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
| **Shared Types** | Deferred (not for MVP) | Evaluate after initial development if duplication becomes painful |

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

**Database (PostgreSQL/Supabase):**

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
- snake_case for all fields (matches DB, no transformation needed)

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
- JSON fields: snake_case

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
- Use snake_case for all API/DB fields
- Suffix types with `Type`, pages with `Page`
- Co-locate tests with source files
- Use Adonis default error format
- Implement soft delete (never hard delete)

**Pattern Verification:**
- ESLint rules for naming conventions
- TypeScript strict mode catches type mismatches
- PR review checklist includes pattern compliance

## Project Structure & Boundaries

### Complete Project Directory Structure

```
tiny-crm/
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
│   │   │   ├── schemas/             # VineJS schemas
│   │   │   ├── types/               # TypeScript types (*Type)
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
│       │   ├── services/            # BayesianService, CsvImportService
│       │   ├── validators/
│       │   └── middleware/
│       ├── config/
│       ├── database/migrations/
│       ├── start/routes.ts
│       ├── tests/
│       ├── package.json
│       └── [config files per official docs]
│
└── packages/shared/                 # Optional (if needed later)
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
TanStack Query                Controllers                   Supabase
    │                              │                        (PostgreSQL + RLS)
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

**Functional Requirements:** 64/64 covered
- All 8 FR categories have corresponding frontend features and backend services
- Complex features (Bayesian, Battles, CSV Import) have dedicated services

**Non-Functional Requirements:** 67/67 addressed
- Performance: Vite optimization, TanStack Query caching
- Security: Session auth, RLS, CORS, httpOnly cookies
- Data Integrity: Soft delete, VineJS validation, Adonis transactions
- Accessibility: shadcn/ui WCAG compliance
- Maintainability: TypeScript strict, documented patterns

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
- Coherent technology choices (React/Vite + Adonis + Supabase)
- Clear separation of concerns (frontend/backend/database)
- Well-defined patterns preventing AI agent conflicts
- Feature-based organization scales well
- Proven stack with strong documentation

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
4. Configure root .env and Docker Compose
5. Set up Supabase project and RLS policies

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
- Technology stack: React/Vite + Adonis.js + Supabase + pnpm workspaces
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

