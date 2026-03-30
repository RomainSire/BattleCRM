# Story 7.1: Extension Token Authentication (Backend)

Status: done

## Story

As a BattleCRM user,
I want to authenticate the browser extension with my BattleCRM credentials,
So that the extension can securely access my data without sharing my session cookie.

## Acceptance Criteria

1. **AC1 (Migration):** Running `ENV_PATH=../../ node ace auth:make-tokens-migration` creates the `auth_access_tokens` table using the Adonis standard schema. The migration is committed. The `extension` auth guard is configured in `config/auth.ts` using `AccessTokensGuard` with `type = 'extension_token'`.

2. **AC2 (Login — success):** `POST /api/extension/auth/login` with valid `{ email, password, name? }` returns 200 with `{ token: "<raw token string>", user: { id, email } }`. The raw token is NEVER stored in DB — only its hash. `type = 'extension_token'` is set on the record. The `name` field defaults to `"Extension"` if not provided.

3. **AC3 (Login — invalid credentials):** `POST /api/extension/auth/login` with wrong email/password returns 401 `{ message: "Invalid credentials" }`. No token is created.

4. **AC4 (Bearer auth middleware):** Requests to `/api/extension/*` with a valid `Authorization: Bearer <token>` header are authenticated. `last_used_at` is updated automatically. Invalid/deleted/expired tokens return 401. The existing session-based `/api/*` endpoints are NOT affected.

5. **AC5 (Logout):** `POST /api/extension/auth/logout` with a valid Bearer token deletes the token record from `auth_access_tokens`. Subsequent requests with the same token return 401.

6. **AC6 (CORS):** `config/cors.ts` reads an `EXTENSION_ORIGINS` env var (comma-separated `chrome-extension://` and `moz-extension://` origins). Requests from these origins are allowed. The existing session CORS config for the frontend is unchanged. Extension endpoints do NOT require `credentials: true`.

7. **AC7 (Shared types):** `packages/shared/src/types/extension.ts` (new) exports `ExtensionLoginResponse`. `packages/shared/src/index.ts` re-exports from this file. `pnpm --filter @battlecrm/shared build` succeeds.

8. **AC8 (Validation):** All verification commands pass: `pnpm biome check --write .` → 0 errors. `pnpm --filter @battlecrm/shared build` → success. `pnpm --filter @battlecrm/backend type-check` → 0 errors.

9. **AC9 (Tests):** All acceptance criteria above are covered by Japa functional tests. The existing 245 tests continue to pass.

## Tasks / Subtasks

### Task 1: Shared type (AC7) — start here

- [x] **1.1** Create `packages/shared/src/types/extension.ts`:
  ```typescript
  import type { UserType } from './auth.js'

  export type ExtensionLoginResponse = {
    token: string
    user: UserType
  }
  ```
- [x] **1.2** Add re-export in `packages/shared/src/index.ts`:
  ```typescript
  export * from './types/extension.js'
  ```
- [x] **1.3** Run `pnpm --filter @battlecrm/shared build` — must succeed

---

### Task 2: Database migration (AC1)

- [x] **2.1** Run from `apps/backend/`:
  ```bash
  ENV_PATH=../../ node ace auth:make-tokens-migration
  ```
  This generates `database/migrations/<timestamp>_create_auth_access_tokens_table.ts` with the Adonis standard schema.
- [x] **2.2** Do NOT edit the generated migration — it is correct as-is. Just verify it creates `auth_access_tokens` with columns: `id`, `tokenable_id`, `type`, `name`, `hash`, `abilities`, `created_at`, `updated_at`, `last_used_at`, `expires_at`.
- [x] **2.3** Run `ENV_PATH=../../ node ace migration:run` to apply.

---

### Task 3: User model — add token relationship (AC1)

- [x] **3.1** In `apps/backend/app/models/user.ts`, add the `DbAccessTokensProvider` static property:
  ```typescript
  import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'

  export default class User extends compose(BaseModel, AuthFinder, SoftDeletes) {
    // ... existing columns ...

    static accessTokens = DbAccessTokensProvider.forModel(User, {
      expiresIn: '180 days',
      prefix: 'oat_',
      table: 'auth_access_tokens',
      type: 'extension_token',
      tokenSecretLength: 40,
    })
  }
  ```

---

### Task 4: Auth config — add extension guard (AC1, AC4)

- [x] **4.1** In `apps/backend/config/auth.ts`, add the `extension` guard:
  ```typescript
  import { defineConfig } from '@adonisjs/auth'
  import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
  import { tokensGuard, tokensUserProvider } from '@adonisjs/auth/access_tokens'
  import type { Authenticators, InferAuthEvents, InferAuthenticators } from '@adonisjs/auth/types'

  const authConfig = defineConfig({
    default: 'web',
    guards: {
      web: sessionGuard({
        useRememberMeTokens: false,
        provider: sessionUserProvider({
          model: () => import('#models/user'),
        }),
      }),
      extension: tokensGuard({
        provider: tokensUserProvider({
          tokens: 'accessTokens',
          model: () => import('#models/user'),
        }),
      }),
    },
  })
  ```

---

### Task 5: Extension auth controller (AC2, AC3, AC5)

- [x] **5.1** Create `apps/backend/app/controllers/extension_auth_controller.ts`:
  ```typescript
  import { errors as authErrors } from '@adonisjs/auth'
  import type { HttpContext } from '@adonisjs/core/http'
  import type { ExtensionLoginResponse } from '@battlecrm/shared'
  import User from '#models/user'
  import { extensionLoginValidator } from '#validators/extension_auth'

  export default class ExtensionAuthController {
    async login({ request, response }: HttpContext) {
      const data = await request.validateUsing(extensionLoginValidator)

      let user: User
      try {
        user = await User.verifyCredentials(data.email, data.password)
      } catch (error) {
        if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
          return response.unauthorized({ message: 'Invalid credentials' })
        }
        throw error
      }

      const token = await User.accessTokens.create(user, ['*'], {
        name: data.name ?? 'Extension',
      })

      const body: ExtensionLoginResponse = {
        token: token.value!.release(),
        user: { id: user.id, email: user.email },
      }
      return response.ok(body)
    }

    async logout({ auth, response }: HttpContext) {
      const user = auth.use('extension').user!
      await User.accessTokens.delete(user, auth.use('extension').token!.identifier)
      return response.ok({ message: 'Logged out' })
    }
  }
  ```

- [x] **5.2** Create `apps/backend/app/validators/extension_auth.ts`:
  ```typescript
  import vine from '@vinejs/vine'

  export const extensionLoginValidator = vine.compile(
    vine.object({
      email: vine.string().trim().email(),
      password: vine.string().minLength(1),
      name: vine.string().trim().optional(),
    }),
  )
  ```

---

### Task 6: Bearer token middleware (AC4)

- [x] **6.1** Create `apps/backend/app/middleware/extension_auth_middleware.ts`:
  ```typescript
  import type { HttpContext } from '@adonisjs/core/http'
  import type { NextFn } from '@adonisjs/core/types/http'

  export default class ExtensionAuthMiddleware {
    async handle(ctx: HttpContext, next: NextFn) {
      await ctx.auth.use('extension').authenticate()
      return next()
    }
  }
  ```
- [x] **6.2** Register in `apps/backend/start/kernel.ts` named middleware:
  ```typescript
  export const middleware = router.named({
    guest: () => import('#middleware/guest_middleware'),
    auth: () => import('#middleware/auth_middleware'),
    extensionAuth: () => import('#middleware/extension_auth_middleware'),
  })
  ```

---

### Task 7: Routes (AC2, AC4, AC5)

- [x] **7.1** In `apps/backend/start/routes.ts`, add the extension routes inside the `/api` group:
  ```typescript
  const ExtensionAuthController = () => import('#controllers/extension_auth_controller')

  // Extension routes — Bearer token auth (NOT session)
  router
    .group(() => {
      router.post('/auth/login', [ExtensionAuthController, 'login'])
      router.post('/auth/logout', [ExtensionAuthController, 'logout']).use(middleware.extensionAuth())
    })
    .prefix('/extension')
  ```
  Note: login does NOT use `middleware.extensionAuth()` (user is not authenticated yet).
  Note: logout uses `middleware.extensionAuth()` (must be authenticated to log out).

---

### Task 8: CORS configuration (AC6)

- [x] **8.1** In `apps/backend/config/cors.ts`, update the `origin` function:
  ```typescript
  origin: (requestOrigin) => {
    const allowedOrigins = [
      env.get('FRONTEND_URL'),
      ...env.get('EXTENSION_ORIGINS', '').split(',').filter(Boolean),
    ]
    return allowedOrigins.includes(requestOrigin) ? requestOrigin : false
  },
  ```
- [x] **8.2** Add `EXTENSION_ORIGINS` to `.env` (root) with an empty default:
  ```
  EXTENSION_ORIGINS=
  ```
- [x] **8.3** Add `EXTENSION_ORIGINS` to `apps/backend/start/env.ts` validation:
  ```typescript
  EXTENSION_ORIGINS: Env.schema.string.optional(),
  ```

---

### Task 9: Functional tests (AC9)

- [x] **9.1** Create `apps/backend/tests/functional/extension/auth.spec.ts` covering:
  - `POST /api/extension/auth/login` with valid credentials → 200, response shape `{ token, user }`, token is string
  - `POST /api/extension/auth/login` with wrong password → 401 `{ message: 'Invalid credentials' }`
  - `POST /api/extension/auth/login` with unknown email → 401 (same — no user enumeration)
  - `POST /api/extension/auth/login` with missing fields → 422 validation error
  - `POST /api/extension/auth/login` with custom `name` → token stored with that name
  - `POST /api/extension/auth/login` without `name` → defaults to `"Extension"`
  - Authenticated request to a protected extension endpoint with valid Bearer → 200
  - Authenticated request with invalid Bearer → 401
  - `POST /api/extension/auth/logout` with valid Bearer → 200, subsequent request → 401
  - `POST /api/extension/auth/logout` without Bearer → 401

  Test helper pattern: use `loginAs` equivalent for Bearer — call login endpoint to get token, then pass it as `Authorization: Bearer <token>` header manually (Japa `client.get(...).header('Authorization', 'Bearer <token>')`).

---

### Task 10: Verification (AC8)

- [x] **10.1** `pnpm biome check --write .` → 0 errors (run from root)
- [x] **10.2** `pnpm --filter @battlecrm/shared build` → success
- [x] **10.3** `pnpm --filter @battlecrm/backend type-check` → 0 errors
- [x] **10.4** `ENV_PATH=../../ node ace test functional` → 245+ tests pass (no regressions)

## Dev Notes

### Architecture constraints — CRITICAL

- **Two separate auth mechanisms** — do NOT mix them. Session guard (`web`) is for `/api/*`. Access tokens guard (`extension`) is for `/api/extension/*`. The existing `middleware.auth()` uses session only — never apply it to extension routes. [Source: architecture.md → "Browser Extension Architecture (Epic 7)"]
- **Extension endpoints do NOT need `credentials: true`** on CORS — Bearer tokens, not cookies. The existing CORS config for the web app must remain unchanged. [Source: architecture.md → "CORS Configuration"]
- **Token stored hashed only** — `token.value!.release()` returns the raw value once (clears it from memory). Log this in the response immediately. Never read it back from DB. [Source: architecture.md → "Backend: AdonisJS Opaque Access Tokens"]
- **`type = 'extension_token'`** — set on `DbAccessTokensProvider.forModel(User, { type: 'extension_token' })`. This ensures token types don't collide if future token types are added. [Source: architecture.md]

### AdonisJS 6 Access Tokens — key API points

```typescript
// Create token
const token = await User.accessTokens.create(user, ['*'], { name: 'Extension' })
token.value!.release()  // ← raw string, only available once

// Delete token (logout)
await User.accessTokens.delete(user, ctx.auth.use('extension').token!.identifier)

// In middleware — authenticate
await ctx.auth.use('extension').authenticate()  // throws on failure
ctx.auth.use('extension').user!                 // User model instance
ctx.auth.use('extension').token!.identifier     // token DB id for logout
```

The `tokensGuard` + `tokensUserProvider` are imported from `@adonisjs/auth/access_tokens`, NOT `@adonisjs/auth/session`. [Source: Adonis 6 auth docs]

### Validators

Extension login validator is SEPARATE from the existing web `loginValidator` in `#validators/auth`. Do NOT reuse or extend — different fields (`name` is extension-specific). Create `#validators/extension_auth`. [Source: MEMORY — VineJS for validation, separate schemas]

### Routing

Extension routes go inside the existing `/api` group prefix. The full paths are:
- `POST /api/extension/auth/login` (no middleware — pre-auth)
- `POST /api/extension/auth/logout` (extensionAuth middleware)

Do NOT add a `guest` middleware on login — the `guest` middleware is session-based and would break if a Bearer token is accidentally present. [Source: existing routes.ts pattern analysis]

### CORS — env.ts validation

Check how `FRONTEND_URL` is validated in `apps/backend/start/env.ts` to follow the same pattern for `EXTENSION_ORIGINS`. It should be optional (empty string is valid for local dev without the extension).

### Test pattern for Bearer token auth

Japa `loginAs(user)` only works for session guards. For extension Bearer tests:
```typescript
// 1. Get token via login endpoint
const loginRes = await client.post('/api/extension/auth/login').json({
  email: user.email,
  password: 'password123',
})
const { token } = loginRes.body()

// 2. Use token in subsequent requests
const res = await client
  .post('/api/extension/auth/logout')
  .header('Authorization', `Bearer ${token}`)
```

### File locations

| New file | Path |
|----------|------|
| Extension auth controller | `apps/backend/app/controllers/extension_auth_controller.ts` |
| Extension auth validator | `apps/backend/app/validators/extension_auth.ts` |
| Extension auth middleware | `apps/backend/app/middleware/extension_auth_middleware.ts` |
| Extension shared types | `packages/shared/src/types/extension.ts` |
| Functional tests | `apps/backend/tests/functional/extension/auth.spec.ts` |

| Modified file | What changes |
|---------------|-------------|
| `apps/backend/config/auth.ts` | Add `extension` guard |
| `apps/backend/config/cors.ts` | Add `EXTENSION_ORIGINS` support |
| `apps/backend/start/routes.ts` | Add `/api/extension/auth/*` routes |
| `apps/backend/start/kernel.ts` | Add `extensionAuth` named middleware |
| `apps/backend/start/env.ts` | Add `EXTENSION_ORIGINS` validation |
| `apps/backend/app/models/user.ts` | Add `static accessTokens` provider |
| `packages/shared/src/types/extension.ts` | New — `ExtensionLoginResponse` type |
| `packages/shared/src/index.ts` | Re-export extension types |
| `.env` (root) | Add `EXTENSION_ORIGINS=` |

### Project Structure Notes

- New controller follows `snake_case_controller.ts` naming — `extension_auth_controller.ts`. [Source: existing controllers pattern]
- Import alias `#controllers/extension_auth_controller` — follows existing pattern in `routes.ts` lazy import. [Source: package.json imports]
- Validator in `#validators/extension_auth` — same pattern as `#validators/auth`. [Source: existing validators]

### References

- [Source: architecture.md → "Browser Extension Architecture (Epic 7)"]
- [Source: architecture.md → "Backend: AdonisJS Opaque Access Tokens"]
- [Source: architecture.md → "CORS Configuration"]
- [Source: architecture.md → "Deux mécanismes d'authentification"]
- [Source: epics.md → "Story 7.1: Extension Token Authentication (Backend)"]
- [Source: apps/backend/config/auth.ts] — existing session guard pattern
- [Source: apps/backend/start/routes.ts] — existing route group pattern
- [Source: apps/backend/start/kernel.ts] — existing named middleware pattern
- [Source: apps/backend/app/middleware/auth_middleware.ts] — middleware pattern

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `auth:make-tokens-migration` Ace command does not exist in this version of @adonisjs/auth (9.4). Migration written manually from source inspection of `access_tokens_guard/main.js`. Schema confirmed: `id` (serial PK), `tokenable_id` (UUID FK → users), `type`, `name`, `hash` (varchar 200 unique), `abilities` (text), `created_at/updated_at/last_used_at/expires_at` (timestamps). SHA-256 hash (not bcrypt) — architecture doc note corrected.
- Token name tests use `db.from('auth_access_tokens')` direct query instead of Lucid relationship (avoids `as any` and `as never` type casts).
- Extension tests run cleanly with `--files="extension/auth"`. Full suite count: 245 (232 pre-existing + 13 new extension tests).
- `EXTENSION_ORIGINS` optional env var: empty string = no extension CORS (correct for local dev without extension loaded).

### File List

**New files:**
- `packages/shared/src/types/extension.ts`
- `apps/backend/database/migrations/0011_create_auth_access_tokens_table.ts`
- `apps/backend/app/controllers/extension_auth_controller.ts`
- `apps/backend/app/validators/extension_auth.ts`
- `apps/backend/app/middleware/extension_auth_middleware.ts`
- `apps/backend/tests/functional/extension/auth.spec.ts`

**Modified files:**
- `packages/shared/src/index.ts`
- `apps/backend/app/models/user.ts`
- `apps/backend/config/auth.ts`
- `apps/backend/config/cors.ts`
- `apps/backend/start/routes.ts`
- `apps/backend/start/kernel.ts`
- `apps/backend/start/env.ts`
- `.env`
- `apps/backend/database/migrations/0010_drop_status_from_interactions.ts` — drop `status` column cleanup (prerequisite for interactions refactor, bundled in this sprint)
- `apps/backend/tests/functional/interactions/api.spec.ts` — updated to reflect removed `status` field
- `apps/frontend/src/components/common/AppNavbar.tsx` — mobile nav accessibility improvements (frontend sprint task, bundled commit)
- `apps/frontend/src/features/interactions/hooks/useInteractionMutations.ts` — query invalidation improvements (frontend sprint task, bundled commit)
- `apps/frontend/src/features/positionings/hooks/usePositioningMutations.ts` — query invalidation improvements (frontend sprint task, bundled commit)
