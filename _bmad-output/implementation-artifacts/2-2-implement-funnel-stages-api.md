# Story 2.2: Implement Funnel Stages API

Status: done

<!-- Ultimate Context Engine Analysis: 2026-02-22 -->
<!-- Previous story: 2-1-create-funnel-stages-database-schema (done) -->

## Story

As a **developer**,
I want **REST API endpoints to manage funnel stages**,
So that **the frontend can perform CRUD operations on stages**.

## Acceptance Criteria

1. **AC1 (GET list):** `GET /api/funnel_stages` returns `{ data: [...], meta: { total: n } }` — active stages only, ordered by `position` ASC. Each stage includes `id`, `userId`, `name`, `position`, `createdAt`, `updatedAt`.
2. **AC2 (include_archived):** `GET /api/funnel_stages?include_archived=true` includes soft-deleted stages in the response.
3. **AC3 (POST create):** `POST /api/funnel_stages` with `{ name }` creates a new stage at `position = max(active positions) + 1` and returns the created stage as a direct object (HTTP 201).
4. **AC4 (PUT update):** `PUT /api/funnel_stages/:id` with `{ name }` updates the stage name and returns the updated stage.
5. **AC5 (DELETE soft-delete):** `DELETE /api/funnel_stages/:id` soft-deletes the stage (`deleted_at = now()`). Returns 200. Stage no longer appears in active list.
6. **AC6 (PUT reorder):** `PUT /api/funnel_stages/reorder` with `{ order: ["uuid1", "uuid2", ...] }` (full list of all active stage IDs in desired order) reassigns positions sequentially (1, 2, 3...). Returns updated ordered list.
7. **AC7 (auth required):** All endpoints return 401 for unauthenticated requests.
8. **AC8 (user isolation):** Users only see and modify their own stages — never another user's stages.
9. **AC9 (lint + tests):** `pnpm lint` passes from root; `ENV_PATH=../../ node ace test functional` passes all tests (existing + new).

## Tasks / Subtasks

- [x] **Task 1: Create VineJS validator** (AC: 3, 4, 6)
  - [x] 1.1 Create `apps/backend/app/validators/funnel_stages.ts`
  - [x] 1.2 Export `createFunnelStageValidator` — `name` required, string, min 1, max 255
  - [x] 1.3 Export `updateFunnelStageValidator` — `name` required, string, min 1, max 255
  - [x] 1.4 Export `reorderFunnelStagesValidator` — `order` required, array of UUID strings, minLength 1

- [x] **Task 2: Create FunnelStagesController** (AC: 1–6)
  - [x] 2.1 Create `apps/backend/app/controllers/funnel_stages_controller.ts`
  - [x] 2.2 Implement `index()` — list active stages with optional `?include_archived=true`
  - [x] 2.3 Implement `store()` — create new stage at max position + 1
  - [x] 2.4 Implement `update()` — update stage name (verify user owns stage via forUser scope)
  - [x] 2.5 Implement `destroy()` — soft-delete stage (verify user owns stage via forUser scope)
  - [x] 2.6 Implement `reorder()` — two-step transaction to atomically reassign positions

- [x] **Task 3: Register routes** (AC: 7, 8)
  - [x] 3.1 Update `apps/backend/start/routes.ts` to add `FunnelStagesController` lazy import
  - [x] 3.2 Add `/funnel_stages` route group with `middleware.auth()`
  - [x] 3.3 **CRITICAL ORDER**: Register `PUT /reorder` BEFORE `PUT /:id` (else "reorder" matches as `:id`)

- [x] **Task 4: Write functional tests** (AC: 9)
  - [x] 4.1 Create `apps/backend/tests/functional/funnel_stages/api.spec.ts`
  - [x] 4.2 Test `GET /api/funnel_stages` returns default stages for authenticated user
  - [x] 4.3 Test `GET /api/funnel_stages?include_archived=true` includes soft-deleted stages
  - [x] 4.4 Test `POST /api/funnel_stages` creates stage at correct position
  - [x] 4.5 Test `PUT /api/funnel_stages/:id` updates name
  - [x] 4.6 Test `DELETE /api/funnel_stages/:id` soft-deletes stage
  - [x] 4.7 Test `PUT /api/funnel_stages/reorder` correctly reassigns positions
  - [x] 4.8 Test 401 for unauthenticated requests
  - [x] 4.9 Test user isolation (user B cannot see/modify user A's stages)

- [x] **Task 5: Verification** (AC: 9)
  - [x] 5.1 `ENV_PATH=../../ node ace test functional` → all tests pass (from `apps/backend/`)
  - [x] 5.2 `pnpm lint` from root → no errors

## Dev Notes

### CRITICAL: Route Registration Order

**File:** `apps/backend/start/routes.ts`

```typescript
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const FunnelStagesController = () => import('#controllers/funnel_stages_controller')

router
  .group(() => {
    router.get('/health', async ({ response }) => {
      return response.ok({ status: 'ok' })
    })

    // Auth routes
    router
      .group(() => {
        router.get('/registration-status', [AuthController, 'registrationStatus'])
        router.post('/register', [AuthController, 'register']).use(middleware.guest())
        router.post('/login', [AuthController, 'login']).use(middleware.guest())
        router.get('/me', [AuthController, 'me']).use(middleware.auth())
        router.post('/logout', [AuthController, 'logout']).use(middleware.auth())
      })
      .prefix('/auth')

    // Funnel stages routes — ALL require auth
    router
      .group(() => {
        // ⚠️ CRITICAL: reorder MUST be before /:id — otherwise "reorder" is matched as an ID
        router.put('/reorder', [FunnelStagesController, 'reorder'])
        router.get('/', [FunnelStagesController, 'index'])
        router.post('/', [FunnelStagesController, 'store'])
        router.put('/:id', [FunnelStagesController, 'update'])
        router.delete('/:id', [FunnelStagesController, 'destroy'])
      })
      .prefix('/funnel_stages')
      .use(middleware.auth())
  })
  .prefix('/api')
```

---

### CRITICAL: VineJS Validator

**File:** `apps/backend/app/validators/funnel_stages.ts`

```typescript
import vine from '@vinejs/vine'

export const createFunnelStageValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
  }),
)

export const updateFunnelStageValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
  }),
)

export const reorderFunnelStagesValidator = vine.compile(
  vine.object({
    order: vine.array(vine.string().uuid()).minLength(1),
  }),
)
```

**Import alias:** `#validators/funnel_stages` (already registered in `package.json` as `./app/validators/*.js`)

---

### CRITICAL: FunnelStagesController

**File:** `apps/backend/app/controllers/funnel_stages_controller.ts`

**Import order (Biome-compliant):** `@` scoped → `#` aliases → relative

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import FunnelStage from '#models/funnel_stage'
import {
  createFunnelStageValidator,
  reorderFunnelStagesValidator,
  updateFunnelStageValidator,
} from '#validators/funnel_stages'

export default class FunnelStagesController {
  /**
   * GET /api/funnel_stages
   * Returns active stages ordered by position. Pass ?include_archived=true to include soft-deleted.
   */
  async index({ request, response, auth }: HttpContext) {
    const userId = auth.user!.id
    const includeArchived = request.qs().include_archived === 'true'

    const query = FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')

    if (includeArchived) {
      query.withTrashed()
    }

    const stages = await query
    return response.ok({ data: stages, meta: { total: stages.length } })
  }

  /**
   * POST /api/funnel_stages
   * Creates a new stage at position = max(active positions) + 1.
   */
  async store({ request, response, auth }: HttpContext) {
    const { name } = await request.validateUsing(createFunnelStageValidator)
    const userId = auth.user!.id

    // Find the last active stage to determine next position
    const lastStage = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'desc')
      .first()

    const newPosition = lastStage ? lastStage.position + 1 : 1

    const stage = await FunnelStage.create({ userId, name, position: newPosition })
    return response.created(stage)
  }

  /**
   * PUT /api/funnel_stages/:id
   * Updates the name of a stage owned by the authenticated user.
   */
  async update({ params, request, response, auth }: HttpContext) {
    const { name } = await request.validateUsing(updateFunnelStageValidator)
    const userId = auth.user!.id

    // forUser scope ensures we only find stages belonging to this user
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    stage.name = name
    await stage.save()
    return response.ok(stage)
  }

  /**
   * DELETE /api/funnel_stages/:id
   * Soft-deletes the stage (sets deleted_at via adonis-lucid-soft-deletes).
   */
  async destroy({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    await stage.delete() // SoftDeletes mixin: sets deleted_at, does NOT hard-delete
    return response.ok({ message: 'Stage deleted' })
  }

  /**
   * PUT /api/funnel_stages/reorder
   * Reorders all active stages by reassigning positions sequentially.
   * Body: { order: ["uuid1", "uuid2", ...] } — complete ordered list of ALL active stage IDs.
   */
  async reorder({ request, response, auth }: HttpContext) {
    const { order } = await request.validateUsing(reorderFunnelStagesValidator)
    const userId = auth.user!.id

    // Validate: all IDs must belong to this user and be active
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .whereIn('id', order)

    if (stages.length !== order.length) {
      return response.badRequest({
        errors: [{ message: 'Some stage IDs are invalid or do not belong to you', rule: 'invalid' }],
      })
    }

    // Two-step reorder to avoid partial unique index constraint violations.
    // The index: UNIQUE (user_id, position) WHERE deleted_at IS NULL
    // Per-statement constraint checking means we can't directly swap positions.
    // Solution: first move all to temp positions (≥10000), then set final positions.
    await db.transaction(async (trx) => {
      // Step 1: Move to temp positions — no conflicts since 10000+ is outside valid range (max 15)
      for (const [idx, stageId] of order.entries()) {
        await FunnelStage.query({ client: trx })
          .where('id', stageId)
          .update({ position: 10000 + idx + 1 })
      }

      // Step 2: Set final sequential positions (1, 2, 3...)
      // Safe: all active stages in `order` are now at temp positions
      for (const [idx, stageId] of order.entries()) {
        await FunnelStage.query({ client: trx })
          .where('id', stageId)
          .update({ position: idx + 1 })
      }
    })

    // Return updated ordered list
    const updatedStages = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')

    return response.ok({ data: updatedStages, meta: { total: updatedStages.length } })
  }
}
```

**Why `query.withTrashed()` works:** `adonis-lucid-soft-deletes` adds a global scope `WHERE deleted_at IS NULL` by default. Calling `.withTrashed()` removes that global scope, allowing all records (including soft-deleted) to appear.

**Why `firstOrFail()` in update/destroy:** If the stage ID doesn't exist OR doesn't belong to this user (because `forUser()` filters it), AdonisJS throws a 404 (ModelNotFoundException), which is the correct HTTP behavior.

**Why `stage.delete()` NOT `query.delete()`:** On a model INSTANCE, `.delete()` is overridden by the `SoftDeletes` mixin to set `deleted_at`. On a query BUILDER, `.delete()` executes a raw SQL DELETE (hard delete, bypasses soft deletes). Always call soft delete on a model instance.

---

### CRITICAL: Response Format

Per architecture: lists use `{ data: [...], meta: { total: n } }`, single objects are returned directly.

| Action | HTTP Status | Response Body |
|--------|-------------|---------------|
| `index` | 200 | `{ data: [...stages], meta: { total: n } }` |
| `store` | 201 | Stage object directly (Lucid model) |
| `update` | 200 | Stage object directly |
| `destroy` | 200 | `{ message: 'Stage deleted' }` |
| `reorder` | 200 | `{ data: [...stages], meta: { total: n } }` |

**Note:** Lucid models serialize cleanly to JSON via `.toJSON()` or implicit serialization. `response.created(stage)` and `response.ok(stage)` work directly with model instances.

---

### CRITICAL: Test Patterns

**File:** `apps/backend/tests/functional/funnel_stages/api.spec.ts`

Key patterns from Epic 1 + Story 2.1:
- Dedicated email domain: `@test-funnel-api.com` (unique per test file to avoid cross-contamination)
- `group.setup(async () => { cleanup leftover data })` + `group.each.teardown(async () => { cleanup })`
- `loginAs(user)` requires a Lucid model instance — retrieve with `User.findOrFail(userId)`
- `.delete()` on query builder = raw SQL DELETE (hard delete, safe for teardown). Cascade removes stages.
- Session for the registered user: register via API, get userId from response, then `User.findOrFail(userId)`

```typescript
import { test } from '@japa/runner'
import FunnelStage from '#models/funnel_stage'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@test-funnel-api.com'

test.group('FunnelStages API', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  // Helper to register a user and return the model instance for loginAs
  async function registerUser(client: any, prefix: string) {
    const res = await client.post('/api/auth/register').json({
      email: `${prefix}${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    res.assertStatus(201)
    const userId = res.body().user.id
    return User.findOrFail(userId)
  }

  test('GET /api/funnel_stages returns active stages ordered by position', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-list')
    const response = await client.get('/api/funnel_stages').loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.property(body, 'data')
    assert.property(body, 'meta')
    // Default funnel stages were seeded in registration (Story 2.1)
    assert.isAbove(body.data.length, 0)
    // Verify ordering
    const positions = body.data.map((s: any) => s.position)
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
  })

  test('GET /api/funnel_stages?include_archived=true includes soft-deleted stages', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-archived')

    // Soft-delete one stage directly
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')
      .firstOrFail()
    await stage.delete()

    const activeResponse = await client.get('/api/funnel_stages').loginAs(user)
    const archivedResponse = await client
      .get('/api/funnel_stages?include_archived=true')
      .loginAs(user)

    assert.isAbove(archivedResponse.body().data.length, activeResponse.body().data.length)
  })

  test('POST /api/funnel_stages creates stage at correct position', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'post-create')

    const activeStages = await FunnelStage.query().withScopes((s) => s.forUser(user.id))
    const expectedPosition = Math.max(...activeStages.map((s) => s.position)) + 1

    const response = await client
      .post('/api/funnel_stages')
      .loginAs(user)
      .json({ name: 'New Test Stage' })

    response.assertStatus(201)
    assert.equal(response.body().name, 'New Test Stage')
    assert.equal(response.body().position, expectedPosition)
  })

  test('PUT /api/funnel_stages/:id updates stage name', async ({ client, assert }) => {
    const user = await registerUser(client, 'put-update')
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .firstOrFail()

    const response = await client
      .put(`/api/funnel_stages/${stage.id}`)
      .loginAs(user)
      .json({ name: 'Updated Stage Name' })

    response.assertStatus(200)
    assert.equal(response.body().name, 'Updated Stage Name')
  })

  test('DELETE /api/funnel_stages/:id soft-deletes stage', async ({ client, assert }) => {
    const user = await registerUser(client, 'delete-soft')
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .firstOrFail()

    const deleteResponse = await client
      .delete(`/api/funnel_stages/${stage.id}`)
      .loginAs(user)

    deleteResponse.assertStatus(200)

    // Stage should not appear in active list
    const listResponse = await client.get('/api/funnel_stages').loginAs(user)
    const ids = listResponse.body().data.map((s: any) => s.id)
    assert.notInclude(ids, stage.id)

    // But should appear with include_archived=true
    const archivedResponse = await client
      .get('/api/funnel_stages?include_archived=true')
      .loginAs(user)
    const archivedIds = archivedResponse.body().data.map((s: any) => s.id)
    assert.include(archivedIds, stage.id)
  })

  test('PUT /api/funnel_stages/reorder correctly reassigns positions', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'put-reorder')
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')

    // Reverse the order
    const reversedIds = [...stages].reverse().map((s) => s.id)

    const response = await client
      .put('/api/funnel_stages/reorder')
      .loginAs(user)
      .json({ order: reversedIds })

    response.assertStatus(200)

    // Verify positions match the provided order
    const returnedIds = response.body().data.map((s: any) => s.id)
    assert.deepEqual(returnedIds, reversedIds)
    const returnedPositions = response.body().data.map((s: any) => s.position)
    assert.deepEqual(returnedPositions, reversedIds.map((_: string, i: number) => i + 1))
  })

  test('returns 401 for unauthenticated requests', async ({ client }) => {
    const getRes = await client.get('/api/funnel_stages')
    getRes.assertStatus(401)

    const postRes = await client.post('/api/funnel_stages').json({ name: 'Test' })
    postRes.assertStatus(401)
  })

  test('user isolation: cannot access another user stages', async ({ client, assert }) => {
    const userA = await registerUser(client, 'iso-user-a')
    const userB = await registerUser(client, 'iso-user-b')

    // Get a stage ID from user A
    const stagesA = await FunnelStage.query().withScopes((s) => s.forUser(userA.id))
    const stageAId = stagesA[0].id

    // User B trying to update/delete user A's stage should return 404 (not 403)
    const updateRes = await client
      .put(`/api/funnel_stages/${stageAId}`)
      .loginAs(userB)
      .json({ name: 'Hacked' })
    updateRes.assertStatus(404) // forUser scope + firstOrFail → 404 not found

    const deleteRes = await client.delete(`/api/funnel_stages/${stageAId}`).loginAs(userB)
    deleteRes.assertStatus(404)

    // User B's list should NOT contain user A's stages
    const listRes = await client.get('/api/funnel_stages').loginAs(userB)
    const ids = listRes.body().data.map((s: any) => s.id)
    assert.notInclude(ids, stageAId)
  })
})
```

---

### Architecture Compliance

| Requirement | Implementation |
|-------------|----------------|
| User isolation | `forUser(userId)` scope on ALL queries — never omit |
| Soft delete | `stage.delete()` on model instance (NOT query builder) |
| Auth enforcement | `middleware.auth()` on entire funnel_stages route group |
| Snake_case API | Route: `/api/funnel_stages` (snake_case plural) |
| Response format | Lists: `{ data, meta }` — Singles: direct object |
| Error format | Adonis default: `{ errors: [{ message, rule }] }` |
| No hard deletes | Only `forceDelete()` in teardown (test cleanup) |
| Transactions | `db.transaction()` for reorder (two-step position swap) |

---

### Library & Framework Requirements

| Library | Usage |
|---------|-------|
| `@adonisjs/core/http` | `HttpContext` type |
| `@adonisjs/lucid/services/db` | `db.transaction()` for reorder |
| `#models/funnel_stage` | `FunnelStage` model (already created in Story 2.1) |
| `#validators/funnel_stages` | New validator file to create |
| `adonis-lucid-soft-deletes` | `.delete()` on instance = soft delete; `.withTrashed()` = include archived |
| `@vinejs/vine` | Already installed — VineJS validators |

**No new packages needed.** All required libraries are already installed.

---

### Project Structure Notes

**New files to CREATE:**
```
apps/backend/
├── app/
│   ├── controllers/
│   │   └── funnel_stages_controller.ts    # NEW
│   └── validators/
│       └── funnel_stages.ts               # NEW
└── tests/functional/
    └── funnel_stages/
        └── api.spec.ts                    # NEW
```

**Files to MODIFY:**
```
apps/backend/
└── start/
    └── routes.ts    # ADD FunnelStagesController lazy import + route group
```

**No frontend changes required for Story 2.2** — This is a backend-only API story. The frontend (Settings UI) is Story 2.3.

**Import aliases:**
- `#controllers/funnel_stages_controller` — resolves to `./app/controllers/funnel_stages_controller.js`
- `#validators/funnel_stages` — resolves to `./app/validators/funnel_stages.js`

Both aliases exist in `apps/backend/package.json` `imports` field — no changes needed to `package.json`.

---

### Previous Story Intelligence (Story 2.1 — done)

**What was built:**
- `FunnelStage` model: `apps/backend/app/models/funnel_stage.ts` — USE AS-IS
- `FunnelStageService`: `apps/backend/app/services/funnel_stage_service.ts` — USE AS-IS (no changes needed)
- Migration: `0002_create_funnel_stages_table.ts` — partial unique index `(user_id, position) WHERE deleted_at IS NULL`
- Auth controller updated to seed default stages on registration

**Critical lessons from Story 2.1:**
- `adonis-lucid-soft-deletes` `.delete()` on **instance** = soft delete (sets `deleted_at`)
- `adonis-lucid-soft-deletes` `.delete()` on **query builder** = hard delete (raw SQL DELETE)
- `forceDelete()` is only on model instances, NOT on query builders
- `adonis-lucid-soft-deletes` adds a global `WHERE deleted_at IS NULL` scope automatically
- Biome `noStaticOnlyClass` rule → use plain exported functions (not static-only classes)
- `pnpm biome check --write .` from root auto-fixes import order issues
- Tests with `group.setup` to clean leftover data from previously failed test runs
- The `services/` directory was created in Story 2.1 — it EXISTS

**Partial unique index constraint (from Story 2.1 debug log):**
The index `idx_funnel_stages_user_position_active` on `(user_id, position) WHERE deleted_at IS NULL` is checked per-statement in PostgreSQL. This is why the two-step reorder approach is required — direct position swaps would violate the constraint during intermediate states.

---

### Git Intelligence

**Recent commits:**
- `d61cb62` Merge pull request #8 from RomainSire/story-2.1
- `507d4d9` feat(funnel): code review fixes
- `360362a` feat(funnel): create funnel_stages table and seed default stages for new users

**Expected branch naming:** `story-2-2`
**Expected commit format:** `feat(funnel): implement funnel stages CRUD API`

**Key patterns from Story 2.1 commits:**
- Single commit per story (squash or linear commit with all changes)
- `feat(funnel):` prefix for Epic 2 funnel-related work

---

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2: Implement Funnel Stages API]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2: Funnel Configuration]
- [Source: _bmad-output/planning-artifacts/epics.md#FR38, FR40, FR42]
- [Source: _bmad-output/planning-artifacts/architecture.md#API Boundaries — /api/funnel_stages/*]
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns — API Response Formats]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns — snake_case API endpoints]
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns — Soft Delete]
- [Source: _bmad-output/implementation-artifacts/2-1-create-funnel-stages-database-schema.md#Dev Notes]
- [Source: apps/backend/app/models/funnel_stage.ts — forUser scope, SoftDeletes mixin]
- [Source: apps/backend/start/routes.ts — existing route structure to extend]
- [Source: apps/backend/app/validators/auth.ts — VineJS validator pattern]
- [Source: apps/backend/app/controllers/auth_controller.ts — controller pattern]
- [Source: apps/backend/tests/functional/auth/register.spec.ts — test pattern with loginAs]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

None — implementation proceeded cleanly without errors.

### Completion Notes List

- All 9 acceptance criteria satisfied.
- `FunnelStagesController` created with 5 actions: `index`, `store`, `update`, `destroy`, `reorder`.
- Route ordering confirmed: `PUT /reorder` registered before `PUT /:id` in routes.ts — no routing conflict.
- Two-step reorder transaction verified working: partial unique index `(user_id, position) WHERE deleted_at IS NULL` constraint not violated because all stages move to positions ≥10001 in step 1 before being assigned 1–N in step 2.
- `withTrashed()` from `adonis-lucid-soft-deletes` correctly enables `include_archived=true` behavior.
- `firstOrFail()` combined with `forUser()` scope correctly returns 404 (not 403) when user tries to access another user's stage — avoids data leakage.
- `pnpm lint` exits 0 — 9 `noExplicitAny` warnings in test file (from Japa `.body()` return type, acceptable in test context), 0 errors.
- `adonis-lucid-soft-deletes` v2.1.0 doesn't declare `withTrashed()` in TypeScript types — fixed by adding `apps/backend/types/soft_deletes.d.ts` module augmentation for `@adonisjs/lucid/types/model`. `tsc --noEmit` passes clean.
- 44 total functional tests pass: 22 pre-existing (auth + funnel schema) + 22 new API tests.
- Biome auto-fixed formatting in controller and test files (import ordering, multiline formatting).

### File List

**New files:**
- `apps/backend/app/validators/funnel_stages.ts`
- `apps/backend/app/controllers/funnel_stages_controller.ts`
- `apps/backend/tests/functional/funnel_stages/api.spec.ts`
- `apps/backend/types/soft_deletes.d.ts`
- `.brunoCollection/funnel_stages/List Stages.bru`
- `.brunoCollection/funnel_stages/List Stages (with archived).bru`
- `.brunoCollection/funnel_stages/Create Stage.bru`
- `.brunoCollection/funnel_stages/Update Stage.bru`
- `.brunoCollection/funnel_stages/Delete Stage.bru`
- `.brunoCollection/funnel_stages/Reorder Stages.bru`

**Modified files:**
- `apps/backend/start/routes.ts` — added FunnelStagesController lazy import + `/funnel_stages` route group with `middleware.auth()` + UUID regex matchers on `PUT /:id` and `DELETE /:id`
