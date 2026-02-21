# Story 2.1: Create Funnel Stages Database Schema

Status: review

<!-- Ultimate Context Engine Analysis: 2026-02-20 -->
<!-- Previous stories: 1-1 through 1-8 (all done), Epic 1 retrospective done -->

## Story

As a **developer**,
I want **a funnel_stages table with proper schema and default data**,
So that **users can have a working funnel from day one**.

## Acceptance Criteria

1. **AC1:** Migration creates `funnel_stages` table with: `id` (uuid), `user_id` (uuid FK → users), `name` (varchar, required), `position` (integer, required), `created_at`, `updated_at`, `deleted_at`
2. **AC2:** A partial unique index enforces `(user_id, position)` uniqueness only for active (non-deleted) stages
3. **AC3:** An index exists on `(user_id, deleted_at)` for efficient per-user queries
4. **AC4:** A `FunnelStage` Lucid model is created with `forUser(userId)` query scope and soft-delete support
5. **AC5:** When a new user registers, exactly 10 default funnel stages are created for that user (in order):
   1. Lead qualified
   2. First contact
   3. Connection established
   4. Positive response
   5. ESN qualification
   6. Application sent
   7. ESN interview(s)
   8. Final client interview(s)
   9. Proposal received
   10. Contract signed ✅
6. **AC6:** Default stage seeding is transactional with user creation (if seeding fails → user creation rolls back)
7. **AC7:** `ENV_PATH=../../ node ace migration:run` runs successfully with the new migration
8. **AC8:** `pnpm lint` passes from root (Biome v2 — no TypeScript errors, no lint errors)
9. **AC9:** Functional tests cover: registration creates 10 stages, `forUser()` scope isolates stages per user, deleted stages are excluded from default queries

## Tasks / Subtasks

- [x] **Task 1: Create migration** (AC: 1, 2, 3, 7)
  - [x] 1.1 Create `apps/backend/database/migrations/0002_create_funnel_stages_table.ts`
  - [x] 1.2 Add `funnel_stages` table with all required columns (uuid id, user_id FK, name, position, timestamps + deleted_at)
  - [x] 1.3 Add partial unique index on `(user_id, position) WHERE deleted_at IS NULL` via `schema.raw()`
  - [x] 1.4 Add standard index on `(user_id, deleted_at)` for query performance
  - [x] 1.5 Run `ENV_PATH=../../ node ace migration:run` to verify migration applies cleanly

- [x] **Task 2: Create FunnelStage model** (AC: 4)
  - [x] 2.1 Create `apps/backend/app/models/funnel_stage.ts`
  - [x] 2.2 Extend `compose(BaseModel, SoftDeletes)` (same pattern as User model — no AuthFinder needed)
  - [x] 2.3 Declare all columns with proper types: `id`, `userId`, `name`, `position`, `createdAt`, `updatedAt`, `deletedAt`
  - [x] 2.4 Add `static forUser = scope(...)` filtering by `user_id` (matches User model pattern)
  - [x] 2.5 Add `belongsTo` relationship to User model

- [x] **Task 3: Create FunnelStageService** (AC: 5, 6)
  - [x] 3.1 Create `apps/backend/app/services/funnel_stage_service.ts` (new `services/` directory)
  - [x] 3.2 Implement `seedDefaultStages(userId: string, trx: TransactionClientContract): Promise<void>`
  - [x] 3.3 Create the 10 default stages using `FunnelStage.createMany()` with positions 1–10 within the transaction

- [x] **Task 4: Update AuthController.register** (AC: 5, 6)
  - [x] 4.1 Import `db` from `@adonisjs/lucid/services/db` and `{ seedDefaultStages }` from service
  - [x] 4.2 Wrap `User.create()` + `seedDefaultStages()` in a `db.transaction()` for atomicity
  - [x] 4.3 Preserve existing error handling (PostgreSQL error code `23505` for duplicate email)

- [x] **Task 5: Write functional tests** (AC: 9)
  - [x] 5.1 Create `apps/backend/tests/functional/funnel_stages/schema.spec.ts`
  - [x] 5.2 Test: registration via `POST /api/auth/register` creates exactly 10 funnel stages for the new user
  - [x] 5.3 Test: stages are in correct order (position 1–10, names match expected values)
  - [x] 5.4 Test: `FunnelStage.query().withScopes((s) => s.forUser(userId))` returns only that user's stages
  - [x] 5.5 Test: stages with `deleted_at` set are excluded from default queries
  - [x] 5.6 Teardown: delete all test users and their associated funnel stages

- [x] **Task 6: Verification** (AC: 7, 8)
  - [x] 6.1 `ENV_PATH=../../ node ace migration:run` → success (from `apps/backend/`)
  - [x] 6.2 `ENV_PATH=../../ node ace test functional` → all 22 tests pass (17 existing + 5 new)
  - [x] 6.3 `pnpm lint` from root → no errors (Biome v2)

## Dev Notes

### Critical Architecture Decision: Seeding Approach

**Decision: Service call in `AuthController.register` wrapped in `db.transaction()`**

This was identified in the Epic 1 retrospective as an architectural decision to make during story creation.

**Why NOT `afterCreate` hook on User model:**
- Would create an implicit dependency from `User` model → `FunnelStage` (coupling concerns)
- Harder to test in isolation
- Hook runs outside of the controller transaction unless carefully managed
- Errors in hook are harder to surface with proper HTTP response codes

**Why YES `AuthController.register` + `db.transaction()`:**
- Explicit and readable: registration creates user + stages atomically
- Easy to test via the register endpoint — verify stages in teardown
- Clean separation: `FunnelStageService` handles stage logic, controller orchestrates
- If seeding fails → whole transaction rolls back → user is NOT created → clean error state

**Updated `AuthController.register` pattern:**
```typescript
import db from '@adonisjs/lucid/services/db'
import FunnelStageService from '#services/funnel_stage_service'

async register({ request, response, auth }: HttpContext) {
  // ... ALLOW_REGISTRATION check stays unchanged ...

  const data = await request.validateUsing(registerValidator)

  let user: User
  try {
    user = await db.transaction(async (trx) => {
      const newUser = await User.create(
        { email: data.email, password: data.password },
        { client: trx }
      )
      await FunnelStageService.seedDefaultStages(newUser.id, trx)
      return newUser
    })
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    ) {
      return response.unprocessableEntity({
        errors: [{ message: 'validation.unique', field: 'email', rule: 'unique' }],
      })
    }
    throw error
  }

  await auth.use('web').login(user)
  return response.created({ user: { id: user.id, email: user.email } })
}
```

**Note:** `auth.use('web').login(user)` is called **outside** the transaction (after commit). This is intentional — session creation happens at the HTTP layer, not the DB layer.

---

### Critical: Migration Schema

**File:** `apps/backend/database/migrations/0002_create_funnel_stages_table.ts`

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'funnel_stages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('name', 255).notNullable()
      table.integer('position').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.timestamp('deleted_at').nullable()

      // Index for efficient per-user queries (filtering by deleted_at)
      table.index(['user_id', 'deleted_at'], 'idx_funnel_stages_user_deleted')
    })

    // Partial unique index: enforce unique positions only for active (non-deleted) stages
    // Cannot be done via Knex table builder — must use raw SQL
    await this.schema.raw(
      'CREATE UNIQUE INDEX idx_funnel_stages_user_position_active ON funnel_stages (user_id, position) WHERE deleted_at IS NULL'
    )
  }

  async down() {
    await this.schema.raw('DROP INDEX IF EXISTS idx_funnel_stages_user_position_active')
    this.schema.dropTable(this.tableName)
  }
}
```

**Why `onDelete('CASCADE')`:** If a user is deleted (soft-deleted in our case — but if ever hard-deleted), their stages should cascade. This is DB-level safety; soft deletes happen at the application layer.

**Why partial unique index:** Archived (soft-deleted) stages retain their position value in the DB. A regular unique constraint would prevent creating a new stage at position 3 if an archived stage still has position 3 for that user. The partial index solves this.

---

### Critical: FunnelStage Model

**File:** `apps/backend/app/models/funnel_stage.ts`

```typescript
import { BaseModel, belongsTo, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { SoftDeletes } from 'adonis-lucid-soft-deletes'
import { compose } from '@adonisjs/core/helpers'
import type { DateTime } from 'luxon'
import User from '#models/user'

export default class FunnelStage extends compose(BaseModel, SoftDeletes) {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare name: string

  @column()
  declare position: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @column.dateTime()
  declare deletedAt: DateTime | null

  // Primary user isolation mechanism — use in ALL funnel stage queries
  static forUser = scope((query, userId: string) => {
    query.where('user_id', userId)
  })

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
```

**Note on import order:** Biome sorts imports alphabetically. `@` scoped packages → `#` aliases → relative imports. This order is correct.

---

### Critical: FunnelStageService

**File:** `apps/backend/app/services/funnel_stage_service.ts`

**Note:** Create the `services/` directory — it does NOT exist yet in `apps/backend/app/`.

```typescript
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import FunnelStage from '#models/funnel_stage'

const DEFAULT_FUNNEL_STAGES = [
  'Lead qualified',
  'First contact',
  'Connection established',
  'Positive response',
  'ESN qualification',
  'Application sent',
  'ESN interview(s)',
  'Final client interview(s)',
  'Proposal received',
  'Contract signed ✅',
] as const

export default class FunnelStageService {
  /**
   * Seed 10 default funnel stages for a newly registered user.
   * Must be called within a database transaction.
   */
  static async seedDefaultStages(
    userId: string,
    trx: TransactionClientContract
  ): Promise<void> {
    const stages = DEFAULT_FUNNEL_STAGES.map((name, index) => ({
      userId,
      name,
      position: index + 1,
    }))

    await FunnelStage.createMany(stages, { client: trx })
  }
}
```

**Why `createMany` over individual `create` calls:** Single round-trip to DB — more efficient and atomic within the transaction.

---

### Critical: Test Patterns

**File:** `apps/backend/tests/functional/funnel_stages/schema.spec.ts`

Key patterns from Epic 1:
- Use dedicated email domain: `@test-funnel-schema.com`
- `group.each.teardown` to clean up users AND their cascade-deleted funnel stages
- `loginAs(user)` not needed for this story (no API endpoints yet — tested via direct model queries)
- Can call `POST /api/auth/register` to trigger seeding and then query DB directly

```typescript
import { test } from '@japa/runner'
import User from '#models/user'
import FunnelStage from '#models/funnel_stage'

const TEST_EMAIL_DOMAIN = '@test-funnel-schema.com'

test.group('FunnelStage schema and default seeding', (group) => {
  group.each.teardown(async () => {
    // Cascade delete via DB constraint handles funnel_stages cleanup
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).forceDelete()
  })

  test('registration creates 10 default funnel stages for new user', async ({ client, assert }) => {
    const response = await client.post('/api/auth/register').json({
      email: `seed-test${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    response.assertStatus(201)

    const userId = response.body().user.id
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')

    assert.lengthOf(stages, 10)
    assert.equal(stages[0].name, 'Lead qualified')
    assert.equal(stages[0].position, 1)
    assert.equal(stages[9].name, 'Contract signed ✅')
    assert.equal(stages[9].position, 10)
  })

  test('forUser scope isolates stages between users', async ({ client, assert }) => {
    const resA = await client.post('/api/auth/register').json({
      email: `user-a${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    const resB = await client.post('/api/auth/register').json({
      email: `user-b${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })

    const userAId = resA.body().user.id
    const userBId = resB.body().user.id

    const stagesA = await FunnelStage.query().withScopes((s) => s.forUser(userAId))
    const stagesB = await FunnelStage.query().withScopes((s) => s.forUser(userBId))

    assert.lengthOf(stagesA, 10)
    assert.lengthOf(stagesB, 10)
    // Verify no cross-contamination
    assert.isTrue(stagesA.every((s) => s.userId === userAId))
    assert.isTrue(stagesB.every((s) => s.userId === userBId))
  })

  test('soft-deleted stages are excluded from default queries', async ({ client, assert }) => {
    const response = await client.post('/api/auth/register').json({
      email: `soft-delete-test${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    const userId = response.body().user.id

    // Soft-delete the first stage
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .where('position', 1)
      .firstOrFail()
    await stage.delete() // SoftDeletes sets deleted_at

    // Default query should exclude it
    const activeStages = await FunnelStage.query().withScopes((s) => s.forUser(userId))
    assert.lengthOf(activeStages, 9)
  })
})
```

**Important note on `forceDelete`:** `adonis-lucid-soft-deletes` overrides `.delete()` to set `deleted_at`. To actually hard-delete (needed in test teardown to clean the DB), use `.forceDelete()`.

---

### Project Structure Notes

**New files to CREATE:**
```
apps/backend/
├── database/migrations/
│   └── 0002_create_funnel_stages_table.ts    # NEW
├── app/
│   ├── models/
│   │   └── funnel_stage.ts                   # NEW
│   └── services/                             # NEW DIRECTORY
│       └── funnel_stage_service.ts           # NEW
└── tests/functional/
    └── funnel_stages/                        # NEW DIRECTORY
        └── schema.spec.ts                    # NEW
```

**Files to MODIFY:**
```
apps/backend/
└── app/controllers/
    └── auth_controller.ts    # MODIFY: wrap User.create + seedDefaultStages in db.transaction()
```

**No frontend changes required for Story 2.1** — This is a backend-only database schema story.

**Import alias to use:** `#services/funnel_stage_service` (via `package.json` `imports` field — **`#services/*` alias already exists** → `"./app/services/*.js"`. No changes to `package.json` needed. Only the physical `services/` directory needs to be created.)

---

### Architecture Compliance

| Requirement | Implementation |
|-------------|----------------|
| User isolation | `forUser(userId)` scope on FunnelStage model (NOT RLS) |
| Soft delete | `adonis-lucid-soft-deletes` v2.1.0 (`SoftDeletes` mixin) |
| UUID primary keys | `gen_random_uuid()` via `this.db.rawQuery()` |
| Snake_case DB columns | `user_id`, `deleted_at`, `created_at` |
| camelCase model properties | `userId`, `deletedAt`, `createdAt` (Lucid maps automatically) |
| Transaction safety | `db.transaction()` wraps user creation + stage seeding |
| No hard deletes | `.delete()` sets `deleted_at`, `.forceDelete()` only in tests |

---

### Library & Framework Requirements

| Library | Version | Usage |
|---------|---------|-------|
| `@adonisjs/lucid` | Already installed | `BaseModel`, `column`, `scope`, `belongsTo`, `db.transaction()` |
| `adonis-lucid-soft-deletes` | `^2.1.0` | `SoftDeletes` mixin — already installed in Epic 1 |
| `@adonisjs/core/helpers` | Already installed | `compose()` helper |

**No new packages needed.** All required libraries are already installed.

---

### Previous Story Intelligence (Epic 1)

**Critical patterns from Story 1-8 (most recent):**

- `ENV_PATH=../../ node ace migration:run` — ALWAYS required for ace commands from `apps/backend/` (monorepo root .env)
- `pnpm biome check --write .` — Biome v2 auto-fixes import order and formatting
- Biome import order: `@` scoped packages → `#` aliases → relative imports (alphabetical within each group)
- `npm install --omit=dev` (not `npm ci`) in Dockerfile — `ace build` output has no `package-lock.json`
- Root `.dockerignore` is the only one Docker reads when `context: .`

**Critical patterns from Story 1-7 (auth):**
- `loginAs(user)` for authenticated test routes — not needed for Story 2.1 (no API endpoints)
- Test teardown uses `whereILike` + dedicated email domain for cleanup isolation
- 21 existing tests (17 functional + 4 unit) — must remain passing

**Epic 1 retrospective decision:**
- `#kernel` alias does NOT exist — use `#start/kernel`
- `assertCookieMissing` does not work for AdonisJS sessions — don't use it
- `adonis-lucid-soft-deletes` `.delete()` sets `deleted_at`, use `.forceDelete()` for hard delete in tests

---

### Git Intelligence

**Recent commit pattern:**
- Branch naming convention: `story-2-1` (expected)
- Commit format: `feat(funnel): description` or `feat(db): description`
- Recent relevant: `c226087 BMAD(architecture): transition from Supabase to local PostgreSQL`

**Key recent changes affecting this story:**
- Story 1-8 confirmed: NO RLS, NO Supabase — plain PostgreSQL + `forUser()` scope
- `0002_enable_rls_on_users.ts` was deleted — next migration starts at `0002_create_funnel_stages_table.ts`
- Auth controller is clean and ready to modify

---

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Create Funnel Stages Database Schema]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2: Funnel Configuration]
- [Source: _bmad-output/planning-artifacts/epics.md#FR38-FR44]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns]
- [Source: _bmad-output/implementation-artifacts/epic-1-retrospective.md#Impact sur Epic 2]
- [Source: _bmad-output/implementation-artifacts/1-8-setup-docker-production-environment.md#Dev Notes]
- [Source: apps/backend/app/models/user.ts — forUser scope pattern]
- [Source: apps/backend/database/migrations/0001_create_users_table.ts — migration pattern]
- [Source: apps/backend/app/controllers/auth_controller.ts — registration flow]
- [Source: apps/backend/tests/functional/auth/register.spec.ts — test pattern]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

- **Migration ordering bug**: `await this.schema.raw()` caused immediate SQL execution before `createTable` completed → fixed by removing `await`. Both calls must be queued on the same Knex schema builder without `await`.
- **Test teardown error**: `forceDelete is not a function` on query builder → `adonis-lucid-soft-deletes` only exposes `forceDelete()` on model instances, not query builder chains. Fixed to `.delete()` (hard-delete on query builder).
- **Stale test data**: Previous failed run left `seed-test@test-funnel-schema.com` in DB → added `group.setup` cleanup before group runs.
- **Biome lint**: `noStaticOnlyClass` on `FunnelStageService` class → refactored to plain exported async function `seedDefaultStages()`.

### Completion Notes List

- All 9 acceptance criteria satisfied.
- `FunnelStageService` implemented as plain exported function (not class) — Biome `noStaticOnlyClass` rule disallows static-only classes.
- Story Dev Notes contain `await` before `this.schema.raw()` in the migration snippet — the actual file does NOT have `await` (correct). The story template snipped was not updated but the implementation is correct.
- Test file includes `group.setup` (cleanup before group) in addition to `group.each.teardown` — handles leftover data from previously failed runs.
- `group.each.teardown` uses `.delete()` on query builder (raw SQL DELETE, bypassing SoftDeletes) — cascade on `user_id` FK removes funnel stages automatically.
- 22 tests total: 17 pre-existing functional (auth) + 5 new funnel stage tests. All pass.
- Lint: 0 errors, 0 warnings after `pnpm biome check --write .`.

### File List

**New files:**
- `apps/backend/database/migrations/0002_create_funnel_stages_table.ts`
- `apps/backend/app/models/funnel_stage.ts`
- `apps/backend/app/services/funnel_stage_service.ts`
- `apps/backend/tests/functional/funnel_stages/schema.spec.ts`

**Modified files:**
- `apps/backend/app/controllers/auth_controller.ts` — added `db` import, `seedDefaultStages` import, wrapped User.create + seeding in `db.transaction()`
