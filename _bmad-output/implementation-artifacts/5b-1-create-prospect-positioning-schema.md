# Story 5B.1: Create prospect_positionings Schema and Update Interactions

Status: done

## Story

As a developer,
I want a `prospect_positionings` junction table and an updated `interactions` table with `funnel_stage_id`,
so that we can track which positioning each prospect uses per funnel stage and preserve the funnel context of every interaction.

## Acceptance Criteria

1. **AC1 (prospect_positionings table):** Migration creates `prospect_positionings` with columns: `id` (uuid PK), `user_id` (uuid, FK users CASCADE), `prospect_id` (uuid, FK prospects), `positioning_id` (uuid, FK positionings), `funnel_stage_id` (uuid, FK funnel_stages, denormalized from positioning), `outcome` (varchar 10, nullable — `null` | `'success'` | `'failed'`), `created_at` (timestamp autoCreate). UNIQUE constraint on `(user_id, prospect_id, funnel_stage_id)`.

2. **AC2 (indexes):** Index on `(user_id, prospect_id, funnel_stage_id)` for active positioning queries. Index on `(user_id, positioning_id)` for FR16 (all prospects who used a positioning).

3. **AC3 (interactions.funnel_stage_id):** Migration adds `funnel_stage_id` (uuid, FK funnel_stages) column to `interactions`. Existing rows are backfilled: `funnel_stage_id = prospect.funnel_stage_id` via JOIN. Column is then made NOT NULL. Index on `(user_id, funnel_stage_id)` is created.

4. **AC4 (ProspectPositioning model):** Lucid model at `apps/backend/app/models/prospect_positioning.ts` with all columns, `forUser` scope, and `belongsTo` relations for Prospect, Positioning, FunnelStage.

5. **AC5 (Interaction model updated):** `Interaction` model declares `funnelStageId: string` and a `belongsTo(() => FunnelStage)` relation.

6. **AC6 (controller updated):** `InteractionsController.store()` captures `prospect.funnelStageId` from the looked-up prospect and sets it on the new interaction. No validator change needed — `funnel_stage_id` is never sent by the client, it is a server-side snapshot.

7. **AC7 (shared type):** `ProspectPositioningType` defined in `packages/shared/src/types/prospect-positioning.ts` and re-exported from `packages/shared/src/index.ts`.

8. **AC8 (serializer):** `serializeProspectPositioning()` in `apps/backend/app/serializers/prospect-positioning.ts` returns a `ProspectPositioningType`. No preload is required (all fields are scalar columns on the model).

9. **AC9 (bug fix):** `hasMany(() => Prospect)` removed from `apps/backend/app/models/positioning.ts` (stale since migration 0007). `Prospect` import and unused `HasMany<typeof Prospect>` declaration also removed.

10. **AC10 (tests pass):** `ENV_PATH=../../ node ace test functional` — all existing tests pass. New `prospect_positionings/schema.spec.ts` tests pass. `pnpm biome check --write .` — 0 errors.

## Tasks / Subtasks

- [x] **Task 1: Create migration `0008`** (AC1, AC2, AC3)
  - [x] 1.1 Create `apps/backend/database/migrations/0008_create_prospect_positionings_and_update_interactions.ts`
  - [x] 1.2 In `up()` — create `prospect_positionings` table:
    ```typescript
    this.schema.createTable('prospect_positionings', (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      // user_id: CASCADE — prospect_positionings belong to the user
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      // prospect_id: no CASCADE — prospects use soft-delete only
      table.uuid('prospect_id').notNullable().references('id').inTable('prospects')
      // positioning_id: no CASCADE — positionings use soft-delete only
      table.uuid('positioning_id').notNullable().references('id').inTable('positionings')
      // funnel_stage_id: denormalized from positioning.funnel_stage_id — no CASCADE (stages soft-delete only)
      table.uuid('funnel_stage_id').notNullable().references('id').inTable('funnel_stages')
      // outcome: null = in-progress, 'success', 'failed' — always set explicitly by user
      table.string('outcome', 10).nullable()
      table.timestamp('created_at').notNullable()
      // UNIQUE: max 1 positioning per prospect per stage (assigning new = replace old)
      table.unique(['user_id', 'prospect_id', 'funnel_stage_id'], 'uq_prospect_positionings_user_prospect_stage')
      // Index for active positioning lookup
      table.index(['user_id', 'prospect_id', 'funnel_stage_id'], 'idx_prospect_positionings_active')
      // Index for FR16: all prospects that used a positioning
      table.index(['user_id', 'positioning_id'], 'idx_prospect_positionings_positioning')
    })
    ```
  - [x] 1.3 In `up()` — add `funnel_stage_id` to `interactions` (nullable for backfill):
    ```typescript
    this.schema.alterTable('interactions', (table) => {
      table.uuid('funnel_stage_id').nullable().references('id').inTable('funnel_stages')
      table.index(['user_id', 'funnel_stage_id'], 'idx_interactions_user_funnel_stage')
    })
    ```
  - [x] 1.4 In `up()` — backfill `interactions.funnel_stage_id` from prospect's current stage:
    ```typescript
    this.defer(async (db) => {
      // Backfill from prospect's current funnel_stage_id (snapshot at migration time)
      // Includes soft-deleted prospects — they always have a funnel_stage_id
      await db.rawQuery(`
        UPDATE interactions
        SET funnel_stage_id = prospects.funnel_stage_id
        FROM prospects
        WHERE interactions.prospect_id = prospects.id
      `)
    })
    ```
  - [x] 1.5 In `up()` — make `funnel_stage_id` NOT NULL after backfill:
    ```typescript
    this.defer(async (db) => {
      await db.rawQuery('ALTER TABLE interactions ALTER COLUMN funnel_stage_id SET NOT NULL')
    })
    ```
  - [x] 1.6 In `down()`:
    ```typescript
    async down() {
      this.schema.dropTable('prospect_positionings')
      this.schema.alterTable('interactions', (table) => {
        table.dropIndex([], 'idx_interactions_user_funnel_stage')
        table.dropColumn('funnel_stage_id')
      })
    }
    ```

- [x] **Task 2: Create `ProspectPositioning` Lucid model** (AC4)
  - [x] 2.1 Create `apps/backend/app/models/prospect_positioning.ts`:
    ```typescript
    import { BaseModel, belongsTo, column, scope } from '@adonisjs/lucid/orm'
    import type { BelongsTo } from '@adonisjs/lucid/types/relations'
    import FunnelStage from '#models/funnel_stage'
    import Positioning from '#models/positioning'
    import Prospect from '#models/prospect'
    import type { DateTime } from 'luxon'

    export default class ProspectPositioning extends BaseModel {
      static table = 'prospect_positionings'

      @column({ isPrimary: true }) declare id: string
      @column() declare userId: string
      @column() declare prospectId: string
      @column() declare positioningId: string
      @column() declare funnelStageId: string  // denormalized from positioning.funnel_stage_id
      @column() declare outcome: 'success' | 'failed' | null
      @column.dateTime({ autoCreate: true }) declare createdAt: DateTime

      // No SoftDeletes — junction table uses hard delete on replacement
      // No updatedAt — immutable once created (outcome is mutable but tracked at app level)

      static forUser = scope((query, userId: string) => {
        query.where('user_id', userId)
      })

      @belongsTo(() => Prospect) declare prospect: BelongsTo<typeof Prospect>
      @belongsTo(() => Positioning) declare positioning: BelongsTo<typeof Positioning>
      @belongsTo(() => FunnelStage) declare funnelStage: BelongsTo<typeof FunnelStage>
    }
    ```
  - [x] 2.2 Note: NO `compose(BaseModel, SoftDeletes)` — this is a junction table replaced via hard delete (delete + insert) when a new positioning is assigned for the same stage.

- [x] **Task 3: Update `Interaction` model** (AC5)
  - [x] 3.1 In `apps/backend/app/models/interaction.ts`, add after `positioningId`:
    ```typescript
    @column()
    declare funnelStageId: string  // snapshot of prospect.funnelStageId at interaction creation — immutable
    ```
  - [x] 3.2 Add `FunnelStage` import and `belongsTo` relation:
    ```typescript
    import FunnelStage from '#models/funnel_stage'
    // ...
    @belongsTo(() => FunnelStage)
    declare funnelStage: BelongsTo<typeof FunnelStage>
    ```
  - [x] 3.3 Add `BelongsTo` to the `type { BelongsTo }` import line (already exists, just add FunnelStage relation type usage).

- [x] **Task 4: Update `InteractionsController.store()` to capture `funnelStageId`** (AC6)
  - [x] 4.1 In `apps/backend/app/controllers/interactions_controller.ts`, update the `store()` method. The prospect validation already loads the prospect — capture its `funnelStageId`:
    ```typescript
    // Validate prospect ownership — withTrashed to allow interactions on archived prospects
    const prospect = await Prospect.query()
      .withTrashed()
      .withScopes((s) => s.forUser(userId))
      .where('id', payload.prospect_id)
      .firstOrFail()

    // ...existing positioning validation...

    const interaction = await Interaction.create({
      userId,
      prospectId: payload.prospect_id,
      positioningId: payload.positioning_id ?? null,
      funnelStageId: prospect.funnelStageId,  // ← ADD THIS — snapshot, never sent by client
      status: payload.status,
      notes: payload.notes ?? null,
      interactionDate: payload.interaction_date
        ? DateTime.fromISO(payload.interaction_date)
        : DateTime.now(),
    })
    ```
  - [x] 4.2 The prospect validation currently calls `firstOrFail()` without capturing the result. Change it to `const prospect = await ...firstOrFail()` and use `prospect.funnelStageId`. The `firstOrFail()` already throws a 404 if not found — no behavior change.
  - [x] 4.3 Do NOT change the validator or the API response shape. `funnelStageId` is a server-side snapshot field not exposed to clients in this story.

- [x] **Task 5: Create shared type `ProspectPositioningType`** (AC7)
  - [x] 5.1 Create `packages/shared/src/types/prospect-positioning.ts`:
    ```typescript
    export type ProspectPositioningType = {
      id: string
      userId: string
      prospectId: string
      positioningId: string
      funnelStageId: string
      outcome: 'success' | 'failed' | null
      createdAt: string  // ISO 8601
    }
    ```
  - [x] 5.2 In `packages/shared/src/index.ts`, add export:
    ```typescript
    export type * from './types/prospect-positioning.js'
    ```

- [x] **Task 6: Create `serializeProspectPositioning()` serializer** (AC8)
  - [x] 6.1 Create `apps/backend/app/serializers/prospect-positioning.ts`:
    ```typescript
    import type { ProspectPositioningType } from '@battlecrm/shared'
    import type ProspectPositioning from '#models/prospect_positioning'

    export function serializeProspectPositioning(pp: ProspectPositioning): ProspectPositioningType {
      return {
        id: pp.id,
        userId: pp.userId,
        prospectId: pp.prospectId,
        positioningId: pp.positioningId,
        funnelStageId: pp.funnelStageId,
        outcome: pp.outcome,
        createdAt: pp.createdAt.toISO()!,
      }
    }
    ```
  - [x] 6.2 No preloads required — all fields are scalar columns.

- [x] **Task 7: Fix `positioning.ts` stale bug** (AC9)
  - [x] 7.1 In `apps/backend/app/models/positioning.ts`, remove lines 53-54:
    ```typescript
    // REMOVE these two lines:
    @hasMany(() => Prospect)
    declare prospects: HasMany<typeof Prospect>
    ```
  - [x] 7.2 Remove the `Prospect` import from line 8:
    ```typescript
    // REMOVE: import Prospect from '#models/prospect'
    ```
  - [x] 7.3 `HasMany` is still needed for `interactions: HasMany<typeof Interaction>` — keep it. `hasMany` is still needed — keep it.
  - [x] 7.4 The resulting clean model imports should be:
    ```typescript
    import { compose } from '@adonisjs/core/helpers'
    import { BaseModel, belongsTo, column, hasMany, scope } from '@adonisjs/lucid/orm'
    import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
    import { SoftDeletes } from 'adonis-lucid-soft-deletes'
    import type { DateTime } from 'luxon'
    import FunnelStage from '#models/funnel_stage'
    import Interaction from '#models/interaction'
    import User from '#models/user'
    ```

- [x] **Task 8: Update existing interaction tests for `funnelStageId`** (AC10)
  - [x] 8.1 In `apps/backend/tests/functional/interactions/schema.spec.ts`, all `Interaction.create({...})` calls must add `funnelStageId: stage.id`. The helper `createUserWithContext` already returns `stage` — use it:
    ```typescript
    // Before (will fail after migration):
    await Interaction.create({ userId: user.id, prospectId: prospect.id, status: 'positive', interactionDate: DateTime.now() })
    // After:
    await Interaction.create({ userId: user.id, prospectId: prospect.id, funnelStageId: stage.id, status: 'positive', interactionDate: DateTime.now() })
    ```
  - [x] 8.2 Apply the same fix to ALL `Interaction.create()` calls in `schema.spec.ts` (roughly 15 occurrences).
  - [x] 8.3 In the test for minimal fields (`can create an interaction with minimal fields`), the assertion `assert.isNull(reloaded.positioningId)` is still valid. Also add: `assert.equal(reloaded.funnelStageId, stage.id)`.
  - [x] 8.4 In `apps/backend/tests/functional/interactions/api.spec.ts`, all tests create interactions via the API (`client.post('/api/interactions').json({...})`). The controller will now automatically set `funnelStageId` from the prospect. No change needed in the test payloads. But verify the response shape is still correct (no `funnelStageId` exposed in `InteractionType` — it's an internal field for now).
  - [x] 8.5 After test fixes, run `ENV_PATH=../../ node ace test functional` from `apps/backend/` — all tests must pass.

- [x] **Task 9: Write new `prospect_positionings/schema.spec.ts` tests** (AC1, AC4, AC10)
  - [x] 9.1 Create `apps/backend/tests/functional/prospect_positionings/schema.spec.ts`:
    ```typescript
    import db from '@adonisjs/lucid/services/db'
    import type { ApiClient } from '@japa/api-client'
    import { test } from '@japa/runner'
    import FunnelStage from '#models/funnel_stage'
    import Positioning from '#models/positioning'
    import Prospect from '#models/prospect'
    import ProspectPositioning from '#models/prospect_positioning'
    import User from '#models/user'

    const TEST_EMAIL_DOMAIN = '@prospect-positionings-schema-test.local'
    ```
  - [x] 9.2 Standard `group.setup` / `group.each.teardown` pattern: `User.query().whereILike('email', '%' + TEST_EMAIL_DOMAIN).delete()`
  - [x] 9.3 Helper `createUserWithContext(client, prefix)` → `{ user, stage, prospect, positioning }`:
    - Register user via API
    - Get first FunnelStage (forUser, orderBy position asc)
    - Create Prospect with `userId, funnelStageId: stage.id`
    - Create Positioning with `userId, funnelStageId: stage.id`
  - [x] 9.4 Test: **can create a ProspectPositioning with all required fields**:
    - Create PP with `{ userId, prospectId, positioningId, funnelStageId: stage.id, outcome: null }`
    - Assert: `isDefined(pp.id)`, `equal(pp.userId, user.id)`, `equal(pp.outcome, null)`, `isDefined(pp.createdAt)`
  - [x] 9.5 Test: **outcome can be set to 'success' or 'failed'**:
    - Create with `outcome: 'success'` → reload → assert `equal(reloaded.outcome, 'success')`
    - Create second with `outcome: 'failed'` → reload → assert `equal(reloaded.outcome, 'failed')`
  - [x] 9.6 Test: **forUser scope isolates ProspectPositionings between users**:
    - Create context for userA and userB (each with their own stage, prospect, positioning)
    - Create one PP for each user
    - `ProspectPositioning.query().withScopes(s => s.forUser(userA.id))` → length 1, all belong to userA
    - Same for userB
  - [x] 9.7 Test: **UNIQUE constraint prevents duplicate (user_id, prospect_id, funnel_stage_id)**:
    ```typescript
    // First insert succeeds
    await ProspectPositioning.create({ userId, prospectId, positioningId, funnelStageId: stage.id, outcome: null })
    // Second insert with same (user_id, prospect_id, funnel_stage_id) must throw
    await assert.rejects(async () => {
      await ProspectPositioning.create({ userId, prospectId, positioningId, funnelStageId: stage.id, outcome: null })
    })
    ```
  - [x] 9.8 Test: **replace positioning for same stage via delete+insert** (correct pattern for Story 5B.2):
    ```typescript
    // Initial assignment
    const pp1 = await ProspectPositioning.create({ userId, prospectId, positioningId, funnelStageId: stage.id, outcome: null })
    // Replace: delete old, create new
    await ProspectPositioning.query()
      .where('user_id', userId).where('prospect_id', prospectId).where('funnel_stage_id', stage.id)
      .delete()
    const pp2 = await ProspectPositioning.create({ userId, prospectId, positioningId: positioning2.id, funnelStageId: stage.id, outcome: null })
    // Only one record exists for this (user, prospect, stage)
    const records = await ProspectPositioning.query().where('prospect_id', prospectId).where('funnel_stage_id', stage.id)
    assert.lengthOf(records, 1)
    assert.equal(records[0].positioningId, positioning2.id)
    ```
  - [x] 9.9 Test: **ON DELETE CASCADE: deleting user removes their ProspectPositionings**:
    ```typescript
    const pp = await ProspectPositioning.create({...})
    await db.from('users').where('id', userId).delete()  // hard delete bypasses soft-deletes
    const found = await ProspectPositioning.query().where('id', pp.id).first()
    assert.isNull(found)
    ```
  - [x] 9.10 Test: **funnelStageId is set on Interaction.create() with explicit value**:
    - Create Interaction with `funnelStageId: stage.id`
    - Reload → assert `equal(reloaded.funnelStageId, stage.id)`
    - Update prospect to different stage, reload interaction → assert `funnelStageId` is unchanged (proves immutability of snapshot)

- [x] **Task 10: Lint and type-check** (AC10)
  - [x] 10.1 `pnpm biome check --write .` from monorepo root — 0 errors
  - [x] 10.2 `pnpm --filter @battlecrm/backend type-check` — 0 errors
  - [x] 10.3 `ENV_PATH=../../ node ace test functional` from `apps/backend/` — all tests pass

## Dev Notes

### Architecture Summary

This is a **pure backend/infrastructure story**. No frontend changes. No new API endpoints. The goal is to lay the database foundation and model layer for Epic 5B's prospect-positioning assignment feature.

**Two changes in one migration:**
1. New `prospect_positionings` junction table
2. `funnel_stage_id` column added to existing `interactions` table

---

### Critical: Migration Order & `this.defer`

AdonisJS Lucid migrations execute `this.schema.*` calls and `this.defer()` calls in registration order. For the `interactions.funnel_stage_id` backfill:

```
schema.alterTable('interactions', add nullable funnel_stage_id)  ← runs 1st
this.defer(backfill UPDATE FROM prospects)                        ← runs 2nd
this.defer(ALTER COLUMN SET NOT NULL)                            ← runs 3rd
```

This ordering is required. Do NOT collapse the deferred calls or the NOT NULL constraint will fail on existing rows.

---

### Critical: `InteractionsController.store()` Must Be Updated

**Without this fix, ALL existing interaction API tests will break** after the migration, because `Interaction.create()` will fail to insert (violates NOT NULL on `funnel_stage_id`).

The existing `store()` method currently does:
```typescript
await Prospect.query()...firstOrFail()  // discards result
```

Change to:
```typescript
const prospect = await Prospect.query()...firstOrFail()  // keep result
// ...then use prospect.funnelStageId in Interaction.create()
```

`funnel_stage_id` is a **server-side snapshot** — never sent by client, never in the validator, never in the response (`InteractionType` does not include this field).

---

### No SoftDeletes on ProspectPositioning

Unlike all other models in this project, `ProspectPositioning` does NOT use `SoftDeletes`. Reason: the junction table's "replace" semantics require a real hard delete when a user assigns a new positioning to a stage already covered. Soft-deleting would violate the UNIQUE constraint on re-insert.

Pattern for replace (to be used in Story 5B.2):
```typescript
// Delete old (hard delete is intentional)
await ProspectPositioning.query()
  .where('user_id', userId)
  .where('prospect_id', prospectId)
  .where('funnel_stage_id', targetFunnelStageId)
  .delete()
// Create new
await ProspectPositioning.create({ userId, prospectId, positioningId, funnelStageId, outcome: null })
```

---

### Active Positioning Logic

The prospect's **active positioning** is derived, not stored:
```sql
SELECT * FROM prospect_positionings
WHERE prospect_id = :prospectId
  AND funnel_stage_id = :prospect.funnel_stage_id
```

When a prospect moves to a new stage, nothing changes in `prospect_positionings`. The "active" positioning changes automatically because the lookup key (`funnel_stage_id`) now matches a different row (or none at all if no positioning was assigned for the new stage).

---

### Existing Test Impact

After the migration, `funnel_stage_id` is NOT NULL on `interactions`. Any `Interaction.create()` call that omits `funnelStageId` will throw a DB constraint error.

**Files to update:**
- `apps/backend/tests/functional/interactions/schema.spec.ts` — all `Interaction.create()` calls (~15 occurrences)
- The helper `createUserWithContext` already returns `stage` — use `stage.id` as `funnelStageId`

**Files NOT needing changes:**
- `apps/backend/tests/functional/interactions/api.spec.ts` — these create interactions via the API (`POST /api/interactions`). After fixing the controller in Task 4, the controller auto-sets `funnelStageId`. Test payloads stay unchanged.

---

### Positioning.ts Bug (stale hasMany)

`apps/backend/app/models/positioning.ts` line 53-54 currently has:
```typescript
@hasMany(() => Prospect)
declare prospects: HasMany<typeof Prospect>
```

This has been broken since migration 0007 removed `prospects.positioning_id`. The FK no longer exists. Lucid wouldn't crash on model load, but any query using this relation would fail. Remove it and its `Prospect` import. `hasMany(() => Interaction)` stays — it's still valid.

---

### Import Aliases

The new model uses `#models/prospect_positioning` alias (from `apps/backend/package.json`'s `imports` map). The pattern follows other models:
- Import in controller: `import ProspectPositioning from '#models/prospect_positioning'`
- Import in serializer: `import type ProspectPositioning from '#models/prospect_positioning'`

---

### Running Tests

From `apps/backend/`:
```bash
ENV_PATH=../../ node ace test functional
# Or run only prospect_positionings group:
ENV_PATH=../../ node ace test functional --files="prospect_positionings/*"
```

---

### Project Structure Notes

**New files:**
```
apps/backend/database/migrations/0008_create_prospect_positionings_and_update_interactions.ts
apps/backend/app/models/prospect_positioning.ts
apps/backend/app/serializers/prospect-positioning.ts
apps/backend/tests/functional/prospect_positionings/schema.spec.ts
packages/shared/src/types/prospect-positioning.ts
```

**Modified files:**
```
apps/backend/app/models/interaction.ts                      — add funnelStageId column + FunnelStage relation
apps/backend/app/models/positioning.ts                      — remove stale hasMany(() => Prospect)
apps/backend/app/controllers/interactions_controller.ts     — store() captures prospect.funnelStageId
apps/backend/tests/functional/interactions/schema.spec.ts   — add funnelStageId to all Interaction.create() calls
packages/shared/src/index.ts                                — add export for prospect-positioning
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Prospect-Positioning Assignment Model] — Complete design decision: junction table rationale, table schema, UNIQUE constraint, active positioning derivation
- [Source: _bmad-output/planning-artifacts/architecture.md#prospect_positionings table] — Exact columns, constraints, indexes
- [Source: _bmad-output/planning-artifacts/architecture.md#Positionnement "actif" d'un prospect] — Active positioning is derived via `funnel_stage_id = prospect.funnel_stage_id`
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5B.1] — Acceptance criteria and technical notes
- [Source: apps/backend/database/migrations/0006_create_interactions_table.ts] — Pattern for migrations with FKs and indexes
- [Source: apps/backend/database/migrations/0005_create_positionings_table.ts] — Pattern for `alterTable` in same migration as `createTable`
- [Source: apps/backend/app/models/positioning.ts] — Bug: line 53-54 `hasMany(() => Prospect)` to remove
- [Source: apps/backend/app/controllers/interactions_controller.ts#store] — Current implementation (prospect query result discarded)
- [Source: apps/backend/tests/functional/positionings/schema.spec.ts] — Test file structure to follow
- [Source: packages/shared/src/types/interaction.ts] — `InteractionType` does NOT include `funnelStageId` (internal server field)
- [Source: _bmad-output/project-context.md#Data Patterns] — Soft delete rules, FK cascade patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Migration uses `this.defer()` twice to guarantee correct SQL ordering: backfill UPDATE runs after `alterTable`, then NOT NULL constraint is set after backfill. Critical pattern — do not collapse.
- `ProspectPositioning` intentionally omits `SoftDeletes` mixin — hard delete on replacement is required to avoid UNIQUE constraint violation on re-insert.
- `InteractionsController.store()` captures `prospect.funnelStageId` as a server-side snapshot — not in validator, not in API response (`InteractionType`). Existing API tests needed no payload changes; only the `createInteraction` helper and three inline `Interaction.create()` calls in other test files needed `funnelStageId` added.
- `positioning.ts` bug fix: `hasMany(() => Prospect)` was stale since migration 0007 removed `prospects.positioning_id`. Removed along with the unused `Prospect` import.
- `@battlecrm/shared` requires a manual `pnpm --filter @battlecrm/shared build` after adding new types to regenerate `dist/` — TypeScript `emitDeclarationOnly: true` means the types are only available after compilation.
- Final validation: 218/218 tests passed, 0 Biome errors, 0 type errors.

### File List

**New files:**
- `apps/backend/database/migrations/0008_create_prospect_positionings_and_update_interactions.ts`
- `apps/backend/app/models/prospect_positioning.ts`
- `apps/backend/app/serializers/prospect-positioning.ts`
- `apps/backend/tests/functional/prospect_positionings/schema.spec.ts`
- `packages/shared/src/types/prospect-positioning.ts`

**Modified files:**
- `apps/backend/app/models/interaction.ts` — added `funnelStageId` column + `FunnelStage` belongsTo relation
- `apps/backend/app/models/positioning.ts` — removed stale `hasMany(() => Prospect)` and `Prospect` import
- `apps/backend/app/models/prospect_positioning.ts` — (code-review) added `User` belongsTo relation; documented outcome audit-trail tradeoff
- `apps/backend/app/controllers/interactions_controller.ts` — `store()` captures `prospect.funnelStageId` snapshot; (code-review) `?funnel_stage_id` filter now uses `interaction.funnel_stage_id` directly
- `apps/backend/start/routes.ts` — Biome cosmetic reformat (no logic change)
- `apps/backend/tests/functional/interactions/schema.spec.ts` — added `funnelStageId: stage.id` to all `Interaction.create()` calls
- `apps/backend/tests/functional/interactions/api.spec.ts` — updated `createInteraction` helper to auto-derive `funnelStageId` from prospect; fixed one inline `Interaction.create()` call; (code-review) updated `?funnel_stage_id` test name to reflect snapshot semantics
- `apps/backend/tests/functional/positionings/api.spec.ts` — added `funnelStageId: stage.id` to three `Interaction.create()` calls
- `packages/shared/src/index.ts` — added `export type * from './types/prospect-positioning.js'`
