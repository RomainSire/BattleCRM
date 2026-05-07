# Story 6.1: Create Battles Database Schema

Status: ready-for-dev

## Story

As a developer,
I want a battles table to track A/B tests per funnel stage,
so that users can manage independent testing per stage.

## Acceptance Criteria

1. **Given** I am setting up the analytics feature / **When** I run the database migration / **Then** a `battles` table is created with:
   - `id` (uuid, primary key)
   - `user_id` (uuid, FK → users, CASCADE DELETE)
   - `funnel_stage_id` (uuid, FK → funnel_stages, no cascade — soft-delete only)
   - `variant_a_id` (uuid, FK → positionings, no cascade — soft-delete only)
   - `variant_b_id` (uuid, FK → positionings, no cascade — soft-delete only)
   - `battle_number` (integer, not null) — sequential per (user_id, funnel_stage_id)
   - `status` (varchar, not null) — values: `'active'` | `'closed'`
   - `winner_id` (uuid, nullable, FK → positionings, no cascade)
   - `started_at` (timestamp, not null)
   - `closed_at` (timestamp, nullable)
   - `created_at`, `updated_at`

2. **Given** the battles table is created / **When** user isolation is required / **Then** user isolation is enforced via `forUser(user_id)` query scope on the `Battle` model (NOT database-level RLS)

3. **Given** a user already has an active battle for a funnel stage / **When** another active battle is attempted for the same (user_id, funnel_stage_id) / **Then** the DB rejects it via a partial unique index on `(user_id, funnel_stage_id) WHERE status = 'active'`

4. **Given** the battles table is created / **When** queries filter by user + stage + status / **Then** a composite index exists on `(user_id, funnel_stage_id, status)` for efficient filtering

5. **Given** Story 6.1 is complete / **When** `BattleType` is needed by the frontend or subsequent stories / **Then** `BattleType` is defined in `packages/shared/src/types/battle.ts` and exported from the shared package index

## Tasks / Subtasks

- [ ] Task 1: Add `BattleType` to `@battlecrm/shared` (AC: #5)
  - [ ] 1.1 Create `packages/shared/src/types/battle.ts` with `BattleType` and `BattleStatus` type
  - [ ] 1.2 Export from `packages/shared/src/index.ts`
  - [ ] 1.3 Run `pnpm --filter @battlecrm/shared build` — verify no TypeScript errors

- [ ] Task 2: Create migration `0013_create_battles_table.ts` (AC: #1, #3, #4)
  - [ ] 2.1 Create `apps/backend/database/migrations/0013_create_battles_table.ts`
  - [ ] 2.2 Add all columns per the AC schema
  - [ ] 2.3 Add partial unique index via raw SQL (standard `table.unique()` does NOT support WHERE clauses — see Dev Notes)
  - [ ] 2.4 Add composite index on `(user_id, funnel_stage_id, status)`
  - [ ] 2.5 Run `ENV_PATH=../../ node ace migration:run` — verify clean output

- [ ] Task 3: Create `Battle` Lucid model (AC: #2)
  - [ ] 3.1 Create `apps/backend/app/models/battle.ts`
  - [ ] 3.2 Declare all columns with correct TypeScript types
  - [ ] 3.3 Add `static forUser = scope(...)` identical to other models
  - [ ] 3.4 Add `belongsTo` relations: `User`, `FunnelStage`, `variantA: Positioning`, `variantB: Positioning`, `winner: Positioning` (nullable)
  - [ ] 3.5 NO SoftDeletes mixin — battles use hard delete (see Dev Notes)

- [ ] Task 4: Write functional schema tests (AC: #1, #2, #3, #4)
  - [ ] 4.1 Create `apps/backend/tests/functional/battles/schema.spec.ts`
  - [ ] 4.2 Test: can create a battle with all fields
  - [ ] 4.3 Test: can create a battle with only required fields (winner_id null, closed_at null)
  - [ ] 4.4 Test: `forUser` scope isolates battles between users
  - [ ] 4.5 Test: partial unique constraint — two active battles for same (user_id, funnel_stage_id) → DB error
  - [ ] 4.6 Test: two active battles for same user but DIFFERENT stages → allowed
  - [ ] 4.7 Test: active + closed battles for same (user_id, funnel_stage_id) → allowed (partial index only blocks two `active`)
  - [ ] 4.8 Test: `battle_number` is stored correctly
  - [ ] 4.9 Run `ENV_PATH=../../ node ace test functional` — all tests pass (0 regressions on 265 existing)

## Dev Notes

### Architecture decisions

- **Story 6.1 scope is schema-only**: no controller, no routes, no serializer, no API endpoints. The API comes in Story 6.2+. The serializer (`serializeBattle()`) will be created in Story 6.2 per the epic convention: "add `BattleType` to `packages/shared/src/types/` in Story 6.1, create serializers in Story 6.2."

- **No SoftDeletes on battles**: Battles are definitively closed, not archived. Hard delete is acceptable if ever needed (unlikely). Do NOT add the `SoftDeletes` mixin.

- **`battle_number` is NOT auto-incremented by the DB**: It is application-managed. When creating a new battle for a (user_id, funnel_stage_id), the controller (Story 6.2+) will compute `MAX(battle_number) + 1` for that pair. At the schema level, it is simply an `integer NOT NULL` column. No DB sequence needed.

- **`started_at` is application-set** (not `autoCreate`): It will be explicitly set to `DateTime.now()` at creation time in the controller. At the schema level: `table.timestamp('started_at').notNullable()`.

### Partial unique index — critical implementation detail

Standard Knex `table.unique(['user_id', 'funnel_stage_id'])` creates a full unique constraint — it would wrongly prevent multiple closed battles for the same stage. The correct constraint is a **partial unique index** (PostgreSQL-specific):

```sql
CREATE UNIQUE INDEX uq_battles_one_active_per_stage
  ON battles (user_id, funnel_stage_id)
  WHERE status = 'active';
```

In the migration, use `this.defer()` with raw SQL after table creation (same pattern as migration `0008`):

```typescript
this.defer(async (db) => {
  await db.rawQuery(`
    CREATE UNIQUE INDEX uq_battles_one_active_per_stage
    ON battles (user_id, funnel_stage_id)
    WHERE status = 'active'
  `)
})
```

In `down()`, drop the index explicitly:
```typescript
this.defer(async (db) => {
  await db.rawQuery('DROP INDEX IF EXISTS uq_battles_one_active_per_stage')
})
```

### `BattleType` shape

```typescript
// packages/shared/src/types/battle.ts
export type BattleStatus = 'active' | 'closed'

export type BattleType = {
  id: string
  userId: string
  funnelStageId: string
  variantAId: string
  variantBId: string
  battleNumber: number
  status: BattleStatus
  winnerId: string | null
  startedAt: string        // ISO 8601
  closedAt: string | null  // ISO 8601
  createdAt: string
  updatedAt: string | null
}
```

### Lucid model — multiple FK to same table

`variantA`, `variantB`, and `winner` all point to `positionings`. Lucid requires explicit FK columns for ambiguous relations:

```typescript
@belongsTo(() => Positioning, { foreignKey: 'variantAId' })
declare variantA: BelongsTo<typeof Positioning>

@belongsTo(() => Positioning, { foreignKey: 'variantBId' })
declare variantB: BelongsTo<typeof Positioning>

@belongsTo(() => Positioning, { foreignKey: 'winnerId' })
declare winner: BelongsTo<typeof Positioning>
```

`winner` is nullable in DB — the relation will return `null` when `winnerId` is null and not preloaded.

### `forUser` scope — mandatory pattern

Copy exactly from other models:

```typescript
static forUser = scope((query, userId: string) => {
  query.where('user_id', userId)
})
```

All Battle queries in future controllers must call `.withScopes((s) => s.forUser(userId))`.

### Testing the partial unique constraint

Knex/Lucid wraps DB errors — catch and assert the DB error code `23505` (PostgreSQL unique violation):

```typescript
test('partial unique: two active battles same stage rejected', async ({ assert }) => {
  // create battle 1 (active) — should succeed
  await Battle.create({ userId, funnelStageId, variantAId, variantBId, battleNumber: 1, status: 'active', startedAt: DateTime.now() })
  // create battle 2 (active) same stage — should throw
  await assert.rejects(
    () => Battle.create({ userId, funnelStageId, variantAId: variantBId, variantBId: variantAId, battleNumber: 2, status: 'active', startedAt: DateTime.now() }),
    /unique/i
  )
})
```

### Migration file location

```
apps/backend/database/migrations/0013_create_battles_table.ts
```

Previous migration: `0012_add_linkedin_url_index_to_prospects.ts`. Next number: `0013`.

### Existing model references for FK fields

- `user_id` → `users.id` (CASCADE DELETE — losing a user removes all their battles)
- `funnel_stage_id` → `funnel_stages.id` (NO CASCADE — stages soft-delete only)
- `variant_a_id`, `variant_b_id`, `winner_id` → `positionings.id` (NO CASCADE — positionings soft-delete only)

### Run commands

```bash
# From apps/backend/
ENV_PATH=../../ node ace migration:run
ENV_PATH=../../ node ace test functional

# From repo root
pnpm type-check
pnpm lint
```

### Project Structure Notes

Files to create:
- `packages/shared/src/types/battle.ts` — `BattleType`, `BattleStatus`
- `apps/backend/database/migrations/0013_create_battles_table.ts`
- `apps/backend/app/models/battle.ts`
- `apps/backend/tests/functional/battles/schema.spec.ts`

Files to modify:
- `packages/shared/src/index.ts` — add `export type * from './types/battle.js'`

### References

- Epic 6 story definition: [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1]
- `forUser` scope pattern: [Source: _bmad-output/planning-artifacts/architecture.md#line 1069]
- Shared Package Pattern: [Source: _bmad-output/planning-artifacts/architecture.md#Shared Package Pattern]
- Partial unique index pattern: [Source: apps/backend/database/migrations/0008_create_prospect_positionings_and_update_interactions.ts]
- ProspectPositioning model (reference for no-SoftDeletes junction pattern): [Source: apps/backend/app/models/prospect_positioning.ts]
- Schema test pattern: [Source: apps/backend/tests/functional/positionings/schema.spec.ts]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
