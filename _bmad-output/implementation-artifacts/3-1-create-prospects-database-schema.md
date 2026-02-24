# Story 3.1: Create Prospects Database Schema

Status: review

<!-- Ultimate Context Engine Analysis: 2026-02-24 -->
<!-- Epic 3: Prospect Management — first story of the epic -->

## Story

As a developer,
I want a prospects table with proper schema and relationships,
So that users can store and manage their prospect data.

## Acceptance Criteria

1. **AC1 (Migration):** Running the migration creates a `prospects` table with all specified columns: `id` (uuid, PK), `user_id` (uuid, FK to users, CASCADE), `funnel_stage_id` (uuid, FK to funnel_stages, NOT NULL), `positioning_id` (uuid, nullable, no FK constraint yet — positionings table doesn't exist until Epic 4), `name` (varchar, required), `company` (varchar, optional), `linkedin_url` (varchar, optional), `email` (varchar, optional), `phone` (varchar, optional), `title` (varchar, optional), `notes` (text, optional), `created_at`, `updated_at`, `deleted_at`.
2. **AC2 (User isolation scope):** The `Prospect` Lucid model has a `static forUser = scope(...)` that filters by `user_id` — same pattern as `FunnelStage`. All queries in Epic 3+ MUST use this scope for user isolation (NOT database-level RLS).
3. **AC3 (Indexes):** Indexes exist on `(user_id, deleted_at)` (efficient per-user soft-delete filtering) and `(user_id, funnel_stage_id)` (efficient filtering by stage — FR6).
4. **AC4 (Migration runs cleanly):** `ENV_PATH=../../ node ace migration:run` from `apps/backend/` completes with no errors. The `prospects` table is visible in the database.
5. **AC5 (Lint + type check):** `pnpm biome check --write .` from root passes with 0 errors; `pnpm --filter @battlecrm/backend type-check` passes with 0 errors.

## Tasks / Subtasks

- [x] **Task 1: Create migration `0003_create_prospects_table.ts`** (AC1, AC3, AC4)
  - [x] 1.1 Create file `apps/backend/database/migrations/0003_create_prospects_table.ts` following the `0002_create_funnel_stages_table.ts` pattern
  - [x] 1.2 Add `id` column: `table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)`
  - [x] 1.3 Add `user_id`: `table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')`
  - [x] 1.4 Add `funnel_stage_id`: `table.uuid('funnel_stage_id').notNullable().references('id').inTable('funnel_stages')` (no ON DELETE — stages are soft-deleted, FK row always exists)
  - [x] 1.5 Add `positioning_id`: `table.uuid('positioning_id').nullable()` — **NO FK constraint** (positionings table created in Epic 4, Story 4.1; FK added then)
  - [x] 1.6 Add string columns: `name` (varchar 255, notNullable), `company` (varchar 255, nullable), `linkedin_url` (varchar 500, nullable), `email` (varchar 255, nullable), `phone` (varchar 50, nullable), `title` (varchar 255, nullable)
  - [x] 1.7 Add `notes` column: `table.text('notes').nullable()`
  - [x] 1.8 Add timestamps: `created_at` (notNullable), `updated_at` (nullable), `deleted_at` (nullable)
  - [x] 1.9 Add index `idx_prospects_user_deleted` on `(user_id, deleted_at)` via `table.index(['user_id', 'deleted_at'], 'idx_prospects_user_deleted')`
  - [x] 1.10 Add index `idx_prospects_user_stage` on `(user_id, funnel_stage_id)` via `table.index(['user_id', 'funnel_stage_id'], 'idx_prospects_user_stage')`
  - [x] 1.11 Implement `down()` method: drop indexes then `dropTable`

- [x] **Task 2: Create Prospect Lucid model** (AC2)
  - [x] 2.1 Create file `apps/backend/app/models/prospect.ts` following the `funnel_stage.ts` pattern exactly
  - [x] 2.2 Extend `compose(BaseModel, SoftDeletes)` — same as FunnelStage
  - [x] 2.3 Declare all `@column()` fields: `id`, `userId`, `funnelStageId`, `positioningId`, `name`, `company`, `linkedinUrl`, `email`, `phone`, `title`, `notes`
  - [x] 2.4 Declare `@column.dateTime()` fields: `createdAt` (autoCreate), `updatedAt` (autoCreate + autoUpdate, nullable), `deletedAt` (nullable)
  - [x] 2.5 Add `static forUser = scope((query, userId: string) => { query.where('user_id', userId) })`
  - [x] 2.6 Add `@belongsTo(() => User) declare user: BelongsTo<typeof User>`
  - [x] 2.7 Add `@belongsTo(() => FunnelStage) declare funnelStage: BelongsTo<typeof FunnelStage>`
  - [x] 2.8 Skipped — Positioning model does not exist yet (Epic 4)

- [x] **Task 3: Run migration and verify** (AC4)
  - [x] 3.1 PostgreSQL was already running
  - [x] 3.2 Migration ran: `ENV_PATH=../../ node ace migration:run` → "Migrated in 116 ms" ✅
  - [x] 3.3 Migration confirmed successful — no errors

- [x] **Task 4: Lint and type check** (AC5)
  - [x] 4.1 `pnpm biome check --write .` → "Checked 99 files in 99ms. Fixed 1 file." (migration reformatted — expected) ✅
  - [x] 4.2 `pnpm --filter @battlecrm/backend type-check` → 0 errors ✅

---

## Dev Notes

### CRITICAL: Follow FunnelStage Patterns Exactly

Story 3.1 is a **pure backend DB schema story** — no frontend changes, no API endpoints, no tests. The only deliverables are:
1. `0003_create_prospects_table.ts` migration
2. `apps/backend/app/models/prospect.ts` Lucid model

Both must follow the exact same patterns established in Epic 2 (Stories 2.1).

---

### CRITICAL: Migration File — Complete Implementation

File path: `apps/backend/database/migrations/0003_create_prospects_table.ts`

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'prospects'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table
        .uuid('funnel_stage_id')
        .notNullable()
        .references('id')
        .inTable('funnel_stages')
        // No onDelete: funnel_stages are only soft-deleted — FK row always exists in DB
        // If a stage is archived (deleted_at set), its DB row persists, FK reference remains valid

      // positioning_id: nullable, NO FK constraint yet
      // Positionings table created in Epic 4 (Story 4.1).
      // FK will be added in migration 0005 (or the positionings migration) via ALTER TABLE:
      //   ALTER TABLE prospects ADD CONSTRAINT fk_prospects_positioning
      //   FOREIGN KEY (positioning_id) REFERENCES positionings(id) ON DELETE SET NULL
      table.uuid('positioning_id').nullable()

      table.string('name', 255).notNullable()
      table.string('company', 255).nullable()
      table.string('linkedin_url', 500).nullable()
      table.string('email', 255).nullable()
      table.string('phone', 50).nullable()
      table.string('title', 255).nullable()
      table.text('notes').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.timestamp('deleted_at').nullable()

      // Index for efficient per-user soft-delete filtering (used by forUser scope + default list queries)
      table.index(['user_id', 'deleted_at'], 'idx_prospects_user_deleted')

      // Index for filtering prospects by funnel stage (FR6: filter by funnel stage)
      table.index(['user_id', 'funnel_stage_id'], 'idx_prospects_user_stage')
    })
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS idx_prospects_user_stage')
    this.schema.raw('DROP INDEX IF EXISTS idx_prospects_user_deleted')
    this.schema.dropTable(this.tableName)
  }
}
```

---

### CRITICAL: Prospect Model — Complete Implementation

File path: `apps/backend/app/models/prospect.ts`

```typescript
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { SoftDeletes } from 'adonis-lucid-soft-deletes'
import type { DateTime } from 'luxon'
import FunnelStage from '#models/funnel_stage'
import User from '#models/user'

export default class Prospect extends compose(BaseModel, SoftDeletes) {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare funnelStageId: string

  @column()
  declare positioningId: string | null

  @column()
  declare name: string

  @column()
  declare company: string | null

  @column()
  declare linkedinUrl: string | null

  @column()
  declare email: string | null

  @column()
  declare phone: string | null

  @column()
  declare title: string | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @column.dateTime()
  declare deletedAt: DateTime | null

  // Primary user isolation mechanism — use in ALL prospect queries
  static forUser = scope((query, userId: string) => {
    query.where('user_id', userId)
  })

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => FunnelStage)
  declare funnelStage: BelongsTo<typeof FunnelStage>
}
```

**Note on `positioningId`:** Type is `string | null` (not `string`). The FK constraint will be added in Epic 4's migration. No `belongsTo(() => Positioning)` relation needed in this story — add when Positioning model exists (Story 4.1).

---

### CRITICAL: positioning_id FK Strategy

The `positionings` table is created in **Epic 4, Story 4.1**. Until then:

- `positioning_id` is stored as a raw UUID (nullable)
- Application code in Stories 3.2–3.7 must NOT rely on a DB-level FK constraint for this column
- Validation in controllers must ensure `positioning_id` belongs to the user if provided (query positionings table if it exists)
- **In Story 4.1's migration, add:** `this.schema.raw('ALTER TABLE prospects ADD CONSTRAINT fk_prospects_positioning FOREIGN KEY (positioning_id) REFERENCES positionings(id) ON DELETE SET NULL')`
- Why `ON DELETE SET NULL`? If a positioning is ever hard-deleted (won't happen — soft-delete only), prospects safely lose the reference. For soft-deleted positionings, the FK row still exists anyway.

---

### Architecture Compliance

| Requirement | Implementation |
|-------------|----------------|
| FR1–FR9, FR43–FR44 | Prospects table schema enables all Epic 3 stories |
| NFR11: Backend data isolation | `forUser()` scope on Prospect model — NOT RLS |
| NFR12: Zero cross-user access | All future queries in 3.2+ MUST use `forUser()` scope |
| NFR21: Zero data bugs | FK constraints enforce referential integrity |
| NFR23: Soft delete | `deleted_at` column + `SoftDeletes` mixin |
| Naming: DB columns | snake_case: `user_id`, `funnel_stage_id`, `linkedin_url` |
| Naming: Model fields | camelCase: `userId`, `funnelStageId`, `linkedinUrl` |
| Lucid pattern | `compose(BaseModel, SoftDeletes)` (same as FunnelStage) |
| withTrashed() types | Uses existing `apps/backend/types/soft_deletes.d.ts` module augmentation |

---

### SoftDeletes Module Augmentation — Already Exists

The `adonis-lucid-soft-deletes` package's `withTrashed()` method is not declared in default Lucid types. The existing type augmentation in `apps/backend/types/soft_deletes.d.ts` already handles this — do NOT recreate it. Just import and use `compose(BaseModel, SoftDeletes)` as shown in the `FunnelStage` model.

---

### User Isolation — The forUser() Contract

Every controller method that queries prospects in Stories 3.2–3.7 **MUST** use the `forUser` scope:

```typescript
// CORRECT ✅ — always scope to authenticated user
const prospects = await Prospect.query()
  .withScopes((s) => s.forUser(userId))
  .orderBy('updated_at', 'desc')

// WRONG ❌ — never query without user scope
const prospects = await Prospect.query().all()
```

This is the **application-level RLS replacement** (NFR11, NFR12, FR54, FR56). The `forUser()` scope pattern was established in Epic 1 for users, implemented in Epic 2 for `FunnelStage`, and must continue for all entities.

---

### funnel_stage_id: NOT NULL Design Decision

`funnel_stage_id` is `NOT NULL` because:
- Every prospect must be in a funnel stage (FR1: create prospects; FR43: move between stages)
- Story 3.4 defaults new prospects to "Lead qualified" (first active stage)
- When a stage is archived (soft-deleted), its DB row persists — so the FK reference remains valid
- Prospects pointing to a soft-deleted stage: future Epic 3 stories handle display (show "(archived)" label)

**This means:** Story 3.2's `POST /api/prospects` endpoint must default `funnel_stage_id` to the user's first active stage if not provided by the client.

---

### Why No Tests in Story 3.1

This is a **pure schema story** — no API endpoints are created. Functional tests will be added in Story 3.2 (prospects CRUD API). The migration verification in Task 3 is sufficient for this story.

The test runner is: `ENV_PATH=../../ node ace test functional` from `apps/backend/` — this runs all existing tests (49/49 from Epic 2) to confirm no regressions from the new migration.

---

### Previous Story Intelligence (Story 2.4 — done)

**Key patterns to carry forward:**

| Pattern | Source |
|---------|--------|
| `compose(BaseModel, SoftDeletes)` — SoftDeletes mixin | `apps/backend/app/models/funnel_stage.ts` |
| UUID primary key: `gen_random_uuid()` via `this.db.rawQuery()` | `apps/backend/database/migrations/0002_create_funnel_stages_table.ts` |
| Index naming: `idx_{table}_{columns}` | Migration 0002 (e.g., `idx_funnel_stages_user_deleted`) |
| `forUser = scope(...)` for user isolation | `apps/backend/app/models/funnel_stage.ts:31` |
| `withScopes((s) => s.forUser(userId))` for querying | `apps/backend/app/controllers/funnel_stages_controller.ts:20` |
| Biome formatting: multi-line method chaining required | From Story 2.4 debug log |
| `ENV_PATH=../../ node ace migration:run` | From project-context.md |

**Deferred AC4 from Story 2.4 — IMPLEMENT IN STORY 3.2:**
Story 3.2 adds `prospect_count` to the `GET /api/funnel_stages` response. See Story 2.4 Dev Notes for the implementation path (backend: count in `index()`, frontend: enhance `FunnelStageItem.tsx` delete dialog).

---

### Git Intelligence

**Recent commits (Epic 2 pattern):**
- Branch naming: `story-X-X` (e.g., `story-2-4`)
- Commit format: `feat(prospects): create prospects database schema`
- Single meaningful commit per story (feature implementation + verification)

**Expected branch:** `story-3-1`
**Expected commit message:** `feat(prospects): create prospects database schema`

---

### Project Structure Notes

**Files to CREATE:**

```
apps/backend/
├── database/migrations/
│   └── 0003_create_prospects_table.ts   # NEW — prospects table migration
└── app/models/
    └── prospect.ts                       # NEW — Prospect Lucid model
```

**Files NOT to touch:**
- `apps/backend/app/controllers/` — no controller for this story
- `apps/backend/app/validators/` — no validators for this story
- `apps/backend/start/routes.ts` — no routes for this story
- `apps/frontend/` — no frontend changes for this story
- `apps/backend/app/services/funnel_stage_service.ts` — no changes (default stage seeding is for funnel stages, not prospects)
- `apps/backend/app/controllers/auth_controller.ts` — no changes (no default prospect seeding on registration)

**Alignment with architecture:**

```
apps/backend/app/models/prospect.ts    ← follows: architecture.md#Structure Patterns > Backend (Adonis Standard)
apps/backend/database/migrations/      ← follows: architecture.md#Database Schemas
```

---

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1: Create Prospects Database Schema]
- [Source: _bmad-output/planning-artifacts/epics.md#FR1–FR9, FR43–FR44 — Prospect Management requirements]
- [Source: _bmad-output/planning-artifacts/epics.md#NFR11, NFR12 — Backend data isolation]
- [Source: _bmad-output/planning-artifacts/epics.md#NFR21, NFR23 — Data integrity, soft delete]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authorization — backend middleware + user_id query filtering]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns > Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns — Soft Delete]
- [Source: _bmad-output/project-context.md — Critical Implementation Rules, Anti-Patterns]
- [Source: apps/backend/database/migrations/0002_create_funnel_stages_table.ts — reference migration pattern]
- [Source: apps/backend/app/models/funnel_stage.ts — reference model pattern with SoftDeletes + forUser scope]
- [Source: apps/backend/app/controllers/funnel_stages_controller.ts — forUser() scope usage pattern]
- [Source: apps/backend/app/services/funnel_stage_service.ts — DEFAULT_FUNNEL_STAGES (9 stages confirmed)]
- [Source: _bmad-output/implementation-artifacts/2-4-enforce-funnel-constraints.md#AC4 Deferral — Implementation Path for Epic 3]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Biome reformatted `funnel_stage_id` chain from multi-line to single line in migration — expected, no impact on functionality.
- `positioning_id` relation (`belongsTo(() => Positioning)`) skipped in model (Task 2.8) — Positioning model does not exist yet, will be added in Epic 4.

### Completion Notes List

- AC1: Migration `0003_create_prospects_table.ts` created with all required columns — id, user_id, funnel_stage_id, positioning_id (nullable, no FK), name, company, linkedin_url, email, phone, title, notes, created_at, updated_at, deleted_at.
- AC2: `Prospect` model created with `compose(BaseModel, SoftDeletes)`, `forUser()` scope, and `belongsTo` relations to `User` and `FunnelStage`.
- AC3: Two indexes created — `idx_prospects_user_deleted (user_id, deleted_at)` and `idx_prospects_user_stage (user_id, funnel_stage_id)`.
- AC4: Migration ran cleanly in 116ms. No errors.
- AC5: `pnpm biome check --write .` — 0 errors (1 file auto-reformatted). `pnpm --filter @battlecrm/backend type-check` — 0 errors.
- Regression check: 49/49 functional tests pass — no regressions.
- `positioning_id` FK deferred to Story 4.1 migration as planned (positionings table doesn't exist yet).

---

### ⚠️ À REVOIR EN RÉTRO EPIC 3 — `positioning_id` sur la table `prospects`

**Question architecturale :** ce champ est-il vraiment utile ?

**Arguments contre :**
- Les `positionings` sont liés à un `funnel_stage_id` — quand un prospect change d'étape, son `positioning_id` devient sémantiquement invalide (il pointe vers un positionnement de l'ancienne étape).
- La table `interactions` capture déjà `positioning_id` par interaction. On peut toujours dériver "le positionnement actuellement utilisé" via `MAX(interaction.created_at) WHERE prospect_id = X`.
- Ce champ crée une synchronisation à maintenir : mise à jour obligatoire à chaque changement d'étape ou archivage d'un positionnement.

**Justification actuelle :** FR7 l'exige explicitement + pré-remplissage rapide du formulaire d'interaction sans jointure supplémentaire.

**Decision à prendre en rétro :** supprimer le champ et dériver la valeur des interactions, ou confirmer qu'il apporte une vraie valeur ?

### File List

**Created:**
- `apps/backend/database/migrations/0003_create_prospects_table.ts`
- `apps/backend/app/models/prospect.ts`
