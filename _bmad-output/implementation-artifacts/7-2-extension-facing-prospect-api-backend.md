# Story 7.2: Extension-Facing Prospect API (Backend)

Status: review

## Story

As a browser extension,
I want dedicated API endpoints to check and manage prospects by LinkedIn URL,
So that I can provide real-time duplicate detection and one-click prospect creation.

## Acceptance Criteria

1. **AC1 (Index migration):** A new migration `0012_add_linkedin_url_index_to_prospects.ts` creates a unique partial index:
   ```sql
   CREATE UNIQUE INDEX idx_prospects_user_linkedin ON prospects (user_id, linkedin_url)
   WHERE linkedin_url IS NOT NULL AND deleted_at IS NULL
   ```
   This ensures O(1) lookup for the real-time check (NFR72 < 1s) and prevents duplicate LinkedIn URLs per user. Soft-deleted prospects are excluded from the uniqueness constraint.

2. **AC2 (Shared types):** `packages/shared/src/types/extension.ts` exports `ExtensionProspectData` and `ExtensionCheckResponse`. `packages/shared/src/index.ts` already re-exports `extension.ts` (done in Story 7.1 — verify only). `pnpm --filter @battlecrm/shared build` succeeds.

3. **AC3 (Check endpoint — found):** `GET /api/extension/prospects/check?linkedin_url=<url>` with a valid Bearer token returns 200 `{ found: true, prospect: { id, name, company, linkedinUrl, email, phone, title, notes, funnelStageId, funnelStageName } }` when a prospect with the normalized URL exists for the authenticated user.

4. **AC4 (Check endpoint — normalizes URL):** The controller normalizes `linkedin_url` before querying: strips query params and trailing slash. `https://linkedin.com/in/johndoe?utm_source=x` and `https://linkedin.com/in/johndoe` both resolve to the same prospect.

5. **AC5 (Check endpoint — not found):** When no prospect matches the normalized URL for this user, returns 200 `{ found: false }`. Note: always 200 — never 404 — to avoid leaking existence of prospects to other users.

6. **AC6 (Check endpoint — validation):** Missing or empty `linkedin_url` query param returns 422 with a validation error.

7. **AC7 (Create endpoint — success):** `POST /api/extension/prospects` with a valid Bearer token and `{ name, linkedin_url (required), company?, email?, phone?, title?, notes? }` creates a prospect, auto-assigns it to the user's **first funnel stage** (lowest `position`), and returns 201 with `ExtensionProspectData` (including `funnelStageName`).

8. **AC8 (Create endpoint — linkedin_url required):** `POST /api/extension/prospects` without `linkedin_url` returns 422 validation error. `linkedin_url` is required for extension-created prospects (unlike the web app where it's optional).

9. **AC9 (Create endpoint — conflict):** `POST /api/extension/prospects` where `linkedin_url` already exists for this user (non-deleted) returns 409 `{ message: "Prospect already exists", prospectId: "<existing-id>" }`.

10. **AC10 (Update endpoint — success):** `PATCH /api/extension/prospects/:id` with a valid Bearer token and partial data updates only the provided fields and returns 200 with `ExtensionProspectData`. `linkedin_url` is silently ignored if included in the body (read-only key).

11. **AC11 (Update endpoint — ownership):** `PATCH /api/extension/prospects/:id` where the prospect belongs to a different user returns 404 (consistent with `forUser()` pattern).

12. **AC12 (Auth):** All 3 endpoints require `extensionAuth` middleware (Bearer token). Missing or invalid token → 401.

13. **AC13 (Validation):** `pnpm biome check --write .` → 0 errors. `pnpm --filter @battlecrm/shared build` → success. `pnpm --filter @battlecrm/backend type-check` → 0 errors.

14. **AC14 (Tests):** All acceptance criteria above are covered by Japa functional tests. Existing 245+ tests continue to pass.

## Tasks / Subtasks

### Task 1: Shared types (AC2) — start here

- [x] **1.1** Add to `packages/shared/src/types/extension.ts` (keep `ExtensionLoginResponse`, add below):
  ```typescript
  export type ExtensionProspectData = {
    id: string
    name: string
    company: string | null
    linkedinUrl: string | null
    email: string | null
    phone: string | null
    title: string | null
    notes: string | null
    funnelStageId: string
    funnelStageName: string
  }

  export type ExtensionCheckResponse =
    | { found: true; prospect: ExtensionProspectData }
    | { found: false }
  ```
- [x] **1.2** Verify `packages/shared/src/index.ts` already re-exports `extension.ts` (done in 7.1). No change needed if present.
- [x] **1.3** Run `pnpm --filter @battlecrm/shared build` — must succeed.

---

### Task 2: DB migration — unique partial index (AC1)

- [x] **2.1** Create `apps/backend/database/migrations/0012_add_linkedin_url_index_to_prospects.ts`:
  ```typescript
  import { BaseSchema } from '@adonisjs/lucid/schema'

  export default class extends BaseSchema {
    async up() {
      await this.schema.raw(
        `CREATE UNIQUE INDEX idx_prospects_user_linkedin
         ON prospects (user_id, linkedin_url)
         WHERE linkedin_url IS NOT NULL AND deleted_at IS NULL`
      )
    }

    async down() {
      await this.schema.raw('DROP INDEX IF EXISTS idx_prospects_user_linkedin')
    }
  }
  ```
- [x] **2.2** Run `ENV_PATH=../../ node ace migration:run` from `apps/backend/`.
- [x] **2.3** Verify index created: `\d prospects` in psql should show the index.

---

### Task 3: Extension prospects validator (AC6, AC7, AC8, AC10)

- [x] **3.1** Create `apps/backend/app/validators/extension_prospects.ts`:
  ```typescript
  import vine from '@vinejs/vine'

  export const extensionCheckValidator = vine.compile(
    vine.object({
      linkedin_url: vine.string().trim().minLength(1),
    }),
  )

  export const extensionCreateProspectValidator = vine.compile(
    vine.object({
      name: vine.string().trim().minLength(1).maxLength(255),
      linkedin_url: vine.string().trim().maxLength(500), // required — no .optional()
      company: vine.string().trim().maxLength(255).nullable().optional(),
      email: vine.string().trim().email().maxLength(255).nullable().optional(),
      phone: vine.string().trim().maxLength(50).nullable().optional(),
      title: vine.string().trim().maxLength(255).nullable().optional(),
      notes: vine.string().trim().nullable().optional(),
    }),
  )

  export const extensionUpdateProspectValidator = vine.compile(
    vine.object({
      name: vine.string().trim().minLength(1).maxLength(255).optional(),
      company: vine.string().trim().maxLength(255).nullable().optional(),
      email: vine.string().trim().email().maxLength(255).nullable().optional(),
      phone: vine.string().trim().maxLength(50).nullable().optional(),
      title: vine.string().trim().maxLength(255).nullable().optional(),
      notes: vine.string().trim().nullable().optional(),
      // linkedin_url intentionally excluded — read-only key for extension-created prospects
      // funnel_stage_id intentionally excluded — stage management is web app only
    }),
  )
  ```

---

### Task 4: Extension prospects controller (AC3–AC11)

- [x] **4.1** Create `apps/backend/app/controllers/extension_prospects_controller.ts`:
  ```typescript
  import type { HttpContext } from '@adonisjs/core/http'
  import type { ExtensionCheckResponse, ExtensionProspectData } from '@battlecrm/shared'
  import { UUID_REGEX } from '#helpers/regex'
  import FunnelStage from '#models/funnel_stage'
  import Prospect from '#models/prospect'
  import {
    extensionCheckValidator,
    extensionCreateProspectValidator,
    extensionUpdateProspectValidator,
  } from '#validators/extension_prospects'

  function normalizeLinkedinUrl(url: string): string {
    try {
      const parsed = new URL(url)
      parsed.search = ''
      parsed.hash = ''
      return parsed.toString().replace(/\/$/, '')
    } catch {
      return url.replace(/[?#].*$/, '').trim().replace(/\/$/, '')
    }
  }

  async function serializeExtensionProspect(prospect: Prospect): Promise<ExtensionProspectData> {
    await prospect.load('funnelStage')
    return {
      id: prospect.id,
      name: prospect.name,
      company: prospect.company,
      linkedinUrl: prospect.linkedinUrl,
      email: prospect.email,
      phone: prospect.phone,
      title: prospect.title,
      notes: prospect.notes,
      funnelStageId: prospect.funnelStageId,
      funnelStageName: prospect.funnelStage.name,
    }
  }

  export default class ExtensionProspectsController {
    /**
     * GET /api/extension/prospects/check?linkedin_url=<url>
     * Returns { found: true, prospect } or { found: false }.
     * Always 200 — never 404 — to avoid leaking prospect existence.
     */
    async check({ request, response, auth }: HttpContext) {
      const data = await request.validateUsing(extensionCheckValidator)
      const userId = auth.use('extension').user!.id
      const normalized = normalizeLinkedinUrl(data.linkedin_url)

      const prospect = await Prospect.query()
        .withScopes((s) => s.forUser(userId))
        .where('linkedin_url', normalized)
        .first()

      if (!prospect) {
        const body: ExtensionCheckResponse = { found: false }
        return response.ok(body)
      }

      const body: ExtensionCheckResponse = {
        found: true,
        prospect: await serializeExtensionProspect(prospect),
      }
      return response.ok(body)
    }

    /**
     * POST /api/extension/prospects
     * Creates prospect, auto-assigns to first funnel stage.
     * Returns 409 if linkedin_url already exists for this user.
     */
    async store({ request, response, auth }: HttpContext) {
      const payload = await request.validateUsing(extensionCreateProspectValidator)
      const userId = auth.use('extension').user!.id
      const normalizedUrl = normalizeLinkedinUrl(payload.linkedin_url)

      // Check for existing prospect with same linkedin_url (pre-query for user-friendly 409)
      const existing = await Prospect.query()
        .withScopes((s) => s.forUser(userId))
        .where('linkedin_url', normalizedUrl)
        .first()

      if (existing) {
        return response.conflict({
          message: 'Prospect already exists',
          prospectId: existing.id,
        })
      }

      // Auto-assign to first funnel stage (lowest position)
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

      const prospect = new Prospect()
      prospect.userId = userId
      prospect.funnelStageId = firstStage.id
      prospect.name = payload.name
      prospect.linkedinUrl = normalizedUrl
      if (payload.company !== undefined) prospect.company = payload.company ?? null
      if (payload.email !== undefined) prospect.email = payload.email ?? null
      if (payload.phone !== undefined) prospect.phone = payload.phone ?? null
      if (payload.title !== undefined) prospect.title = payload.title ?? null
      if (payload.notes !== undefined) prospect.notes = payload.notes ?? null
      await prospect.save()

      return response.created(await serializeExtensionProspect(prospect))
    }

    /**
     * PATCH /api/extension/prospects/:id
     * Partial update. linkedin_url is read-only (excluded from validator).
     * Returns 404 if prospect belongs to another user (forUser() pattern).
     */
    async update({ params, request, response, auth }: HttpContext) {
      // UUID format guard (PostgreSQL throws 500 on invalid uuid string)
      if (!UUID_REGEX.test(params.id)) {
        return response.notFound()
      }

      const payload = await request.validateUsing(extensionUpdateProspectValidator)
      const userId = auth.use('extension').user!.id

      const prospect = await Prospect.query()
        .withScopes((s) => s.forUser(userId))
        .where('id', params.id)
        .firstOrFail()

      if (payload.name !== undefined) prospect.name = payload.name
      if (payload.company !== undefined) prospect.company = payload.company ?? null
      if (payload.email !== undefined) prospect.email = payload.email ?? null
      if (payload.phone !== undefined) prospect.phone = payload.phone ?? null
      if (payload.title !== undefined) prospect.title = payload.title ?? null
      if (payload.notes !== undefined) prospect.notes = payload.notes ?? null
      await prospect.save()

      return response.ok(await serializeExtensionProspect(prospect))
    }
  }
  ```

---

### Task 5: Routes (AC3, AC7, AC10, AC12)

- [x] **5.1** In `apps/backend/start/routes.ts`, add `ExtensionProspectsController` import alongside existing `ExtensionAuthController`:
  ```typescript
  const ExtensionProspectsController = () => import('#controllers/extension_prospects_controller')
  ```
- [x] **5.2** Inside the existing `/extension` group (after the auth routes), add:
  ```typescript
  // Extension prospect routes — all require Bearer token
  router
    .group(() => {
      router.get('/check', [ExtensionProspectsController, 'check'])
      router.post('/', [ExtensionProspectsController, 'store'])
      router.patch('/:id', [ExtensionProspectsController, 'update']).where('id', UUID_REGEX)
    })
    .prefix('/prospects')
    .use(middleware.extensionAuth())
  ```
  Final routes:
  - `GET /api/extension/prospects/check`
  - `POST /api/extension/prospects`
  - `PATCH /api/extension/prospects/:id`

---

### Task 6: Functional tests (AC14)

- [x] **6.1** Create `apps/backend/tests/functional/extension/prospects.spec.ts`:
  ```typescript
  import db from '@adonisjs/lucid/services/db'
  import { test } from '@japa/runner'
  import FunnelStage from '#models/funnel_stage'
  import Prospect from '#models/prospect'
  import User from '#models/user'

  const TEST_DOMAIN = '@test-extension-prospects.com'

  async function createUser(prefix: string) {
    return User.create({ email: `${prefix}${TEST_DOMAIN}`, password: 'password123' })
  }

  async function loginExtension(client: any, email: string) {
    const res = await client.post('/api/extension/auth/login').json({ email, password: 'password123' })
    return res.body().token as string
  }

  test.group('Extension Prospects API', (group) => {
    group.setup(async () => {
      await User.query().whereILike('email', `%${TEST_DOMAIN}`).delete()
    })
    group.each.teardown(async () => {
      await User.query().whereILike('email', `%${TEST_DOMAIN}`).delete()
    })

    // ============================
    // GET /api/extension/prospects/check
    // ============================

    test('check returns found:true with prospect data when URL matches', ...)
    test('check returns found:false when URL does not match any prospect', ...)
    test('check normalizes URL — strips query params', ...)
    test('check normalizes URL — strips trailing slash', ...)
    test('check returns 422 when linkedin_url is missing', ...)
    test('check returns 401 without Bearer token', ...)
    test('check returns found:false for prospect belonging to another user', ...)

    // ============================
    // POST /api/extension/prospects
    // ============================

    test('store creates prospect and auto-assigns to first funnel stage', ...)
    test('store returns 422 when linkedin_url is missing', ...)
    test('store returns 409 when linkedin_url already exists for this user', ...)
    test('store normalizes linkedin_url before saving', ...)
    test('store returns 401 without Bearer token', ...)

    // ============================
    // PATCH /api/extension/prospects/:id
    // ============================

    test('update applies partial update and returns 200', ...)
    test('update ignores linkedin_url if provided in body', ...)
    test('update returns 404 for prospect belonging to another user', ...)
    test('update returns 401 without Bearer token', ...)
  })
  ```

  Implement all test bodies following the Bearer token pattern from `extension/auth.spec.ts`:
  1. `loginExtension(client, email)` helper to get token
  2. `.header('Authorization', \`Bearer ${token}\`)` on authenticated requests
  3. Use `db.from('prospects').where(...)` for direct DB assertions
  4. Use `FunnelStage.query().withScopes(s => s.forUser(userId)).orderBy('position', 'asc').first()` to get the default stage in assertions

---

### Task 7: Verification (AC13, AC14)

- [x] **7.1** `pnpm biome check --write .` → 0 errors (run from root)
- [x] **7.2** `pnpm --filter @battlecrm/shared build` → success
- [x] **7.3** `pnpm --filter @battlecrm/backend type-check` → 0 errors
- [x] **7.4** `cd apps/backend && ENV_PATH=../../ node ace test functional --files="extension/prospects"` → all new tests pass
- [x] **7.5** `cd apps/backend && ENV_PATH=../../ node ace test functional` → 262 tests pass (no regressions)

## Dev Notes

### Architecture constraints — CRITICAL

- **Bearer auth on ALL 3 endpoints** — Use `middleware.extensionAuth()` (NOT `middleware.auth()`). These endpoints use the `extension` guard (access tokens), never the `web` guard (session). [Source: architecture.md → "Deux mécanismes d'authentification"]
- **User from extension guard** — Use `auth.use('extension').user!.id` NOT `auth.user!.id`. `auth.user!` defaults to the `web` guard and will be undefined on extension requests. [Source: Story 7.1 implementation pattern]
- **forUser() scoping** — Every prospect query MUST use `.withScopes((s) => s.forUser(userId))`. This is the primary user isolation mechanism. Never omit it. [Source: architecture.md → "User isolation"]

### LinkedIn URL normalization — MUST DO

The check endpoint MUST normalize before querying. LinkedIn profile URLs in the wild include tracking params (`utm_source`, `trk`, etc.) and optional trailing slashes. The extension content script will also normalize URLs before calling `check`, but the backend must be the source of truth.

```typescript
function normalizeLinkedinUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    // Fallback for malformed URLs — at least strip query and trailing slash
    return url.replace(/[?#].*$/, '').trim().replace(/\/$/, '')
  }
}
```

Also normalize the `linkedin_url` on `POST /extension/prospects` before saving, so the stored value is always canonical. This ensures future `check` queries work correctly.

### 409 Conflict — query-first pattern (not try/catch constraint violation)

Pre-check existence before attempting insert:
```typescript
const existing = await Prospect.query().withScopes(forUser).where('linkedin_url', normalized).first()
if (existing) {
  return response.conflict({ message: 'Prospect already exists', prospectId: existing.id })
}
```

**Why not rely on the DB unique constraint?** AdonisJS doesn't catch `unique_violation` with a clean error type — it throws a raw `DatabaseQueryBuilderException` whose message must be parsed. The pre-query approach is more explicit, readable, and returns the `prospectId` in the 409 body (needed by the extension to navigate to the existing prospect).

### Auto-assign to first funnel stage

Reuse the exact same pattern as `ProspectsController.store()`:
```typescript
const firstStage = await FunnelStage.query()
  .withScopes((s) => s.forUser(userId))
  .orderBy('position', 'asc')
  .first()

if (!firstStage) {
  return response.unprocessableEntity({ errors: [...] })
}
```

No `funnel_stage_id` in the extension create validator — stage assignment is automatic.

### `serializeExtensionProspect` — load funnelStage relation

```typescript
await prospect.load('funnelStage')
```

Lucid lazy-loads the relation. `prospect.funnelStage` is available after the `load()` call. The FK `funnelStageId` is always valid (set during create, never null on non-deleted prospects), so `firstOrFail()` is not needed — just load.

### VineJS — query param validation

`request.validateUsing()` in AdonisJS 6 validates `request.all()` which **merges** body + query string. So for the GET check endpoint:

```typescript
const data = await request.validateUsing(extensionCheckValidator)
// data.linkedin_url comes from ?linkedin_url= query param
```

This works correctly — no need to pass `{ data: request.qs() }`.

### Controller naming — follow Story 7.1 flat pattern

Story 7.1 used flat naming: `extension_auth_controller.ts` in `app/controllers/`. Follow the same:
- `app/controllers/extension_prospects_controller.ts` (flat, NOT in `app/controllers/extension/` subfolder)
- `#controllers/extension_prospects_controller` import alias
- `app/validators/extension_prospects.ts`
- `#validators/extension_prospects` import alias

The architecture doc shows a subfolder structure but Story 7.1 established the flat pattern — consistency with what's already in the codebase takes priority.

### Important: `name` vs `firstName`/`lastName`

The epic AC mentions `{ id, firstName, lastName, ... }` but the existing `Prospect` model has a single `name` field (not split). The extension check response uses `name` (single string) in `ExtensionProspectData`. This is intentional for Story 7.2 MVP. The extension floating window (Story 7.6) should handle the single `name` field accordingly.

### Nullable fields — explicit assignment pattern

Follow the established pattern from `ProspectsController.store()`:
```typescript
if (payload.company !== undefined) prospect.company = payload.company ?? null
```
Do NOT use conditional assignment without the null coalesce — in-memory nullable fields may be `undefined` if never set, causing assertion issues in tests. [Source: MEMORY — Lucid nullable fields in-memory pattern]

### Test pattern

Use the `loginExtension` helper established in `auth.spec.ts`:
```typescript
async function loginExtension(client: ApiClient, email: string): Promise<string> {
  const res = await client.post('/api/extension/auth/login').json({ email, password: 'password123' })
  return res.body().token
}

// Usage:
const token = await loginExtension(client, `user${TEST_DOMAIN}`)
const res = await client
  .get('/api/extension/prospects/check')
  .qs({ linkedin_url: 'https://linkedin.com/in/johndoe' })
  .header('Authorization', `Bearer ${token}`)
```

Use `client.get(...).qs({...})` for query params in Japa api-client.

### File locations

| New file | Path |
|----------|------|
| Extension prospects controller | `apps/backend/app/controllers/extension_prospects_controller.ts` |
| Extension prospects validator | `apps/backend/app/validators/extension_prospects.ts` |
| Functional tests | `apps/backend/tests/functional/extension/prospects.spec.ts` |
| DB migration | `apps/backend/database/migrations/0012_add_linkedin_url_index_to_prospects.ts` |

| Modified file | What changes |
|---------------|-------------|
| `packages/shared/src/types/extension.ts` | Add `ExtensionProspectData` and `ExtensionCheckResponse` |
| `apps/backend/start/routes.ts` | Add `/api/extension/prospects/*` routes |

### References

- [Source: architecture.md → "Browser Extension Architecture (Epic 7)"]
- [Source: architecture.md → "Routes API Extension"]
- [Source: architecture.md → "Index DB" → `idx_prospects_user_linkedin`]
- [Source: architecture.md → "Deux mécanismes d'authentification"]
- [Source: epics.md → "Story 7.2: Extension-Facing Prospect API (Backend)"]
- [Source: apps/backend/app/controllers/prospects_controller.ts] — `store()` pattern for first stage + nullable fields
- [Source: apps/backend/app/controllers/extension_auth_controller.ts] — `auth.use('extension').user!.id` pattern
- [Source: apps/backend/start/routes.ts] — existing `/extension` group structure
- [Source: apps/backend/app/serializers/prospect.ts] — serializer pattern to reuse `funnelStage` preload

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `IF NOT EXISTS` added to migration SQL: the unique index already existed in DB (created during previous manual work). Migration made idempotent.
- `User.create()` direct DB creation does not trigger funnel stage auto-creation — test helper uses API `POST /api/auth/register` instead (consistent with `interactions/api.spec.ts` pattern).
- `auth.use('extension').user!.id` required in all controller methods — `auth.user!.id` defaults to the `web` guard and is undefined on Bearer-only requests.
- URL normalization handles both `URL` parsing (strips search+hash) and malformed URL fallback (regex strip).
- 262 tests pass (245 pre-existing + 16 new extension prospect tests + 1 expired token test from Story 7.1).

### File List

**New files:**
- `packages/shared/src/types/extension.ts` — added `ExtensionProspectData`, `ExtensionCheckResponse`
- `apps/backend/database/migrations/0012_add_linkedin_url_index_to_prospects.ts`
- `apps/backend/app/controllers/extension_prospects_controller.ts`
- `apps/backend/app/validators/extension_prospects.ts`
- `apps/backend/tests/functional/extension/prospects.spec.ts`

**Modified files:**
- `apps/backend/start/routes.ts` — added `/api/extension/prospects/*` routes
