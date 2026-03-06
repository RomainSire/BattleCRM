# Story 4.1: Create Positionings Database Schema

Status: done

<!-- Ultimate Context Engine Analysis: 2026-03-06 -->
<!-- Epic 4: Positioning Variants — first story (backend only: migration + models) -->

## Story

As a developer,
I want a positionings table linked to funnel stages,
so that users can track different variants for each stage of their pipeline.

## Acceptance Criteria

1. **AC1 (Migration):** A migration `0005_create_positionings_table.ts` creates a `positionings` table with: `id` (uuid PK), `user_id` (uuid FK → users CASCADE), `funnel_stage_id` (uuid FK → funnel_stages), `name` (varchar 255, required), `description` (text, nullable), `content` (text, nullable), `created_at`, `updated_at`, `deleted_at` (nullable). Indexes on `(user_id, deleted_at)` and `(user_id, deleted_at, funnel_stage_id)`.

2. **AC2 (FK backfill on prospects):** The same migration adds the FK constraint from `prospects.positioning_id` to `positionings.id` (promised but deferred in migration `0003`): `ALTER TABLE prospects ADD CONSTRAINT fk_prospects_positioning FOREIGN KEY (positioning_id) REFERENCES positionings(id) ON DELETE SET NULL`.

3. **AC3 (Positioning model):** A `Positioning` Lucid model exists at `apps/backend/app/models/positioning.ts` with: `SoftDeletes` mixin, all column decorators, a `forUser(userId)` scope, and relations (`belongsTo User`, `belongsTo FunnelStage`, `hasMany Prospect`).

4. **AC4 (Model updates):** `Prospect` model gains a `belongsTo(() => Positioning)` relation. `FunnelStage` model gains a `hasMany(() => Positioning)` relation.

5. **AC5 (Shared type validation):** `PositioningType` in `packages/shared/src/types/positioning.ts` matches the DB schema. If any field is missing or incorrect, fix the shared type AND rebuild the package.

6. **AC6 (Functional tests):** `tests/functional/positionings/schema.spec.ts` covers: model creation with all fields, `forUser()` scope isolation between users, soft-delete exclusion from default queries, FK constraint from `prospects.positioning_id`.

7. **AC7 (Lint + type-check):** `pnpm biome check --write .` from root — 0 errors. `pnpm type-check` from root — 0 errors.

## Tasks / Subtasks

- [x] **Task 1: Create migration `0005`** (AC1, AC2)
  - [x] 1.1 Create `apps/backend/database/migrations/0005_create_positionings_table.ts`
  - [x] 1.2 `positionings` table with all columns, FK to users (CASCADE) and funnel_stages (no CASCADE — soft-delete only), indexes
  - [x] 1.3 `ALTER TABLE prospects ADD CONSTRAINT fk_prospects_positioning` (FK backfill)
  - [x] 1.4 `down()` must drop FK constraint first (`dropForeign`), then drop positionings table

- [x] **Task 2: Create Positioning model** (AC3)
  - [x] 2.1 Create `apps/backend/app/models/positioning.ts`
  - [x] 2.2 `compose(BaseModel, SoftDeletes)` + all column decorators + `forUser` scope
  - [x] 2.3 Relations: `belongsTo(() => User)`, `belongsTo(() => FunnelStage)`, `hasMany(() => Prospect)`

- [x] **Task 3: Update existing models** (AC4)
  - [x] 3.1 `apps/backend/app/models/prospect.ts` — add `belongsTo(() => Positioning)` relation + import
  - [x] 3.2 `apps/backend/app/models/funnel_stage.ts` — add `hasMany(() => Positioning)` relation + import

- [x] **Task 4: Verify shared types** (AC5)
  - [x] 4.1 Compare `packages/shared/src/types/positioning.ts` against the actual DB schema columns
  - [x] 4.2 If any mismatch, edit the type file and run `pnpm --filter @battlecrm/shared build`

- [x] **Task 5: Functional tests** (AC6)
  - [x] 5.1 Create `apps/backend/tests/functional/positionings/schema.spec.ts`
  - [x] 5.2 Test: model creation with all fields
  - [x] 5.3 Test: `forUser()` scope isolates positionings between users
  - [x] 5.4 Test: soft-deleted positionings excluded from default queries
  - [x] 5.5 Test: FK constraint — prospect.positioningId can reference positionings.id, SET NULL on positioning soft-delete (not applicable since soft-delete doesn't remove the DB row; test direct DB linkage instead)
  - [x] 5.6 Run `ENV_PATH=../../ node ace test functional` — all tests pass

- [x] **Task 6: Run migration + lint + type-check** (AC7)
  - [x] 6.1 `ENV_PATH=../../ node ace migration:run` — migration `0005` applied
  - [x] 6.2 `pnpm biome check --write .` from root — 0 errors
  - [x] 6.3 `pnpm type-check` from root — 0 errors (includes shared build + backend + frontend)

---

## Dev Notes

### CRITICAL: FK Backfill — prospects.positioning_id

Migration `0003_create_prospects_table.ts` explicitly deferred the FK constraint on `prospects.positioning_id` with this comment:

```typescript
// positioning_id: nullable UUID, NO FK constraint yet.
// The positionings table is created in Epic 4 (Story 4.1).
// FK will be added in that migration via:
//   ALTER TABLE prospects ADD CONSTRAINT fk_prospects_positioning
//   FOREIGN KEY (positioning_id) REFERENCES positionings(id) ON DELETE SET NULL
table.uuid('positioning_id').nullable()
```

This migration MUST add this constraint. Use `this.schema.alterTable` in the same `up()` function, AFTER creating the `positionings` table:

```typescript
async up() {
  // 1. Create positionings table
  this.schema.createTable('positionings', (table) => { ... })

  // 2. Backfill FK on prospects (promised in migration 0003)
  this.schema.alterTable('prospects', (table) => {
    table
      .foreign('positioning_id', 'fk_prospects_positioning')
      .references('id')
      .inTable('positionings')
      .onDelete('SET NULL')
  })
}

async down() {
  // 1. Drop FK constraint first (prospects still exists)
  this.schema.alterTable('prospects', (table) => {
    table.dropForeign('positioning_id', 'fk_prospects_positioning')
  })
  // 2. Drop positionings table
  this.schema.dropTable('positionings')
}
```

**Why `ON DELETE SET NULL`?** If a positioning is hard-deleted (which should never happen — soft-delete only), prospects should not cascade-delete. `SET NULL` is safe — prospects remain accessible without a positioning link. Soft-deletes don't fire DB cascade triggers.

---

### Task 1: Full Migration Code

**File: `apps/backend/database/migrations/0005_create_positionings_table.ts`**

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'positionings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')

      // funnel_stage_id: required FK — no CASCADE (stages are soft-deleted only, DB row always exists)
      table.uuid('funnel_stage_id').notNullable().references('id').inTable('funnel_stages')

      table.string('name', 255).notNullable()
      table.text('description').nullable()
      table.text('content').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.timestamp('deleted_at').nullable()

      // Index for efficient per-user soft-delete filtering
      table.index(['user_id', 'deleted_at'], 'idx_positionings_user_deleted')
      // Index for filtering positionings by funnel stage (Story 4.3 list view with stage filter)
      table.index(['user_id', 'deleted_at', 'funnel_stage_id'], 'idx_positionings_user_deleted_stage')
    })

    // Backfill FK on prospects.positioning_id — promised in migration 0003
    this.schema.alterTable('prospects', (table) => {
      table
        .foreign('positioning_id', 'fk_prospects_positioning')
        .references('id')
        .inTable('positionings')
        .onDelete('SET NULL')
    })
  }

  async down() {
    // Drop FK constraint before dropping the referenced table
    this.schema.alterTable('prospects', (table) => {
      table.dropForeign('positioning_id', 'fk_prospects_positioning')
    })
    this.schema.dropTable(this.tableName)
  }
}
```

---

### Task 2: Positioning Model

**File: `apps/backend/app/models/positioning.ts`** (NEW FILE)

```typescript
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, column, hasMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { SoftDeletes } from 'adonis-lucid-soft-deletes'
import type { DateTime } from 'luxon'
import FunnelStage from '#models/funnel_stage'
import Prospect from '#models/prospect'
import User from '#models/user'

export default class Positioning extends compose(BaseModel, SoftDeletes) {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare funnelStageId: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare content: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @column.dateTime()
  declare deletedAt: DateTime | null

  // Primary user isolation mechanism — use in ALL positioning queries
  static forUser = scope((query, userId: string) => {
    query.where('user_id', userId)
  })

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => FunnelStage)
  declare funnelStage: BelongsTo<typeof FunnelStage>

  @hasMany(() => Prospect)
  declare prospects: HasMany<typeof Prospect>
}
```

**Biome import ordering:** `@adonisjs/core` before `@adonisjs/lucid`, then `adonis-lucid-soft-deletes`, then `luxon`, then `#models/*` (alphabetical: FunnelStage, Prospect, User).

---

### Task 3: Model Updates

**File: `apps/backend/app/models/prospect.ts`** — ADD import + relation:

```typescript
// ADD to imports (alphabetical with other #models):
import Positioning from '#models/positioning'

// ADD after existing belongsTo relations (inside class):
@belongsTo(() => Positioning)
declare positioning: BelongsTo<typeof Positioning>
```

Also update the import line:
```typescript
// Before:
import { BaseModel, belongsTo, column, hasMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

// (already has these, just add the model import)
```

**File: `apps/backend/app/models/funnel_stage.ts`** — ADD import + relation:

```typescript
// ADD to imports (alphabetical with other #models):
import Positioning from '#models/positioning'

// ADD after existing hasMany(() => Prospect) relation:
@hasMany(() => Positioning)
declare positionings: HasMany<typeof Positioning>
```

Also ensure `HasMany` is in the type imports (already is via `import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'`).

**⚠️ Circular dependency risk:** `Positioning` → `Prospect` (hasMany) → `Positioning` (belongsTo). Lucid handles circular model dependencies via lazy loading (functions `() => ModelClass`), so this is safe. Both Lucid and TypeScript handle this correctly.

---

### Task 4: PositioningType Verification

**File: `packages/shared/src/types/positioning.ts`** — already created. Verify it matches the DB schema:

| DB Column | TypeScript Field | Type |
|-----------|-----------------|------|
| `id` | `id` | `string` |
| `user_id` | `userId` | `string` |
| `funnel_stage_id` | `funnelStageId` | `string` |
| `name` | `name` | `string` |
| `description` | `description` | `string \| null` |
| `content` | `content` | `string \| null` |
| `created_at` | `createdAt` | `string` (ISO 8601) |
| `updated_at` | `updatedAt` | `string` (ISO 8601) |
| `deleted_at` | `deletedAt` | `string \| null` |

All fields match. No changes needed to the shared type.

After verifying, run: `pnpm --filter @battlecrm/shared build` to ensure the dist is up to date.

---

### Task 5: Functional Tests

**File: `apps/backend/tests/functional/positionings/schema.spec.ts`** (NEW FILE)

Pattern: identical to `tests/functional/funnel_stages/schema.spec.ts` — `group.setup` + `group.each.teardown` with email domain cleanup.

```typescript
import { test } from '@japa/runner'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@test-positionings-schema.com'

test.group('Positioning schema', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  async function createUserWithStage(client: any, prefix: string) {
    const res = await client.post('/api/auth/register').json({
      email: `${prefix}${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    res.assertStatus(201)
    const userId = res.body().user.id
    const user = await User.findOrFail(userId)
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')
      .firstOrFail()
    return { user, stage }
  }

  test('can create a positioning with all fields', async ({ client, assert }) => {
    const { user, stage } = await createUserWithStage(client, 'create-full')

    const positioning = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'CV v2 - React Focus',
      description: 'Highlighting React experience for frontend roles',
      content: 'Content text here',
    })

    assert.isDefined(positioning.id)
    assert.equal(positioning.userId, user.id)
    assert.equal(positioning.funnelStageId, stage.id)
    assert.equal(positioning.name, 'CV v2 - React Focus')
    assert.equal(positioning.description, 'Highlighting React experience for frontend roles')
    assert.equal(positioning.content, 'Content text here')
    assert.isDefined(positioning.createdAt)
    assert.isNull(positioning.deletedAt)
  })

  test('can create a positioning with only required fields', async ({ client, assert }) => {
    const { user, stage } = await createUserWithStage(client, 'create-minimal')

    const positioning = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'CV minimal',
    })

    assert.isDefined(positioning.id)
    assert.isNull(positioning.description)
    assert.isNull(positioning.content)
  })

  test('forUser scope isolates positionings between users', async ({ client, assert }) => {
    const { user: userA, stage: stageA } = await createUserWithStage(client, 'isolate-a')
    const { user: userB, stage: stageB } = await createUserWithStage(client, 'isolate-b')

    await Positioning.create({ userId: userA.id, funnelStageId: stageA.id, name: 'A-variant' })
    await Positioning.create({ userId: userB.id, funnelStageId: stageB.id, name: 'B-variant' })

    const positioningsA = await Positioning.query().withScopes((s) => s.forUser(userA.id))
    const positioningsB = await Positioning.query().withScopes((s) => s.forUser(userB.id))

    assert.lengthOf(positioningsA, 1)
    assert.lengthOf(positioningsB, 1)
    assert.isTrue(positioningsA.every((p) => p.userId === userA.id))
    assert.isTrue(positioningsB.every((p) => p.userId === userB.id))
  })

  test('soft-deleted positionings excluded from default queries', async ({ client, assert }) => {
    const { user, stage } = await createUserWithStage(client, 'soft-delete')

    const p1 = await Positioning.create({ userId: user.id, funnelStageId: stage.id, name: 'Active' })
    const p2 = await Positioning.create({ userId: user.id, funnelStageId: stage.id, name: 'ToDelete' })

    await p2.delete() // SoftDeletes mixin — sets deleted_at

    const active = await Positioning.query().withScopes((s) => s.forUser(user.id))
    assert.lengthOf(active, 1)
    assert.equal(active[0].id, p1.id)

    const all = await Positioning.query().withTrashed().withScopes((s) => s.forUser(user.id))
    assert.lengthOf(all, 2)
  })

  test('deleted_at is set on soft-delete and null on restore', async ({ client, assert }) => {
    const { user, stage } = await createUserWithStage(client, 'restore')

    const positioning = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'ToRestore',
    })

    await positioning.delete()
    assert.isNotNull(positioning.deletedAt)

    await positioning.restore()
    assert.isNull(positioning.deletedAt)
  })
})
```

**Test infrastructure notes:**
- `@japa/api-client` provides `client` — pass it to `createUserWithStage` as `any` (typed ApiClient is available via import if needed)
- Registration auto-creates 9 default funnel stages — `getFirstStage` pattern gives stage1
- `ON DELETE CASCADE` on `user_id` means teardown via `User.query().delete()` removes positionings automatically
- `withTrashed()` from `adonis-lucid-soft-deletes` — chain BEFORE `withScopes()` (established pattern from Story 3.5)

---

### Project Structure Notes

**New files to create:**
- `apps/backend/database/migrations/0005_create_positionings_table.ts`
- `apps/backend/app/models/positioning.ts`
- `apps/backend/tests/functional/positionings/schema.spec.ts`

**Existing files to modify:**
- `apps/backend/app/models/prospect.ts` — add `belongsTo(() => Positioning)` + import
- `apps/backend/app/models/funnel_stage.ts` — add `hasMany(() => Positioning)` + import

**No frontend changes** — this story is backend-only (migration + models). No API endpoints yet (Story 4.2). No serializers yet (Story 4.2). No shared type changes (already created).

---

### References

- [Source: apps/backend/database/migrations/0003_create_prospects_table.ts] — FK backfill comment + `positioning_id` column definition
- [Source: apps/backend/database/migrations/0004_create_prospect_stage_transitions_table.ts] — migration pattern to follow (FK, indexes, up/down)
- [Source: apps/backend/app/models/funnel_stage.ts] — exact model pattern (SoftDeletes, forUser scope, columns)
- [Source: apps/backend/app/models/prospect.ts] — `positioningId` column already declared, `belongsTo` pattern
- [Source: apps/backend/tests/functional/funnel_stages/schema.spec.ts] — test group pattern with setup/teardown
- [Source: packages/shared/src/types/positioning.ts] — PositioningType already created
- [Source: packages/shared/src/index.ts] — positioning already exported
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1] — AC source (FR10-FR17)
- [Source: _bmad-output/planning-artifacts/architecture.md#Shared Package Pattern] — serializer workflow
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns] — naming, forUser scope, soft delete

### Git Intelligence Summary

Recent commits:
- `a73534b` BMAD: epic 3 review, small changes before epic 4 — **includes the `packages/shared` setup and `positioning.ts` type**
- `495c147` feat(core): extract frontend DTO types to shared folder, and use it to validate backend responses

**Patterns from recent work:**
1. Migration pattern: `0003`/`0004` — exact structure to follow for `0005`
2. Model pattern: `compose(BaseModel, SoftDeletes)` + `forUser` scope — identical for Positioning
3. Test teardown via `User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()` — ON DELETE CASCADE handles child data
4. Biome import sort: `@adonisjs/core` → `@adonisjs/lucid` → `adonis-lucid-soft-deletes` → `luxon` → `#models/*` (alphabetical)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
