# Story 4.2: Implement Positionings CRUD API

Status: review

<!-- Ultimate Context Engine Analysis: 2026-03-07 -->
<!-- Epic 4: Positioning Variants — Story 2 (CRUD API on top of Story 4.1 schema) -->

## Story

As a developer,
I want REST API endpoints to manage positioning variants,
so that the frontend can perform all positioning operations.

## Acceptance Criteria

1. **AC1 (GET list):** `GET /api/positionings` returns `{ data: PositioningType[], meta: { total: number } }` for the authenticated user's active positionings, ordered by `created_at DESC`. Archived positionings are excluded by default; `?include_archived=true` includes them. Response fields per item: `id`, `userId`, `funnelStageId`, `funnelStageName`, `name`, `description`, `content`, `createdAt`, `updatedAt`, `deletedAt`.

2. **AC2 (GET list filter):** `GET /api/positionings?funnel_stage_id=:uuid` filters the list to positionings for that stage only. Non-UUID value → 422. Stage not found or not owned by user → 404. (FR11)

3. **AC3 (GET single):** `GET /api/positionings/:id` returns a single `PositioningType` for the authenticated user. Non-existent or other user's positioning → 404.

4. **AC4 (POST create):** `POST /api/positionings` with `{ name, funnel_stage_id, description?, content? }` creates a positioning → 201 with `PositioningType`. `name` is required (trimmed, 1–255 chars). `funnel_stage_id` required UUID, must belong to the authenticated user (→ 404 if not). (FR10, FR11, FR12)

5. **AC5 (PUT update):** `PUT /api/positionings/:id` with partial `{ name?, funnel_stage_id?, description?, content? }` updates the positioning → 200 with updated `PositioningType`. Ownership enforced (→ 404). If `funnel_stage_id` provided, validate ownership (→ 404). (FR14)

6. **AC6 (DELETE archive):** `DELETE /api/positionings/:id` soft-deletes the positioning → 200 `{ message: 'Positioning archived' }`. Ownership enforced (→ 404). (FR15)

7. **AC7 (GET prospects sub-resource):** `GET /api/positionings/:id/prospects` returns `{ data: ProspectType[], meta: { total: number } }` — all prospects (including archived) that have `positioning_id = :id` for the authenticated user, ordered by `updated_at DESC`. Ownership of the positioning enforced (→ 404). (FR16)

8. **AC8 (Serializer):** `serializePositioning()` in `apps/backend/app/serializers/positioning.ts` maps a preloaded `Positioning` model to `PositioningType`. TypeScript enforces the contract at compile time. Never return raw `.toJSON()`.

9. **AC9 (Shared type):** `PositioningType` in `packages/shared/src/types/positioning.ts` is extended with `funnelStageName: string`. Rebuild shared package after change. All camelCase fields (Lucid v3 default).

10. **AC10 (Auth + isolation):** All routes require `middleware.auth()`. All queries use `.withScopes(s => s.forUser(userId))` for strict user isolation. Unauthenticated requests → 401.

11. **AC11 (Tests):** `apps/backend/tests/functional/positionings/api.spec.ts` covers: list, filter by stage, include_archived, show, create, update, delete, prospects sub-resource, auth (401), user isolation (404 cross-user). All tests pass: `ENV_PATH=../../ node ace test functional`.

12. **AC12 (Lint + type-check):** `pnpm biome check --write .` from root — 0 errors. `pnpm type-check` from root — 0 errors.

## Tasks / Subtasks

- [x] **Task 1: Extend shared PositioningType** (AC9)
  - [x] 1.1 Add `funnelStageName: string` to `PositioningType` in `packages/shared/src/types/positioning.ts`
  - [x] 1.2 Run `pnpm --filter @battlecrm/shared build` to rebuild declaration files

- [x] **Task 2: Create positioning serializer** (AC8, AC9)
  - [x] 2.1 Create `apps/backend/app/serializers/positioning.ts`
  - [x] 2.2 `serializePositioning(positioning: Positioning): PositioningType` — maps all fields including `funnelStageName` from preloaded `positioning.funnelStage.name`

- [x] **Task 3: Create positioning validators** (AC4, AC5)
  - [x] 3.1 Create `apps/backend/app/validators/positionings.ts`
  - [x] 3.2 `createPositioningValidator`: `name` (required, trim, 1–255), `funnel_stage_id` (required, uuid), `description` (optional, nullable, string), `content` (optional, nullable, string)
  - [x] 3.3 `updatePositioningValidator`: all fields optional with same constraints

- [x] **Task 4: Create positionings controller** (AC1–AC7, AC10)
  - [x] 4.1 Create `apps/backend/app/controllers/positionings_controller.ts`
  - [x] 4.2 `index()` — GET list with `include_archived` and `funnel_stage_id` filter (UUID validation + forUser ownership check)
  - [x] 4.3 `show()` — GET single by id
  - [x] 4.4 `store()` — POST create (validate `funnel_stage_id` ownership via `FunnelStage.query().forUser().firstOrFail()`)
  - [x] 4.5 `update()` — PUT update (partial; validate `funnel_stage_id` if provided)
  - [x] 4.6 `destroy()` — DELETE soft-delete
  - [x] 4.7 `prospects()` — GET sub-resource: prospects with `positioning_id = id` (withTrashed on prospects, ordered by `updated_at desc`)

- [x] **Task 5: Register routes** (AC10)
  - [x] 5.1 Add `PositioningsController` import in `apps/backend/start/routes.ts`
  - [x] 5.2 Add positionings route group with `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `GET /:id/prospects`, all with `.where('id', UUID_REGEX)` on parameterized routes, `.use(middleware.auth())`

- [x] **Task 6: Functional tests** (AC11)
  - [x] 6.1 Create `apps/backend/tests/functional/positionings/api.spec.ts`
  - [x] 6.2 Test: GET list — returns active positionings with correct shape
  - [x] 6.3 Test: GET list — excludes soft-deleted by default
  - [x] 6.4 Test: GET list — `?include_archived=true` includes soft-deleted
  - [x] 6.5 Test: GET list — `?funnel_stage_id=:uuid` filters correctly
  - [x] 6.6 Test: GET list — `?funnel_stage_id=invalid` → 422
  - [x] 6.7 Test: GET list — `?funnel_stage_id=` another user's stage uuid → 404
  - [x] 6.8 Test: GET /:id — returns correct positioning
  - [x] 6.9 Test: GET /:id — non-existent → 404
  - [x] 6.10 Test: POST / — creates positioning with all required fields → 201
  - [x] 6.11 Test: POST / — missing name → 422
  - [x] 6.12 Test: POST / — invalid funnel_stage_id (another user's) → 404
  - [x] 6.13 Test: PUT /:id — updates fields correctly → 200
  - [x] 6.14 Test: PUT /:id — non-existent → 404
  - [x] 6.15 Test: DELETE /:id — soft-deletes positioning → 200; no longer in active list
  - [x] 6.16 Test: DELETE /:id — non-existent → 404
  - [x] 6.17 Test: GET /:id/prospects — returns prospects with this positioning
  - [x] 6.18 Test: Auth — unauthenticated requests → 401 (all endpoints)
  - [x] 6.19 Test: Isolation — user B cannot access user A's positionings (404 on show/update/delete)
  - [x] 6.20 Run `ENV_PATH=../../ node ace test functional` — all 147 tests pass (0 regressions)

- [x] **Task 7: Lint + type-check** (AC12)
  - [x] 7.1 `pnpm biome check --write .` from root — 0 errors (2 style fixes auto-applied)
  - [x] 7.2 `pnpm type-check` from root — 0 errors

## Dev Notes

### CRITICAL: funnelStageName addition to PositioningType

The AC requires each positioning list item to include `funnel_stage (name + id)`. `PositioningType` only has `funnelStageId` — add `funnelStageName: string` before any other code.

**File: `packages/shared/src/types/positioning.ts`** — ADD field:

```typescript
export type PositioningType = {
  id: string
  userId: string
  funnelStageId: string
  funnelStageName: string  // ADD THIS — required by Story 4.2 list/show endpoints
  name: string
  description: string | null
  content: string | null
  createdAt: string
  updatedAt: string | null
  deletedAt: string | null
}
```

After editing: `pnpm --filter @battlecrm/shared build`

---

### Task 2: Serializer

**File: `apps/backend/app/serializers/positioning.ts`** (NEW)

```typescript
import type { PositioningType } from '@battlecrm/shared'
import type Positioning from '#models/positioning'

export function serializePositioning(positioning: Positioning): PositioningType {
  return {
    id: positioning.id,
    userId: positioning.userId,
    funnelStageId: positioning.funnelStageId,
    funnelStageName: positioning.funnelStage.name,  // requires preload in controller
    name: positioning.name,
    description: positioning.description,
    content: positioning.content,
    createdAt: positioning.createdAt.toISO()!,
    updatedAt: positioning.updatedAt?.toISO() ?? null,
    deletedAt: positioning.deletedAt?.toISO() ?? null,
  }
}
```

**IMPORTANT:** Every controller action that calls `serializePositioning()` MUST preload `funnelStage` beforehand, otherwise `positioning.funnelStage` will be `undefined` at runtime and TypeScript won't catch it.

Biome import order: `@battlecrm/shared` (`@` scope) → `#models/positioning` (`#` alias).

---

### Task 3: Validators

**File: `apps/backend/app/validators/positionings.ts`** (NEW)

```typescript
import vine from '@vinejs/vine'

export const createPositioningValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    funnel_stage_id: vine.string().uuid(),
    description: vine.string().trim().nullable().optional(),
    content: vine.string().trim().nullable().optional(),
  }),
)

export const updatePositioningValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    funnel_stage_id: vine.string().uuid().optional(),
    description: vine.string().trim().nullable().optional(),
    content: vine.string().trim().nullable().optional(),
  }),
)
```

---

### Task 4: Controller

**File: `apps/backend/app/controllers/positionings_controller.ts`** (NEW)

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import { serializePositioning } from '#serializers/positioning'
import { serializeProspect } from '#serializers/prospect'
import { createPositioningValidator, updatePositioningValidator } from '#validators/positionings'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default class PositioningsController {
  /**
   * GET /api/positionings
   * Returns active positionings ordered by created_at DESC.
   * ?include_archived=true includes soft-deleted.
   * ?funnel_stage_id=:uuid filters by stage (validates ownership).
   */
  async index({ request, response, auth }: HttpContext) {
    const userId = auth.user!.id
    const includeArchived = request.qs().include_archived === 'true'
    const funnelStageId = request.qs().funnel_stage_id as string | undefined

    const query = Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .preload('funnelStage')
      .orderBy('created_at', 'desc')

    if (includeArchived) {
      query.withTrashed()
    }

    if (funnelStageId) {
      if (!UUID_REGEX.test(funnelStageId)) {
        return response.unprocessableEntity({
          errors: [{ message: 'validation.uuid', field: 'funnel_stage_id', rule: 'uuid' }],
        })
      }
      const stage = await FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .where('id', funnelStageId)
        .first()
      if (!stage) {
        return response.notFound()
      }
      query.where('funnel_stage_id', funnelStageId)
    }

    const positionings = await query
    return response.ok({
      data: positionings.map(serializePositioning),
      meta: { total: positionings.length },
    })
  }

  /**
   * GET /api/positionings/:id
   * Returns a single active positioning by ID.
   */
  async show({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    const positioning = await Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .preload('funnelStage')
      .firstOrFail()

    return response.ok(serializePositioning(positioning))
  }

  /**
   * POST /api/positionings
   * Creates a new positioning for the authenticated user.
   */
  async store({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(createPositioningValidator)
    const userId = auth.user!.id

    // SECURITY (M1): validate funnel_stage_id belongs to the authenticated user
    await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', payload.funnel_stage_id)
      .firstOrFail()

    const positioning = new Positioning()
    positioning.userId = userId
    positioning.funnelStageId = payload.funnel_stage_id
    positioning.name = payload.name
    if (payload.description !== undefined) positioning.description = payload.description ?? null
    if (payload.content !== undefined) positioning.content = payload.content ?? null
    await positioning.save()

    // Preload funnel stage for serializer
    await positioning.load('funnelStage')

    return response.created(serializePositioning(positioning))
  }

  /**
   * PUT /api/positionings/:id
   * Updates a positioning owned by the authenticated user (partial update).
   */
  async update({ params, request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(updatePositioningValidator)
    const userId = auth.user!.id

    const positioning = await Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    // SECURITY (M1): validate new funnel_stage_id belongs to the authenticated user
    if (payload.funnel_stage_id !== undefined) {
      await FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .where('id', payload.funnel_stage_id)
        .firstOrFail()
      positioning.funnelStageId = payload.funnel_stage_id
    }

    if (payload.name !== undefined) positioning.name = payload.name
    if (payload.description !== undefined) positioning.description = payload.description ?? null
    if (payload.content !== undefined) positioning.content = payload.content ?? null
    await positioning.save()

    // Reload with preloaded funnelStage for serializer
    const updated = await Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', positioning.id)
      .preload('funnelStage')
      .firstOrFail()

    return response.ok(serializePositioning(updated))
  }

  /**
   * DELETE /api/positionings/:id
   * Soft-deletes a positioning (sets deleted_at via adonis-lucid-soft-deletes).
   */
  async destroy({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    const positioning = await Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    await positioning.delete() // SoftDeletes: sets deleted_at = now()
    return response.ok({ message: 'Positioning archived' })
  }

  /**
   * GET /api/positionings/:id/prospects
   * Returns all prospects (including archived) linked to this positioning.
   */
  async prospects({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    // Verify positioning belongs to user (active positionings only — archived can be fetched via include_archived)
    const positioning = await Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    // Include archived prospects — historical data matters for positioning analysis (FR16)
    const linkedProspects = await Prospect.query()
      .withTrashed()
      .withScopes((s) => s.forUser(userId))
      .where('positioning_id', positioning.id)
      .orderBy('updated_at', 'desc')

    return response.ok({
      data: linkedProspects.map(serializeProspect),
      meta: { total: linkedProspects.length },
    })
  }
}
```

**Biome import order:** `@adonisjs/core/http` → `#models/*` (alphabetical: FunnelStage, Positioning, Prospect) → `#serializers/*` (alphabetical) → `#validators/positionings`.

---

### Task 5: Routes

**File: `apps/backend/start/routes.ts`** — ADD positionings route group:

```typescript
// Add import at top with other controller imports:
const PositioningsController = () => import('#controllers/positionings_controller')

// Add route group before the closing .prefix('/api'):
router
  .group(() => {
    router.get('/', [PositioningsController, 'index'])
    router.post('/', [PositioningsController, 'store'])
    router.get('/:id', [PositioningsController, 'show']).where('id', UUID_REGEX)
    router.put('/:id', [PositioningsController, 'update']).where('id', UUID_REGEX)
    router.delete('/:id', [PositioningsController, 'destroy']).where('id', UUID_REGEX)
    router
      .get('/:id/prospects', [PositioningsController, 'prospects'])
      .where('id', UUID_REGEX)
  })
  .prefix('/positionings')
  .use(middleware.auth())
```

**Note:** No static sub-routes that conflict with `/:id` (unlike funnel_stages `reorder`), so no special ordering needed.

---

### Task 6: Functional Tests — Key Patterns

**File: `apps/backend/tests/functional/positionings/api.spec.ts`** (NEW)

Test domain: `@test-positionings-api.com`

**Setup helper pattern (identical to funnel_stages/api.spec.ts):**

```typescript
const TEST_EMAIL_DOMAIN = '@test-positionings-api.com'

test.group('Positionings API', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })
  group.each.teardown(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  async function registerUser(client: ApiClient, prefix: string): Promise<User> {
    const res = await client.post('/api/auth/register').json({
      email: `${prefix}${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    res.assertStatus(201)
    return User.findOrFail(res.body().user.id)
  }

  async function getUserFirstStage(userId: string): Promise<FunnelStage> {
    return FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')
      .firstOrFail()
  }

  async function createPositioning(userId: string, stageId: string, name = 'Test Positioning') {
    return Positioning.create({ userId, funnelStageId: stageId, name })
  }
  ...
})
```

**Critical test scenarios:**

```typescript
// GET list — verify shape includes funnelStageName
test('GET /api/positionings returns positionings with funnelStageName', async ({ client, assert }) => {
  const user = await registerUser(client, 'get-list')
  const stage = await getUserFirstStage(user.id)
  await createPositioning(user.id, stage.id, 'My Positioning')

  const response = await client.get('/api/positionings').loginAs(user)
  response.assertStatus(200)
  const body = response.body()
  assert.property(body, 'data')
  assert.property(body, 'meta')
  assert.equal(body.data[0].funnelStageName, stage.name)  // key assertion
  assert.equal(body.data[0].funnelStageId, stage.id)
})

// GET list — exclude archived by default
test('GET /api/positionings excludes soft-deleted by default', async ({ client, assert }) => {
  const user = await registerUser(client, 'get-excl-archived')
  const stage = await getUserFirstStage(user.id)
  const p = await createPositioning(user.id, stage.id)
  await p.delete()  // soft-delete

  const response = await client.get('/api/positionings').loginAs(user)
  response.assertStatus(200)
  const ids = response.body().data.map((p: { id: string }) => p.id)
  assert.notInclude(ids, p.id)
})

// GET list — include_archived=true
test('GET /api/positionings?include_archived=true includes soft-deleted', async ({ client, assert }) => { ... })

// GET list — funnel_stage_id filter
test('GET /api/positionings?funnel_stage_id=:uuid filters by stage', async ({ client, assert }) => {
  const user = await registerUser(client, 'get-filter')
  const stages = await FunnelStage.query().withScopes((s) => s.forUser(user.id)).orderBy('position', 'asc')
  await createPositioning(user.id, stages[0].id, 'Stage 1 Positioning')
  await createPositioning(user.id, stages[1].id, 'Stage 2 Positioning')

  const response = await client.get(`/api/positionings?funnel_stage_id=${stages[0].id}`).loginAs(user)
  response.assertStatus(200)
  const names = response.body().data.map((p: { name: string }) => p.name)
  assert.include(names, 'Stage 1 Positioning')
  assert.notInclude(names, 'Stage 2 Positioning')
})

// funnel_stage_id — non-UUID → 422
test('GET /api/positionings?funnel_stage_id=invalid returns 422', async ({ client }) => {
  const user = await registerUser(client, 'get-filter-invalid')
  const response = await client.get('/api/positionings?funnel_stage_id=not-a-uuid').loginAs(user)
  response.assertStatus(422)
})

// POST create
test('POST /api/positionings creates positioning → 201', async ({ client, assert }) => {
  const user = await registerUser(client, 'post-create')
  const stage = await getUserFirstStage(user.id)
  const response = await client.post('/api/positionings').loginAs(user).json({
    name: 'CV v1',
    funnel_stage_id: stage.id,
    description: 'First attempt',
  })
  response.assertStatus(201)
  assert.equal(response.body().name, 'CV v1')
  assert.equal(response.body().funnelStageId, stage.id)
  assert.equal(response.body().funnelStageName, stage.name)
  assert.isDefined(response.body().id)
})

// PUT update
test('PUT /api/positionings/:id updates positioning → 200', async ({ client, assert }) => {
  const user = await registerUser(client, 'put-update')
  const stage = await getUserFirstStage(user.id)
  const p = await createPositioning(user.id, stage.id)

  const response = await client
    .put(`/api/positionings/${p.id}`)
    .loginAs(user)
    .json({ name: 'Updated Name' })
  response.assertStatus(200)
  assert.equal(response.body().name, 'Updated Name')
})

// DELETE soft-delete
test('DELETE /api/positionings/:id soft-deletes → 200', async ({ client, assert }) => {
  const user = await registerUser(client, 'delete-soft')
  const stage = await getUserFirstStage(user.id)
  const p = await createPositioning(user.id, stage.id)

  const deleteResponse = await client.delete(`/api/positionings/${p.id}`).loginAs(user)
  deleteResponse.assertStatus(200)

  const listResponse = await client.get('/api/positionings').loginAs(user)
  const ids = listResponse.body().data.map((item: { id: string }) => item.id)
  assert.notInclude(ids, p.id)
})

// GET /:id/prospects
test('GET /api/positionings/:id/prospects returns linked prospects', async ({ client, assert }) => {
  const user = await registerUser(client, 'get-prospects')
  const stage = await getUserFirstStage(user.id)
  const p = await createPositioning(user.id, stage.id)

  // Create a prospect linked to this positioning via API (validates the FK chain)
  const prospectRes = await client.post('/api/prospects').loginAs(user).json({
    name: 'Jane Doe',
    funnel_stage_id: stage.id,
    positioning_id: p.id,
  })
  prospectRes.assertStatus(201)

  const response = await client.get(`/api/positionings/${p.id}/prospects`).loginAs(user)
  response.assertStatus(200)
  assert.property(response.body(), 'data')
  assert.equal(response.body().data.length, 1)
  assert.equal(response.body().data[0].name, 'Jane Doe')
})

// Isolation
test('user isolation: cannot access another user positionings (404)', async ({ client }) => {
  const userA = await registerUser(client, 'iso-a')
  const userB = await registerUser(client, 'iso-b')
  const stage = await getUserFirstStage(userA.id)
  const p = await createPositioning(userA.id, stage.id)

  const response = await client.get(`/api/positionings/${p.id}`).loginAs(userB)
  response.assertStatus(404)
})
```

---

### Architecture Compliance Checklist

- All queries: `.withScopes(s => s.forUser(userId))` — no exceptions
- UUID filter params: validate with `UUID_REGEX` before DB query (PostgreSQL throws 500 on invalid UUID format in uuid column)
- `funnel_stage_id` ownership: always `FunnelStage.query().forUser().firstOrFail()` — same M1 pattern as prospects controller
- Response shape: always use `serializePositioning()` — never raw `.toJSON()`
- List response wrapped: `{ data: [...], meta: { total: N } }`; single response: direct object
- Soft-delete: `positioning.delete()` (SoftDeletes mixin) — sets `deleted_at`; never hard delete
- Auth middleware applied at group level, not per-route

### Project Structure Notes

**New files:**
- `apps/backend/app/controllers/positionings_controller.ts`
- `apps/backend/app/serializers/positioning.ts`
- `apps/backend/app/validators/positionings.ts`
- `apps/backend/tests/functional/positionings/api.spec.ts`

**Modified files:**
- `packages/shared/src/types/positioning.ts` — add `funnelStageName: string` to `PositioningType`
- `apps/backend/start/routes.ts` — add positionings route group + controller import

**No migration changes** — schema was completed in Story 4.1. No model changes — `Positioning` model is complete. `serializeProspect` from `#serializers/prospect` is reused in `prospects()` endpoint — no changes needed.

### Previous Story Intelligence (4.1)

- `Positioning` model: `compose(BaseModel, SoftDeletes)`, `forUser` scope, `funnelStage` `belongsTo`, `prospects` `hasMany` — all ready
- Migration `0005` applied — positionings table exists, FK from `prospects.positioning_id` → `positionings.id` ON DELETE SET NULL is live
- Biome fixed `funnel_stages_controller.ts` collaterally during 4.1 — run `pnpm biome check --write .` again after creating new files
- `withTrashed()` must go BEFORE `withScopes()` in query chains (established in Story 3.5)
- Reload model from DB before asserting nullable fields not set during `.create()` (in-memory undefined vs DB null)

### Git Intelligence

Recent commits:
- `9c20b18` Merge PR #21 story-4.1 — positionings schema fully merged to main
- `5083dc2` feat(positionings): finish dev after review — includes model, migration, tests
- `495c147` feat(core): extract frontend DTO types to shared folder — `@battlecrm/shared` pattern established

**Patterns confirmed from recent work:**
1. Controller: lazy import `const X = () => import('#controllers/x_controller')`
2. Route groups: `.prefix('/resource').use(middleware.auth())`
3. Serializer: typed return value enforced by TypeScript — if `PositioningType` is wrong, `pnpm type-check` catches it
4. Tests: `group.setup` + `group.each.teardown` with domain-isolated test users; `ON DELETE CASCADE` handles child data cleanup
5. Biome: `@` scoped packages → `#` aliases → relative imports (alphabetical within groups)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2] — AC source (FR10-FR17)
- [Source: apps/backend/app/controllers/funnel_stages_controller.ts] — controller pattern (index, store, update, destroy)
- [Source: apps/backend/app/controllers/prospects_controller.ts] — funnel_stage_id filter + UUID_REGEX pattern, sub-resource pattern (stageTransitions)
- [Source: apps/backend/app/serializers/funnel_stage.ts] — serializer pattern
- [Source: apps/backend/app/validators/funnel_stages.ts] — VineJS validator pattern
- [Source: apps/backend/start/routes.ts] — route registration pattern
- [Source: apps/backend/tests/functional/funnel_stages/api.spec.ts] — test group pattern
- [Source: packages/shared/src/types/positioning.ts] — PositioningType (needs funnelStageName added)
- [Source: _bmad-output/implementation-artifacts/4-1-create-positionings-database-schema.md] — Positioning model code, SoftDeletes patterns, test domain pattern

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `PositioningType` extended with `funnelStageName: string` — shared package rebuilt successfully.
- Serializer `serializePositioning()` requires `funnelStage` to be preloaded — enforced in all controller actions via `.preload('funnelStage')` or `positioning.load('funnelStage')`.
- Lucid in-memory nullable issue: `store()` initially used conditional assignment (`if payload.description !== undefined`) which left `description` as `undefined` in-memory. Fixed by always setting `positioning.description = payload.description ?? null` unconditionally — serializer then correctly returns `null` in JSON response without DB reload.
- All 147 functional tests pass (31 new positionings tests + 116 existing — zero regressions).
- `pnpm biome check --write .` auto-fixed 2 files (style only: route chaining format in routes.ts, long line wrap in api.spec.ts).
- `prospects()` endpoint uses `.withTrashed()` on prospects to include archived ones for historical context (FR16).

### File List

- `packages/shared/src/types/positioning.ts` — MODIFIED: added `funnelStageName: string` to `PositioningType`
- `apps/backend/app/serializers/positioning.ts` — NEW: `serializePositioning()` function
- `apps/backend/app/validators/positionings.ts` — NEW: `createPositioningValidator`, `updatePositioningValidator`
- `apps/backend/app/controllers/positionings_controller.ts` — NEW: 6 actions (index, show, store, update, destroy, prospects)
- `apps/backend/start/routes.ts` — MODIFIED: added PositioningsController import + positionings route group
- `apps/backend/tests/functional/positionings/api.spec.ts` — NEW: 31 functional tests (list, filter, show, create, update, delete, prospects, auth, isolation)
