# Story 1.4: Configure Supabase & Database Schema

Status: done

<!-- Ultimate Context Engine Analysis: 2026-02-12 -->
<!-- Previous stories: 1-1-initialize-monorepo-structure (done), 1-2-scaffold-frontend-application (done), 1-3-scaffold-backend-application (done) -->

## Story

As a **developer**,
I want **Supabase connected with user authentication tables and RLS policies**,
So that **user data is properly isolated and secure from day one**.

## Acceptance Criteria

1. **AC1:** Lucid ORM connects to Supabase PostgreSQL with SSL enabled and proper pool configuration
2. **AC2:** The existing users migration is replaced with UUID primary key (`gen_random_uuid()`) and `deleted_at` column
3. **AC3:** The User model uses UUID (`id: string`), soft delete via `adonis-lucid-soft-deletes`, and composes `AuthFinder` + `SoftDeletes` mixins
4. **AC4:** Row Level Security is enabled on the users table with a policy ensuring users can only read/update their own record
5. **AC5:** A middleware sets the PostgreSQL session variable `app.current_user_id` for RLS enforcement
6. **AC6:** Lucid query scopes provide application-level user isolation (`forUser` scope pattern)
7. **AC7:** `ENV_PATH=../../ node ace migration:run` executes successfully against Supabase PostgreSQL
8. **AC8:** The users table has proper indexes (unique on email, index on deleted_at)

## Tasks / Subtasks

- [x] **Task 1: Configure Supabase PostgreSQL Connection** (AC: 1)
  - [x] 1.1 Update `config/database.ts`: add SSL config (`ssl: { rejectUnauthorized: false }`), add pool config (`min: 2, max: 10`)
  - [x] 1.2 Add `DB_SSL` env variable to `start/env.ts` (boolean, default true) and `.env.example`
  - [x] 1.3 Conditionally enable SSL in `config/database.ts` based on `DB_SSL` env variable (disabled for local dev, enabled for Supabase)
  - [x] 1.4 Verify connection works against Supabase PostgreSQL (direct connection, port 5432)

- [x] **Task 2: Install and Configure Soft Delete Package** (AC: 3)
  - [x] 2.1 Run `pnpm --filter @battlecrm/backend add adonis-lucid-soft-deletes`
  - [x] 2.2 Register the provider in `adonisrc.ts`: `() => import('adonis-lucid-soft-deletes/provider')`
  - [x] 2.3 Verify the package is installed and provider loads correctly

- [x] **Task 3: Replace Users Migration with UUID + Soft Delete** (AC: 2, 8)
  - [x] 3.1 Delete the existing migration `database/migrations/1770843000426_create_users_table.ts`
  - [x] 3.2 Create new migration `database/migrations/0001_create_users_table.ts` (see migration code in Dev Notes)
  - [x] 3.3 Users table columns: `id` (uuid, PK, default `gen_random_uuid()`), `email` (string 254, unique, not null), `password` (string, not null), `created_at` (timestamp, not null), `updated_at` (timestamp, nullable), `deleted_at` (timestamp, nullable)
  - [x] 3.4 Add index on `deleted_at` for soft delete query performance
  - [x] 3.5 Run migration to verify it creates the table correctly

- [x] **Task 4: Update User Model for UUID + Soft Delete** (AC: 3)
  - [x] 4.1 Update `app/models/user.ts`: change `id` type from `number` to `string`
  - [x] 4.2 Compose `SoftDeletes` mixin alongside existing `AuthFinder`: `compose(BaseModel, AuthFinder, SoftDeletes)`
  - [x] 4.3 Add `declare deletedAt: DateTime | null` column
  - [x] 4.4 Do NOT add `selfAssignPrimaryKey` (database generates UUID via `gen_random_uuid()`)

- [x] **Task 5: Create RLS Migration** (AC: 4)
  - [x] 5.1 Create migration `database/migrations/0002_enable_rls_on_users.ts`
  - [x] 5.2 Enable RLS: `ALTER TABLE users ENABLE ROW LEVEL SECURITY`
  - [x] 5.3 Create policy `users_self_access`: user can SELECT/UPDATE only their own row using `current_setting('app.current_user_id')::uuid`
  - [x] 5.4 Create policy `users_insert_allow`: allow INSERT for new user registration (no user_id check on INSERT)
  - [x] 5.5 Add `FORCE ROW LEVEL SECURITY` to ensure policies apply even to table owner

- [x] **Task 6: Create RLS Middleware** (AC: 5)
  - [x] 6.1 Create `app/middleware/set_rls_user_middleware.ts`
  - [x] 6.2 When authenticated: execute `SELECT set_config('app.current_user_id', ?, true)` with `auth.user!.id`
  - [x] 6.3 When not authenticated: execute `SELECT set_config('app.current_user_id', '', true)` to clear
  - [x] 6.4 Register as named middleware in `start/kernel.ts` (applied per route group, not globally)

- [x] **Task 7: Add Lucid Query Scope for User Isolation** (AC: 6)
  - [x] 7.1 Add static `forUser` scope to User model: `query.where('id', userId)`
  - [x] 7.2 This is the **primary** user isolation mechanism in application code; RLS is defense-in-depth

- [x] **Task 8: Update Environment Configuration** (AC: 1)
  - [x] 8.1 Add `DB_SSL=false` to root `.env` (local dev)
  - [x] 8.2 Add `DB_SSL` to `.env.example` with comment: `# Set to true for Supabase (remote), false for local PostgreSQL`
  - [x] 8.3 Update `start/env.ts` to validate `DB_SSL` as `Env.schema.boolean()`

- [x] **Task 9: Verification** (AC: 1-8)
  - [x] 9.1 `ENV_PATH=../../ node ace migration:run` executes both migrations successfully
  - [x] 9.2 `ENV_PATH=../../ node ace migration:rollback` works cleanly
  - [x] 9.3 Users table has UUID id column with `gen_random_uuid()` default
  - [x] 9.4 Users table has `deleted_at` column
  - [x] 9.5 RLS is enabled on users table (verify via `\d users` or SQL query)
  - [x] 9.6 TypeScript type-check passes (`pnpm --filter @battlecrm/backend run type-check`)
  - [x] 9.7 `pnpm lint` passes from root

## Dev Notes

### Critical Architecture Requirements

**MUST USE these exact technologies - NO substitutions:**

| Technology | Version/Choice | Notes |
|-----------|---------------|-------|
| Database | Supabase PostgreSQL | Direct connection (port 5432), NOT transaction mode pooler (port 6543) |
| UUID function | `gen_random_uuid()` | Native PostgreSQL 13+, NO extension required. Do NOT use `uuid_generate_v4()` |
| Soft delete | `adonis-lucid-soft-deletes` | Community package for AdonisJS 6 Lucid |
| User isolation | Lucid query scopes (primary) + RLS (defense-in-depth) | Dual-layer approach |
| Auth | AdonisJS session auth (scrypt) | Already configured in Story 1.3. NOT Supabase Auth SDK |

### CRITICAL: Auth Clarification

The PRD and architecture documents mention "Supabase Auth" but the implementation uses **AdonisJS native session authentication** (configured in Story 1.3 with `sessionGuard` + `scrypt` hashing + httpOnly cookies). Supabase is used **ONLY as managed PostgreSQL database**, not for authentication. This means:

- User passwords are hashed by AdonisJS (scrypt), not Supabase Auth
- Sessions are managed by AdonisJS session middleware, not Supabase tokens
- RLS policies must use `current_setting('app.current_user_id')`, not `auth.uid()` (Supabase Auth function)
- No Supabase Auth SDK (`@supabase/supabase-js`) is needed

### CRITICAL: Connection Mode

AdonisJS is a long-running server process. Lucid ORM (Knex) uses prepared statements internally. Use **direct/session mode (port 5432)** for Supabase connections, NOT transaction mode pooler (port 6543) which does not support prepared statements.

**For local development:** Use a local PostgreSQL instance (port 5432, no SSL).
**For Supabase:** Use the direct connection host with SSL enabled.

### Migration Code: Users Table

```typescript
// database/migrations/0001_create_users_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .uuid('id')
        .primary()
        .defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.string('email', 254).notNullable().unique()
      table.string('password').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.timestamp('deleted_at').nullable()

      // Index for soft delete query performance
      table.index(['deleted_at'], 'idx_users_deleted_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

**Key:** `this.db.rawQuery('gen_random_uuid()').knexQuery` is the AdonisJS 6 syntax (NOT `this.raw()` which is AdonisJS 5).

### Migration Code: RLS on Users

```typescript
// database/migrations/0002_enable_rls_on_users.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw('ALTER TABLE users ENABLE ROW LEVEL SECURITY')
    this.schema.raw('ALTER TABLE users FORCE ROW LEVEL SECURITY')

    // Users can only read/update their own row
    this.schema.raw(`
      CREATE POLICY users_self_access ON users
        FOR ALL
        USING (id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (id = current_setting('app.current_user_id', true)::uuid)
    `)

    // Allow INSERT for registration (no user_id check needed)
    this.schema.raw(`
      CREATE POLICY users_insert_allow ON users
        FOR INSERT
        WITH CHECK (true)
    `)
  }

  async down() {
    this.schema.raw('DROP POLICY IF EXISTS users_insert_allow ON users')
    this.schema.raw('DROP POLICY IF EXISTS users_self_access ON users')
    this.schema.raw('ALTER TABLE users DISABLE ROW LEVEL SECURITY')
  }
}
```

**Key:** `current_setting('app.current_user_id', true)` - the second param `true` means return NULL instead of error if the setting doesn't exist. This prevents errors when no user is set (e.g., during registration).

### User Model: Updated Code

```typescript
// app/models/user.ts
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { compose } from '@adonisjs/core/helpers'
import hash from '@adonisjs/core/services/hash'
import { BaseModel, column, scope } from '@adonisjs/lucid/orm'
import { SoftDeletes } from 'adonis-lucid-soft-deletes'
import type { DateTime } from 'luxon'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder, SoftDeletes) {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @column.dateTime()
  declare deletedAt: DateTime | null

  // Primary user isolation mechanism - use in all queries
  static forUser = scope((query, userId: string) => {
    query.where('id', userId)
  })
}
```

### RLS Middleware Code

```typescript
// app/middleware/set_rls_user_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'

export default class SetRlsUserMiddleware {
  async handle({ auth }: HttpContext, next: NextFn) {
    if (auth.isAuthenticated) {
      await db.rawQuery(
        `SELECT set_config('app.current_user_id', ?, true)`,
        [String(auth.user!.id)]
      )
    } else {
      await db.rawQuery(
        `SELECT set_config('app.current_user_id', '', true)`,
        []
      )
    }
    return next()
  }
}
```

**Important:** The third param `true` in `set_config()` scopes the setting to the current transaction. Since each HTTP request gets its own connection from the pool, this prevents user ID leaking between requests.

### Database Config: Updated Code

```typescript
// config/database.ts
import { defineConfig } from '@adonisjs/lucid'
import env from '#start/env'

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
        ssl: env.get('DB_SSL') ? { rejectUnauthorized: false } : undefined,
      },
      pool: {
        min: 2,
        max: 10,
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default dbConfig
```

### Environment Variables to Add

| Variable | Value (local dev) | Value (Supabase) | Purpose |
|----------|-------------------|-------------------|---------|
| `DB_SSL` | `false` | `true` | Enable SSL for Supabase connections |

**Existing variables (already in .env):** `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` - no changes needed to these.

### Previous Story Intelligence

**Story 1.3 (Backend Scaffold) - Key Learnings:**
- `ENV_PATH=../../` prefix is required for all `node ace` commands (NOT `--env-path` flag)
- Biome v2 at monorepo root handles linting/formatting (no ESLint/Prettier)
- Session auth is already configured: `sessionGuard` + `sessionUserProvider` + `scrypt` hashing
- `DB_NAME` was renamed to `DB_DATABASE` in root `.env` to match AdonisJS conventions
- Current User model has `id: number` and `increments('id')` migration - both must change to UUID
- Current User model composes `AuthFinder` mixin only - add `SoftDeletes` alongside it
- `pnpm lint` from root runs Biome across all workspaces

**Story 1.3 Code Review Fixes Applied:**
- `SESSION_DRIVER` enum restricted to `['cookie']` only
- `DB_PASSWORD` made required (not optional)
- Dead env vars removed from `.env.example`
- `.claude/` added to `.gitignore`

**Files NOT to modify (from previous stories):**
- `pnpm-workspace.yaml` - already configured
- `biome.json` - root Biome config (Story 1.2)
- `apps/frontend/` - do not touch
- `packages/shared/` - leave as-is
- `_bmad/` and `_bmad-output/` - BMAD directories, never touch

### Naming Conventions (CRITICAL)

| Element | Convention | Example |
|---------|------------|---------|
| Migrations | Number prefix, snake_case | `0001_create_users_table.ts`, `0002_enable_rls_on_users.ts` |
| DB Tables | snake_case, plural | `users` |
| DB Columns | snake_case | `user_id`, `deleted_at`, `created_at` |
| Models | PascalCase, singular | `User` |
| Middleware | snake_case file, PascalCase class | `set_rls_user_middleware.ts` / `SetRlsUserMiddleware` |
| Indexes | `idx_{table}_{columns}` | `idx_users_deleted_at` |

### Anti-Patterns to AVOID

- **DO NOT** use `uuid_generate_v4()` - requires `uuid-ossp` extension; use `gen_random_uuid()` (native)
- **DO NOT** use `selfAssignPrimaryKey = true` - database generates UUID via `gen_random_uuid()`, not application
- **DO NOT** use `this.raw()` in migrations - that's AdonisJS 5 syntax; use `this.db.rawQuery().knexQuery` for defaults, `this.schema.raw()` for standalone SQL
- **DO NOT** use Supabase Auth SDK (`@supabase/supabase-js`) - auth is AdonisJS native
- **DO NOT** use transaction mode pooler (port 6543) - Lucid uses prepared statements; use direct connection (port 5432)
- **DO NOT** hard delete records - always use soft delete (`deleted_at`)
- **DO NOT** register RLS middleware globally - register as named middleware, applied per route group
- **DO NOT** use `auth.uid()` in RLS policies - that's Supabase Auth; use `current_setting('app.current_user_id')`

### Project Structure Notes

**New files created by this story:**
```
apps/backend/
├── app/
│   ├── middleware/
│   │   └── set_rls_user_middleware.ts     # NEW: Sets app.current_user_id for RLS
│   └── models/
│       └── user.ts                         # MODIFIED: UUID + SoftDeletes + forUser scope
├── config/
│   └── database.ts                         # MODIFIED: SSL + pool config
├── database/
│   └── migrations/
│       ├── 0001_create_users_table.ts      # NEW (replaces old increments migration)
│       └── 0002_enable_rls_on_users.ts     # NEW: RLS policies
├── start/
│   └── env.ts                              # MODIFIED: add DB_SSL
└── adonisrc.ts                             # MODIFIED: add soft-deletes provider
```

**Root files modified:**
- `.env` - add `DB_SSL=false`
- `.env.example` - add `DB_SSL` with documentation comment

**Deleted files:**
- `apps/backend/database/migrations/1770843000426_create_users_table.ts` - replaced by `0001_create_users_table.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns - Soft Delete]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns]
- [Source: _bmad-output/planning-artifacts/prd.md#FR54 - Data isolation by user_id]
- [Source: _bmad-output/planning-artifacts/prd.md#FR56 - Row Level Security]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR11 - RLS must enforce data isolation]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR22 - Database transactions]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR23 - Soft delete all entities]
- [Source: _bmad-output/project-context.md#Data Patterns]
- [Source: _bmad-output/implementation-artifacts/1-3-scaffold-backend-application.md]
- [Source: AdonisJS 6 - Lucid Table Builder Documentation]
- [Source: AdonisJS 6 - Lucid Model Introduction]
- [Source: adonis-lucid-soft-deletes - GitHub]
- [Source: Supabase - Connecting to PostgreSQL]
- [Source: Supabase - Row Level Security]
- [Source: PostgreSQL Documentation - gen_random_uuid()]

---

## Senior Developer Review (AI)

**Review Date:** 2026-02-13
**Review Outcome:** Changes Requested (7 issues — all auto-fixed)
**Reviewer:** Claude Opus 4.6 (Code Review Workflow)

### Action Items

- [x] **[HIGH]** RLS middleware `set_config` with `is_local=true` ineffective with connection pooling — fixed: `is_local=false` + cleanup in `finally` block + documented limitation
- [x] **[HIGH]** RLS policy `::uuid` cast of empty string causes runtime errors — fixed: added `!= ''` guard before uuid cast in all policies
- [x] **[MEDIUM]** `FOR ALL` RLS policy allows hard DELETE (contradicts soft-delete-only) — fixed: split into separate `users_select_own` + `users_update_own` policies, no DELETE policy
- [x] **[MEDIUM]** `.env.example` contains dead Supabase Auth env vars — fixed: removed `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [x] **[MEDIUM]** `package.json` and `pnpm-lock.yaml` missing from File List — fixed: added to File List
- [x] **[MEDIUM]** No automated tests — fixed: added 6 unit tests (4 User model, 2 middleware)
- [x] **[LOW]** `docker-compose.yml` password hardcoded — fixed: uses `env_file: ../.env` with `${DB_*}` variable references
- [x] **[LOW]** `.env` contains unused `DATABASE_URL` — fixed: removed

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Biome format fix: migration chain method call reformatted to single line per Biome rules
- PostgreSQL not available locally — created `db_dev/docker-compose.yml` per user request for local dev DB

### Completion Notes List

- Configured Lucid ORM with conditional SSL (`DB_SSL` env var) and connection pool (min:2, max:10)
- Installed `adonis-lucid-soft-deletes` and registered provider in `adonisrc.ts`
- Replaced old `increments('id')` migration with UUID `gen_random_uuid()` migration + `deleted_at` + `idx_users_deleted_at` index
- Updated User model: `id: string`, `SoftDeletes` mixin, `deletedAt` column, `forUser` query scope
- Created RLS migration: `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, `users_select_own` (SELECT), `users_update_own` (UPDATE), `users_insert_allow` (INSERT) policies — no DELETE policy (hard deletes denied by RLS)
- RLS policies guard against empty `app.current_user_id` with `!= ''` check before uuid cast (prevents runtime errors)
- Created `SetRlsUserMiddleware` setting `app.current_user_id` PostgreSQL session variable, registered as named middleware `rls`, with cleanup in finally block
- Documented connection pool limitation: RLS is defense-in-depth, forUser scope is primary isolation
- Added unit tests for User model (4 tests) and middleware (2 tests)
- All 9 verification subtasks passed: migrations run/rollback, table structure, RLS policies, type-check, lint, tests

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-12 | Story created with ultimate context analysis (UUID migration, RLS policies, soft delete, Supabase connection, auth clarification) | SM Agent (Opus 4.6) |
| 2026-02-13 | Implemented all 9 tasks: Supabase connection config, soft delete package, UUID migration, User model update, RLS migration, RLS middleware, forUser scope, env config, full verification | Dev Agent (Claude Opus 4.6) |
| 2026-02-13 | Code review fixes: RLS policies split SELECT/UPDATE (no DELETE), empty uuid cast guard, middleware cleanup in finally block, connection pool limitation documented, dead env vars cleaned, unit tests added, File List completed | Review Agent (Claude Opus 4.6) |

### File List

**New files:**
- `apps/backend/database/migrations/0001_create_users_table.ts`
- `apps/backend/database/migrations/0002_enable_rls_on_users.ts`
- `apps/backend/app/middleware/set_rls_user_middleware.ts`
- `apps/backend/tests/unit/models/user.spec.ts`
- `apps/backend/tests/unit/middleware/set_rls_user.spec.ts`
- `db_dev/docker-compose.yml`

**Modified files:**
- `apps/backend/config/database.ts`
- `apps/backend/start/env.ts`
- `apps/backend/app/models/user.ts`
- `apps/backend/adonisrc.ts`
- `apps/backend/start/kernel.ts`
- `apps/backend/package.json`
- `pnpm-lock.yaml`
- `.env`
- `.env.example`

**Deleted files:**
- `apps/backend/database/migrations/1770843000426_create_users_table.ts`
