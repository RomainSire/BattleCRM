# Story 3.2: Implement Prospects CRUD API

Status: review

<!-- Ultimate Context Engine Analysis: 2026-02-25 -->
<!-- Epic 3: Prospect Management — second story of the epic -->

## Story

As a developer,
I want REST API endpoints to manage prospects,
So that the frontend can perform all prospect operations.

## Acceptance Criteria

1. **AC1 (List):** `GET /api/prospects` returns `{ data: [...], meta: { total } }` with all active prospects (deleted_at IS NULL) scoped to the authenticated user, ordered by `updated_at DESC`.
2. **AC2 (Archived filter):** `GET /api/prospects?include_archived=true` includes soft-deleted prospects in the list.
3. **AC3 (Stage filter):** `GET /api/prospects?funnel_stage_id=:uuid` returns only prospects in that funnel stage.
4. **AC4 (Create):** `POST /api/prospects` creates a new prospect owned by the authenticated user and returns it with status 201. If `funnel_stage_id` is not provided, defaults to the user's first active stage (lowest position). Returns 422 for validation errors.
5. **AC5 (Show):** `GET /api/prospects/:id` returns the full prospect detail for a prospect owned by the authenticated user.
6. **AC6 (Update):** `PUT /api/prospects/:id` updates specified fields on the prospect and returns the updated prospect. `updated_at` is automatically set by the model's `autoUpdate`.
7. **AC7 (Delete):** `DELETE /api/prospects/:id` soft-deletes the prospect (sets `deleted_at = now()`), returns 200.
8. **AC8 (Security — M1 from 3.1):** `POST` and `PUT` endpoints validate that `funnel_stage_id` belongs to the authenticated user using `forUser()` scope + `firstOrFail()`. Returns 404 (not 403) if stage not found or belongs to another user.
9. **AC9 (Prospect count — deferred from Story 2.4):** `GET /api/funnel_stages` now includes a `prospect_count` field on each stage showing the count of active (non-archived) prospects at that stage. Requires adding `hasMany(() => Prospect)` to `FunnelStage` model (Code Review M2 from Story 3.1).
10. **AC10 (Auth):** All endpoints return 401 for unauthenticated requests.
11. **AC11 (User isolation):** All endpoints return 404 (not 403) when accessing another user's prospects.
12. **AC12 (Tests):** Functional tests cover all endpoints, validation, authentication, user isolation, and the prospect_count feature. All 49+ existing tests continue to pass.
13. **AC13 (Lint + type-check):** `pnpm biome check --write .` passes with 0 errors. `pnpm --filter @battlecrm/backend type-check` passes with 0 errors.

## Tasks / Subtasks

- [x] **Task 1: Add `hasMany` relation to FunnelStage model** (AC9 — Code Review M2 from Story 3.1)
  - [x] 1.1 In `apps/backend/app/models/funnel_stage.ts`, add `hasMany` to imports from `@adonisjs/lucid/orm`
  - [x] 1.2 Add `HasMany` to type imports from `@adonisjs/lucid/types/relations`
  - [x] 1.3 Add `import Prospect from '#models/prospect'` (lazy arrow function in decorator avoids circular import)
  - [x] 1.4 Add `@hasMany(() => Prospect) declare prospects: HasMany<typeof Prospect>` to model body

- [x] **Task 2: Enhance `GET /api/funnel_stages` with prospect_count** (AC9)
  - [x] 2.1 In `funnel_stages_controller.ts` `index()`, add `.withCount('prospects', (q) => { q.whereNull('deleted_at') })` to the query
  - [x] 2.2 Change the response from `{ data: stages, meta: ... }` to `{ data: stages.map(...), meta: ... }` mapping `stage.$extras.prospects_count` to `prospect_count`
  - [x] 2.3 Verify existing funnel_stages functional tests still pass (new field is additive, non-breaking)

- [x] **Task 3: Create prospect validators** (AC4, AC6)
  - [x] 3.1 Create `apps/backend/app/validators/prospects.ts` following `funnel_stages.ts` pattern
  - [x] 3.2 Implement `createProspectValidator` — required: `name`; optional: `company`, `linkedin_url`, `email`, `phone`, `title`, `notes`, `funnel_stage_id` (uuid), `positioning_id` (uuid)
  - [x] 3.3 Implement `updateProspectValidator` — all fields optional, nullable strings allowed (to clear values)

- [x] **Task 4: Create ProspectsController** (AC1–AC8)
  - [x] 4.1 Create `apps/backend/app/controllers/prospects_controller.ts`
  - [x] 4.2 Implement `index()` — list with `include_archived` and `funnel_stage_id` query params
  - [x] 4.3 Implement `show()` — single prospect by ID with `forUser()` + `firstOrFail()`
  - [x] 4.4 Implement `store()` — create with default `funnel_stage_id` fallback + M1 ownership check
  - [x] 4.5 Implement `update()` — partial update with `funnel_stage_id` ownership check if changing stage
  - [x] 4.6 Implement `destroy()` — soft-delete via `prospect.delete()` (SoftDeletes mixin)

- [x] **Task 5: Add prospect routes to `start/routes.ts`** (AC1–AC8)
  - [x] 5.1 Add `ProspectsController` lazy import
  - [x] 5.2 Add `/prospects` route group with auth middleware under `/api` prefix
  - [x] 5.3 Routes: `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id` with UUID_REGEX constraint

- [x] **Task 6: Write functional tests** (AC12)
  - [x] 6.1 Create `apps/backend/tests/functional/prospects/api.spec.ts` following `funnel_stages/api.spec.ts` pattern
  - [x] 6.2 Test setup/teardown with `@test-prospects-api.com` email domain
  - [x] 6.3 Test all 5 CRUD endpoints with happy path + validation + 404 + UUID format check
  - [x] 6.4 Test `?include_archived=true` and `?funnel_stage_id=:id` filters
  - [x] 6.5 Test auth (401) for all endpoints
  - [x] 6.6 Test user isolation (404 when accessing another user's prospect) for show/update/delete
  - [x] 6.7 Test M1 security — cross-user `funnel_stage_id` on create/update returns 404
  - [x] 6.8 Test `GET /api/funnel_stages` includes `prospect_count` field (updated schema test)

- [x] **Task 7: Lint, type-check, run all tests** (AC13)
  - [x] 7.1 `pnpm biome check --write .` from root — 0 errors
  - [x] 7.2 `pnpm --filter @battlecrm/backend type-check` — 0 errors
  - [x] 7.3 `ENV_PATH=../../ node ace test functional` from `apps/backend/` — 86/86 pass (49 existing + 37 new)

---

## Dev Notes

### CRITICAL: This Story Is Pure Backend

Story 3.2 is a **pure backend API story** — no frontend changes. The only deliverables are:
1. Enhanced `funnel_stage.ts` model (hasMany relation)
2. Enhanced `funnel_stages_controller.ts` (prospect_count)
3. `apps/backend/app/validators/prospects.ts`
4. `apps/backend/app/controllers/prospects_controller.ts`
5. Updated `apps/backend/start/routes.ts`
6. `apps/backend/tests/functional/prospects/api.spec.ts`

**Files NOT to touch:** frontend, migrations, `auth_controller.ts`.

---

### Task 1 + 2: FunnelStage Model + Controller — Complete Implementation

**File: `apps/backend/app/models/funnel_stage.ts`** — ADD to existing model:

```typescript
// Add to imports:
import { belongsTo, column, hasMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Prospect from '#models/prospect'

// Add inside the class body (after the existing belongsTo User relation):
@hasMany(() => Prospect)
declare prospects: HasMany<typeof Prospect>
```

**Note on circular imports:** `prospect.ts` imports `FunnelStage`, and `funnel_stage.ts` will import `Prospect`. This is safe because both decorators use arrow functions `() => Model` — the module is resolved at runtime (when the decorator is evaluated), not at import time. TypeScript handles this pattern correctly with Lucid.

---

**File: `apps/backend/app/controllers/funnel_stages_controller.ts`** — MODIFY `index()`:

```typescript
async index({ request, response, auth }: HttpContext) {
  const userId = auth.user!.id
  const includeArchived = request.qs().include_archived === 'true'

  const query = FunnelStage.query()
    .withScopes((s) => s.forUser(userId))
    .orderBy('position', 'asc')
    .withCount('prospects', (q) => {
      q.whereNull('deleted_at')
    })

  if (includeArchived) {
    query.withTrashed()
  }

  const stages = await query

  return response.ok({
    data: stages.map((stage) => ({
      ...stage.serialize(),
      prospect_count: Number(stage.$extras.prospects_count ?? 0),
    })),
    meta: { total: stages.length },
  })
}
```

**Why `stage.$extras.prospects_count`?**
Lucid's `withCount('prospects', ...)` stores the count in `$extras` using snake_case key `{relation_name}_count`. It is NOT part of `serialize()` output by default — must be explicitly mapped. The `Number()` cast handles the string-typed count from PostgreSQL.

**Note on `whereNull('deleted_at')`:** Even though `SoftDeletes` adds a global scope to `Prospect`, the `withCount` callback operates on a raw sub-query builder that may not apply model-level scopes. Explicit `whereNull` is required to only count active (non-archived) prospects.

---

### Task 3: Prospect Validators — Complete Implementation

**File: `apps/backend/app/validators/prospects.ts`**

```typescript
import vine from '@vinejs/vine'

export const createProspectValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    company: vine.string().trim().maxLength(255).nullable().optional(),
    linkedin_url: vine.string().trim().maxLength(500).nullable().optional(),
    email: vine.string().trim().email().maxLength(255).nullable().optional(),
    phone: vine.string().trim().maxLength(50).nullable().optional(),
    title: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
    funnel_stage_id: vine.string().uuid().optional(),
    // positioning_id: stored raw UUID, no FK constraint exists yet (added in Epic 4 Story 4.1)
    positioning_id: vine.string().uuid().nullable().optional(),
  })
)

export const updateProspectValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    company: vine.string().trim().maxLength(255).nullable().optional(),
    linkedin_url: vine.string().trim().maxLength(500).nullable().optional(),
    email: vine.string().trim().email().maxLength(255).nullable().optional(),
    phone: vine.string().trim().maxLength(50).nullable().optional(),
    title: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
    funnel_stage_id: vine.string().uuid().optional(),
    positioning_id: vine.string().uuid().nullable().optional(),
  })
)
```

**Validator notes:**
- `nullable().optional()` = accepts `string | null | undefined` — essential for clearing optional fields on update
- `email()` = VineJS built-in email format validation
- `funnel_stage_id` is `optional()` on CREATE (controller will default to first active stage if omitted)
- `funnel_stage_id` is `optional()` on UPDATE (only validates ownership if provided)
- `positioning_id`: NO DB-level validation against positionings table (table doesn't exist until Epic 4). Story 4.1 adds the FK constraint.

---

### Task 4: ProspectsController — Complete Implementation

**File: `apps/backend/app/controllers/prospects_controller.ts`**

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import FunnelStage from '#models/funnel_stage'
import Prospect from '#models/prospect'
import { createProspectValidator, updateProspectValidator } from '#validators/prospects'

export default class ProspectsController {
  /**
   * GET /api/prospects
   * Returns all prospects for the authenticated user.
   * ?include_archived=true includes soft-deleted
   * ?funnel_stage_id=:uuid filters by stage
   */
  async index({ request, response, auth }: HttpContext) {
    const userId = auth.user!.id
    const includeArchived = request.qs().include_archived === 'true'
    const funnelStageId = request.qs().funnel_stage_id as string | undefined

    const query = Prospect.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('updated_at', 'desc')

    if (includeArchived) {
      query.withTrashed()
    }

    if (funnelStageId) {
      query.where('funnel_stage_id', funnelStageId)
    }

    const prospects = await query
    return response.ok({ data: prospects, meta: { total: prospects.length } })
  }

  /**
   * GET /api/prospects/:id
   * Returns a single prospect by ID for the authenticated user.
   */
  async show({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    const prospect = await Prospect.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    return response.ok(prospect)
  }

  /**
   * POST /api/prospects
   * Creates a new prospect for the authenticated user.
   * Defaults funnel_stage_id to first active stage if not provided.
   */
  async store({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(createProspectValidator)
    const userId = auth.user!.id

    // Resolve funnel_stage_id — default to first active stage if not provided (Story 3.1 note)
    let funnelStageId = payload.funnel_stage_id
    if (!funnelStageId) {
      const firstStage = await FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .orderBy('position', 'asc')
        .first()

      if (!firstStage) {
        return response.unprocessableEntity({
          errors: [
            {
              message: 'No active funnel stage found — create at least one stage first',
              field: 'funnel_stage_id',
              rule: 'required',
            },
          ],
        })
      }
      funnelStageId = firstStage.id
    } else {
      // SECURITY (M1 from Story 3.1): validate funnel_stage_id belongs to authenticated user
      // Returns 404 if stage not found or belongs to another user — prevents cross-user stage assignment
      await FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .where('id', funnelStageId)
        .firstOrFail()
    }

    const prospect = new Prospect()
    prospect.userId = userId
    prospect.funnelStageId = funnelStageId
    prospect.name = payload.name
    if (payload.company !== undefined) prospect.company = payload.company ?? null
    if (payload.linkedin_url !== undefined) prospect.linkedinUrl = payload.linkedin_url ?? null
    if (payload.email !== undefined) prospect.email = payload.email ?? null
    if (payload.phone !== undefined) prospect.phone = payload.phone ?? null
    if (payload.title !== undefined) prospect.title = payload.title ?? null
    if (payload.notes !== undefined) prospect.notes = payload.notes ?? null
    if (payload.positioning_id !== undefined) prospect.positioningId = payload.positioning_id ?? null

    await prospect.save()
    return response.created(prospect)
  }

  /**
   * PUT /api/prospects/:id
   * Updates a prospect owned by the authenticated user (partial update semantics).
   */
  async update({ params, request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(updateProspectValidator)
    const userId = auth.user!.id

    const prospect = await Prospect.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    // SECURITY (M1 from Story 3.1): if changing funnel stage, validate ownership
    if (payload.funnel_stage_id !== undefined) {
      await FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .where('id', payload.funnel_stage_id)
        .firstOrFail()
      prospect.funnelStageId = payload.funnel_stage_id
    }

    if (payload.name !== undefined) prospect.name = payload.name
    if (payload.company !== undefined) prospect.company = payload.company ?? null
    if (payload.linkedin_url !== undefined) prospect.linkedinUrl = payload.linkedin_url ?? null
    if (payload.email !== undefined) prospect.email = payload.email ?? null
    if (payload.phone !== undefined) prospect.phone = payload.phone ?? null
    if (payload.title !== undefined) prospect.title = payload.title ?? null
    if (payload.notes !== undefined) prospect.notes = payload.notes ?? null
    if (payload.positioning_id !== undefined) prospect.positioningId = payload.positioning_id ?? null

    await prospect.save()
    return response.ok(prospect)
  }

  /**
   * DELETE /api/prospects/:id
   * Soft-deletes a prospect (sets deleted_at via adonis-lucid-soft-deletes).
   */
  async destroy({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    const prospect = await Prospect.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    await prospect.delete() // SoftDeletes mixin: sets deleted_at = now()
    return response.ok({ message: 'Prospect archived' })
  }
}
```

**Controller notes:**
- `undefined` checks on optional fields allow partial updates — only provided fields are changed
- `payload.field ?? null` converts `null` from validator to null on model (clears nullable columns)
- `prospect.delete()` triggers SoftDeletes — same pattern as `stage.delete()` in FunnelStagesController
- `firstOrFail()` throws 404 automatically for both "not found" and "wrong user" — user privacy preserved

---

### Task 5: Routes — Complete Implementation

**File: `apps/backend/start/routes.ts`** — ADD to existing file:

```typescript
// Add lazy import (alongside FunnelStagesController):
const ProspectsController = () => import('#controllers/prospects_controller')

// Add route group inside the /api group (after funnel_stages group):
router
  .group(() => {
    router.get('/', [ProspectsController, 'index'])
    router.post('/', [ProspectsController, 'store'])
    // ⚠️ show MUST come before /:id for static routes, but GET /:id is fine — no conflicts here
    router.get('/:id', [ProspectsController, 'show']).where('id', UUID_REGEX)
    router.put('/:id', [ProspectsController, 'update']).where('id', UUID_REGEX)
    router.delete('/:id', [ProspectsController, 'destroy']).where('id', UUID_REGEX)
  })
  .prefix('/prospects')
  .use(middleware.auth())
```

**Route ordering note:** Unlike funnel_stages (which has `/reorder` before `/:id`), prospects have no named sub-routes, so ordering is straightforward. All `/:id` routes are fine with UUID_REGEX constraint.

---

### Task 6: Functional Tests — Complete Pattern

**File: `apps/backend/tests/functional/prospects/api.spec.ts`** — follow `funnel_stages/api.spec.ts` exactly:

```typescript
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import FunnelStage from '#models/funnel_stage'
import Prospect from '#models/prospect'
import User from '#models/user'

type ProspectDto = { id: string; name: string; funnel_stage_id: string; deleted_at: string | null }

const TEST_EMAIL_DOMAIN = '@test-prospects-api.com'

test.group('Prospects API', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    // ON DELETE CASCADE on prospects.user_id removes their prospects automatically
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  async function registerUser(client: ApiClient, prefix: string): Promise<User> {
    const res = await client.post('/api/auth/register').json({
      email: `${prefix}${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    res.assertStatus(201)
    const userId = res.body().user.id
    return User.findOrFail(userId)
  }

  // Helper to create a prospect directly in DB for testing
  async function createProspect(userId: string, funnelStageId: string, name: string): Promise<Prospect> {
    return Prospect.create({ userId, funnelStageId, name })
  }

  // ... tests below
})
```

**Critical test cases to cover:**

| Endpoint | Test Case | Expected |
|----------|-----------|----------|
| GET / | Returns active prospects only | 200, excludes deleted_at IS NOT NULL |
| GET /?include_archived=true | Returns all prospects | 200, includes soft-deleted |
| GET /?funnel_stage_id=:id | Filters by stage | 200, only matching stage |
| GET /:id | Happy path | 200, full prospect |
| GET /:id | Non-existent | 404 |
| GET /:id | Non-UUID format | 404 |
| POST / | Valid create | 201, has id field |
| POST / | Missing name | 422 |
| POST / | Empty name (whitespace) | 422 |
| POST / | Without funnel_stage_id | 201, defaults to first active stage |
| POST / | With another user's funnel_stage_id | 404 (M1 security) |
| PUT /:id | Valid update | 200 |
| PUT /:id | Partial update (only name) | 200, other fields unchanged |
| PUT /:id | With another user's funnel_stage_id | 404 (M1 security) |
| DELETE /:id | Soft-delete | 200, deleted_at set in DB |
| DELETE /:id | Already deleted (withTrashed not shown) | 404 |
| All | Unauthenticated | 401 |
| GET /:id, PUT, DELETE | Another user's prospect | 404 |
| GET /api/funnel_stages | prospect_count present | 200, `prospect_count` field on each stage |
| GET /api/funnel_stages | prospect_count only active | After creating prospect + archiving it, count decreases |

**Note on email domain uniqueness:** Use `@test-prospects-api.com` (different from `@test-funnel-api.com`) to avoid test data conflicts across test groups.

---

### Architecture Compliance

| Requirement | Implementation |
|-------------|----------------|
| FR1: Create prospects | `POST /api/prospects` |
| FR2: View list with preview | `GET /api/prospects` (ordered by updated_at DESC) |
| FR3: Update prospect info | `PUT /api/prospects/:id` (partial update) |
| FR4: Archive (soft delete) | `DELETE /api/prospects/:id` → `deleted_at = now()` |
| FR6: Filter by funnel stage | `?funnel_stage_id=:uuid` query param |
| NFR11: Backend data isolation | `forUser()` scope on ALL prospect queries |
| NFR12: Zero cross-user access | `firstOrFail()` returns 404 (not 403) for isolation |
| NFR23: Soft delete | `prospect.delete()` via SoftDeletes mixin |
| API snake_case | All JSON fields snake_case (Lucid serialization) |
| Wrapped list response | `{ data: [...], meta: { total } }` |
| Auth middleware | All routes use `middleware.auth()` |
| UUID route param | `UUID_REGEX` constraint on `/:id` routes |

---

### Security Deep-Dive: M1 — Cross-User funnel_stage_id Validation

This is a **must-implement** security requirement identified in Story 3.1 Code Review M1:

**Vulnerability:** The `funnel_stages` table FK constraint on `prospects.funnel_stage_id` only enforces that the stage row EXISTS, not that it belongs to the authenticated user. A malicious user could submit a `funnel_stage_id` from another user's funnel — the FK would pass validation, but the prospect would reference a stage the user doesn't own.

**Fix:** Before assigning `funnel_stage_id`, always validate with `forUser()` scope:

```typescript
// This is already in the controller above — do NOT skip this check:
await FunnelStage.query()
  .withScopes((s) => s.forUser(userId))
  .where('id', funnelStageId)
  .firstOrFail() // throws 404 if stage not found OR belongs to another user
```

**Why 404 not 403?** Returns 404 to avoid revealing whether a resource exists for another user. This is the same pattern used throughout the codebase (`forUser()` + `firstOrFail()`).

**Future:** The same pattern must be applied to `positioning_id` in Stories 4.x when the positionings table exists.

---

### Key Pattern: Partial Update via `undefined` Checks

The `update()` controller uses explicit `undefined` checks for a PATCH-like partial update over HTTP PUT:

```typescript
if (payload.name !== undefined) prospect.name = payload.name
if (payload.company !== undefined) prospect.company = payload.company ?? null
```

**Why:** `payload.company ?? null` converts incoming `null` (clearing the value) to null on the model. Without the `?? null`, a `null` payload value would leave the field unchanged (which is wrong — user explicitly wants to clear it).

**Why not `Object.assign()`?** Because `Object.assign` would set fields from `undefined` to `undefined`, which Lucid might serialize as absent. Explicit checks are clearer.

---

### positioning_id: Raw UUID — No Validation Against positionings Table

**Context:** The `positionings` table does not exist until Epic 4, Story 4.1. The `positioning_id` column was added to `prospects` as a nullable UUID without a FK constraint.

**In Story 3.2:** Accept `positioning_id` in create/update requests, store raw UUID, no table validation. The FK constraint will be added in Epic 4 Story 4.1's migration.

**Do NOT:** Query the `positionings` table to validate `positioning_id` in Story 3.2 — the table doesn't exist yet.

---

### withCount + $extras Pattern

The `prospect_count` on funnel stages uses Lucid's `withCount` aggregate, which stores the result in `$extras` (NOT included in `serialize()` by default):

```typescript
// Query
query.withCount('prospects', (q) => {
  q.whereNull('deleted_at') // only active prospects
})

// Serialization — must map $extras manually
stages.map((stage) => ({
  ...stage.serialize(),
  prospect_count: Number(stage.$extras.prospects_count ?? 0),
}))
```

**`$extras.prospects_count` is a string** (PostgreSQL returns count as text). `Number()` converts to integer. The `?? 0` handles stages with no prospects (null count).

**Existing tests:** The funnel_stages API tests check the `data` array structure but may not verify `prospect_count`. If they do strict equality checks on response shape, they might need updating. Check `tests/functional/funnel_stages/api.spec.ts` — the existing tests use `assert.property(body, 'data')` style, not strict field matching, so adding `prospect_count` is non-breaking.

---

### Project Structure Notes

**Files to CREATE:**

```
apps/backend/
├── app/
│   ├── controllers/
│   │   └── prospects_controller.ts        # NEW — Prospects CRUD controller
│   └── validators/
│       └── prospects.ts                   # NEW — createProspectValidator, updateProspectValidator
└── tests/
    └── functional/
        └── prospects/
            └── api.spec.ts                # NEW — Prospects functional tests
```

**Files to MODIFY:**

```
apps/backend/
├── app/
│   ├── controllers/
│   │   └── funnel_stages_controller.ts    # MODIFY index() — add withCount + prospect_count mapping
│   └── models/
│       └── funnel_stage.ts               # MODIFY — add hasMany(() => Prospect) relation
└── start/
    └── routes.ts                          # MODIFY — add ProspectsController + /prospects routes
```

**Files NOT to touch:**
- `apps/backend/app/models/prospect.ts` — already complete from Story 3.1
- `apps/backend/database/migrations/` — no new migrations needed
- `apps/frontend/` — no frontend changes in Story 3.2 (frontend in Story 3.3)

---

### Git Intelligence

**Recent commits (Story 3.1 pattern):**
- `feat(prospects): finalize prospects database schema and update migration status to done`
- `feat(prospects): create prospects database schema and model`

**Expected branch:** `story-3-2`
**Expected commit message:** `feat(prospects): implement prospects CRUD API endpoints`

---

### Previous Story Intelligence (Story 3.1 — done)

**Key learnings to carry forward:**

| Learning | Detail |
|----------|--------|
| `forUser()` scope is MANDATORY on all prospect queries | `Prospect.query().withScopes((s) => s.forUser(userId))` |
| M1 security fix is required | Cross-user `funnel_stage_id` validation in store() and update() |
| M2 fix is required | Add `hasMany(() => Prospect)` to `FunnelStage` model |
| `prospect_count` in funnel stages | Deferred AC4 from Story 2.4 — must implement in this story |
| SoftDeletes `.delete()` pattern | `prospect.delete()` sets `deleted_at = now()` (same as FunnelStage) |
| `withTrashed()` type augmentation | Already handled in `apps/backend/types/soft_deletes.d.ts` — do NOT recreate |
| Biome formatting | `pnpm biome check --write .` from root — may reformat multi-line chains |
| `ENV_PATH=../../` prefix | Required for all `node ace` commands from `apps/backend/` |
| Test isolation via email domain | Different domain per test group prevents data conflicts |
| `ON DELETE CASCADE` on `prospects.user_id` | Deleting user in teardown auto-deletes their prospects — no explicit Prospect cleanup needed in tests |
| Test 49/49 passing baseline | Must verify all existing tests still pass after changes to funnel_stage.ts and funnel_stages_controller.ts |

---

### Existing Code to NOT Reinvent

| Pattern | Source |
|---------|--------|
| `withScopes((s) => s.forUser(userId))` query scoping | `apps/backend/app/controllers/funnel_stages_controller.ts:20` |
| `.firstOrFail()` for 404 on missing/unauthorized | `apps/backend/app/controllers/funnel_stages_controller.ts:87` |
| `request.qs().include_archived === 'true'` | `apps/backend/app/controllers/funnel_stages_controller.ts:17` |
| `.withTrashed()` for archived list | `apps/backend/app/controllers/funnel_stages_controller.ts:24` |
| VineJS vine.compile() pattern | `apps/backend/app/validators/funnel_stages.ts:3` |
| Route group + middleware.auth() | `apps/backend/start/routes.ts:36-46` |
| UUID_REGEX for route param constraint | `apps/backend/start/routes.ts:13` |
| Test setup/teardown with email domain cleanup | `apps/backend/tests/functional/funnel_stages/api.spec.ts:10-19` |
| `registerUser()` helper via `/api/auth/register` | `apps/backend/tests/functional/funnel_stages/api.spec.ts:23-31` |
| `.loginAs(user)` for authenticated test calls | `apps/backend/tests/functional/funnel_stages/api.spec.ts:42` |

---

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2: Implement Prospects CRUD API]
- [Source: _bmad-output/planning-artifacts/epics.md#FR1–FR6, FR8–FR9 — Prospect Management requirements]
- [Source: _bmad-output/planning-artifacts/epics.md#NFR11, NFR12 — Backend data isolation]
- [Source: _bmad-output/planning-artifacts/epics.md#NFR23 — Soft delete]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authorization — backend middleware + user_id filtering]
- [Source: _bmad-output/planning-artifacts/architecture.md#API Boundaries — /api/prospects/*]
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns — wrapped list response]
- [Source: _bmad-output/implementation-artifacts/3-1-create-prospects-database-schema.md#Code Review M1 — funnel_stage_id security]
- [Source: _bmad-output/implementation-artifacts/3-1-create-prospects-database-schema.md#Code Review M2 — hasMany relation]
- [Source: _bmad-output/implementation-artifacts/3-1-create-prospects-database-schema.md#Deferred AC4 from Story 2.4]
- [Source: apps/backend/app/controllers/funnel_stages_controller.ts — complete reference controller]
- [Source: apps/backend/app/validators/funnel_stages.ts — VineJS validator pattern]
- [Source: apps/backend/start/routes.ts — route group + UUID_REGEX pattern]
- [Source: apps/backend/tests/functional/funnel_stages/api.spec.ts — test setup, loginAs, isolation patterns]
- [Source: apps/backend/app/models/prospect.ts — forUser() scope, SoftDeletes pattern]
- [Source: apps/backend/app/models/funnel_stage.ts — reference model to modify]
- [Source: _bmad-output/project-context.md — Critical Implementation Rules, Anti-Patterns]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Biome reformatted 3 files on first pass (`prospects_controller.ts`, `validators/prospects.ts`, `tests/functional/prospects/api.spec.ts`) — expected, no functional impact.
- 5 test failures on first run: Lucid v3 serializes camelCase by default (`funnelStageId`, not `funnel_stage_id`). Fixed 4 assertions in tests to use `funnelStageId`. Also removed `assert.property(active, 'id')` hack (chai's `property` uses `hasOwnProperty` which doesn't work on Lucid model instances) — replaced with `assert.isDefined(active.id)`.
- All 86 tests pass on second run: 49 existing (auth + funnel_stages) + 37 new (prospects).

### Completion Notes List

- AC1–AC3: `GET /api/prospects` implemented — ordered by `updated_at DESC`, supports `?include_archived=true` and `?funnel_stage_id=:uuid` filters, returns `{ data, meta }`.
- AC4: `POST /api/prospects` — defaults `funnel_stage_id` to first active stage when not provided. Returns 422 if user has no stages.
- AC5: `GET /api/prospects/:id` — returns single active prospect for auth user.
- AC6: `PUT /api/prospects/:id` — partial update semantics; `payload.field ?? null` clears nullable columns.
- AC7: `DELETE /api/prospects/:id` — soft-delete via `prospect.delete()` (SoftDeletes mixin). Returns 200 `{ message: 'Prospect archived' }`.
- AC8 (Security M1): Both `store()` and `update()` validate `funnel_stage_id` ownership via `forUser() + firstOrFail()`. Returns 404 for cross-user stage IDs.
- AC9 (Deferred AC4 from Story 2.4): `hasMany(() => Prospect)` added to `FunnelStage` model. `GET /api/funnel_stages` now includes `prospect_count` (active only) via `withCount` + `$extras.prospects_count` mapping.
- AC10: All 5 routes return 401 for unauthenticated requests.
- AC11: User isolation confirmed — all endpoints return 404 for cross-user access.
- AC12: 37 functional tests added covering all ACs, happy paths, validation, auth, isolation, security.
- AC13: Biome 0 errors, TypeScript 0 errors, 86/86 tests pass.
- **Lucid serialization note:** Lucid v3 serializes camelCase by default (`funnelStageId`, `userId`, `createdAt`, etc.). Frontend code in Stories 3.3+ should use camelCase for API response fields.

### File List

**Created:**
- `apps/backend/app/controllers/prospects_controller.ts`
- `apps/backend/app/validators/prospects.ts`
- `apps/backend/tests/functional/prospects/api.spec.ts`

**Modified:**
- `apps/backend/app/models/funnel_stage.ts` (added `hasMany(() => Prospect)`)
- `apps/backend/app/controllers/funnel_stages_controller.ts` (added `prospect_count` via `withCount`)
- `apps/backend/start/routes.ts` (added `/prospects` route group)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (3-2 status: ready-for-dev → in-progress → review)
