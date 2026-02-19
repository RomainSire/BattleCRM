# Story 1.8: Setup Docker Production Environment

Status: done

<!-- Ultimate Context Engine Analysis: 2026-02-19 -->
<!-- Previous stories: 1-1 (done), 1-2 (done), 1-3 (done), 1-4 (done), 1-5 (done), 1-6 (done), 1-7 (done) -->

## Story

As a **developer**,
I want **a Docker Compose setup for production deployment on a VPS**,
So that **the full stack (frontend, backend, PostgreSQL) can be deployed and run consistently**.

## Acceptance Criteria

1. **AC1:** `db_dev/` directory and its contents are deleted — replaced by the root-level docker-compose.yml
2. **AC2:** RLS artifacts are removed: `0002_enable_rls_on_users.ts` migration deleted (and rolled back if applied), `set_rls_user_middleware.ts` deleted, `rls` removed from kernel.ts named middleware, `DB_SSL` removed from env.ts and database.ts
3. **AC3:** A `docker-compose.yml` exists at the monorepo root with 3 services: `postgres`, `backend`, `frontend`
4. **AC4:** `docker compose up postgres` starts only the PostgreSQL container on port 5432 — enabling local dev workflow (run backend+frontend locally, DB in Docker)
5. **AC5:** `docker compose up --build` builds and starts all 3 services successfully
6. **AC6:** `GET http://localhost/api/health` returns `{ status: "ok" }` when all containers are running
7. **AC7:** Frontend is accessible at `http://localhost` (port 80) and the SPA works (routes resolve)
8. **AC8:** `.env.example` updated — Supabase references removed, `DB_SSL` removed, Docker-specific variables documented
9. **AC9:** `pnpm lint` passes from root (no TypeScript errors, no Biome errors)

## Tasks / Subtasks

- [x] **Task 1: Cleanup RLS Artifacts** (AC: 2)
  - [x] 1.1 Check if migration `0002_enable_rls_on_users.ts` was applied: `ENV_PATH=../../ node ace migration:status`
  - [x] 1.2 If applied, roll it back: `ENV_PATH=../../ node ace migration:rollback` (rolls back to 0001 only)
  - [x] 1.3 Delete `apps/backend/database/migrations/0002_enable_rls_on_users.ts`
  - [x] 1.4 Delete `apps/backend/app/middleware/set_rls_user_middleware.ts`
  - [x] 1.5 Remove `rls: () => import('#middleware/set_rls_user_middleware')` from `start/kernel.ts` named middleware export
  - [x] 1.6 Remove `DB_SSL` from `apps/backend/start/env.ts` schema
  - [x] 1.7 Remove SSL conditional from `apps/backend/config/database.ts` — delete `ssl: env.get('DB_SSL') ? { rejectUnauthorized: false } : undefined`
  - [x] 1.8 Remove `DB_SSL=false` line from root `.env`

- [x] **Task 2: Remove db_dev/** (AC: 1)
  - [x] 2.1 Delete `db_dev/docker-compose.yml`
  - [x] 2.2 Delete `db_dev/README.md` (if exists)
  - [x] 2.3 Remove `db_dev/` directory entirely

- [x] **Task 3: Create Backend Dockerfile** (AC: 5)
  - [x] 3.1 Create `apps/backend/Dockerfile` (multi-stage build: deps + build + production)
  - [x] 3.2 Create `apps/backend/.dockerignore`

- [x] **Task 4: Create Frontend Dockerfile + nginx config** (AC: 5, 6, 7)
  - [x] 4.1 Create `apps/frontend/nginx.conf` (serve static files + proxy /api/ to backend:3333)
  - [x] 4.2 Create `apps/frontend/Dockerfile` (multi-stage: vite build → nginx serve)
  - [x] 4.3 Create `apps/frontend/.dockerignore`

- [x] **Task 5: Create root docker-compose.yml** (AC: 3, 4, 5)
  - [x] 5.1 Create `docker-compose.yml` at monorepo root with services: `postgres`, `backend`, `frontend`
  - [x] 5.2 Postgres service: postgres:16, persistent volume `pgdata`, healthcheck, port 5432 exposed
  - [x] 5.3 Backend service: build from `./apps/backend`, `depends_on: postgres (healthy)`, env from `.env` with `DB_HOST=postgres` override
  - [x] 5.4 Frontend service: build from root context (`.`) with `apps/frontend/Dockerfile`, `depends_on: backend`, port 80 exposed

- [x] **Task 6: Update .env.example** (AC: 8)
  - [x] 6.1 Remove `DB_SSL` variable and its comment
  - [x] 6.2 Update `# Database (Supabase PostgreSQL)` comment to `# Database (PostgreSQL — Docker)`
  - [x] 6.3 Add comment explaining `DB_HOST=localhost` for local dev vs `DB_HOST=postgres` for Docker
  - [x] 6.4 Add section `# Docker Production` with note about `VITE_API_URL=/api` for Docker builds

- [x] **Task 7: Verification** (AC: 1-9)
  - [x] 7.1 `docker compose up postgres -d` starts DB, `docker ps` shows it healthy
  - [x] 7.2 `ENV_PATH=../../ node ace migration:run` connects to Docker PostgreSQL and runs migration 0001 successfully
  - [x] 7.3 `ENV_PATH=../../ node ace test functional` passes (17+ tests)
  - [x] 7.4 `docker compose up --build` builds all 3 services without errors
  - [x] 7.5 `curl http://localhost/api/health` returns `{ "status": "ok" }`
  - [x] 7.6 `curl http://localhost` returns HTML (frontend loads)
  - [x] 7.7 No `0002_enable_rls_on_users.ts` file exists
  - [x] 7.8 No `set_rls_user_middleware.ts` file exists
  - [x] 7.9 No `db_dev/` directory exists
  - [x] 7.10 `pnpm lint` from root passes with no errors

## Dev Notes

### Critical Architecture Requirements

**Context:** This story implements the architecture change from Supabase → local PostgreSQL Docker, and creates the production deployment setup. It also cleans up all Supabase-specific artifacts.

| Component | Decision | Notes |
|-----------|----------|-------|
| Database | PostgreSQL 16 in Docker | Self-hosted, no external dependency |
| User isolation | `forUser()` Lucid scope only | RLS was defense-in-depth only; now removed entirely |
| Docker context | Root (`.`) for all builds | Allows access to monorepo root `.env`, `pnpm-workspace.yaml` |
| Frontend serving | nginx (alpine) | Serves Vite build + proxies `/api/*` to backend |
| SSL | Out of scope | Add reverse proxy (nginx/traefik) + Let's Encrypt on VPS separately |

### CRITICAL: RLS Cleanup Details

The `0002_enable_rls_on_users.ts` migration enabled Row Level Security which is a Supabase-specific feature. Since we now use plain PostgreSQL (without the Supabase authentication JWT), the RLS policies that use `current_setting('app.current_user_id')` are meaningless for our use case. User isolation is handled at the application layer via the `forUser()` Lucid scope.

**Files to DELETE:**
- `apps/backend/database/migrations/0002_enable_rls_on_users.ts`
- `apps/backend/app/middleware/set_rls_user_middleware.ts`

**Files to MODIFY:**
```typescript
// start/kernel.ts — REMOVE this line:
rls: () => import('#middleware/set_rls_user_middleware'),

// start/env.ts — REMOVE:
DB_SSL: Env.schema.boolean(),

// config/database.ts — REMOVE the ssl conditional:
ssl: env.get('DB_SSL') ? { rejectUnauthorized: false } : undefined,
// Config pool remains: { min: 2, max: 10 }
```

**Note on migration rollback:** The `0002` migration added `ENABLE ROW LEVEL SECURITY` on the `users` table. This should be rolled back before deleting the file. If the DB is ephemeral (dev environment), a fresh start is fine (`migration:fresh` or delete/recreate DB volume).

### CRITICAL: Backend Dockerfile

The Adonis.js build process:
1. `node ace build` — compiles TypeScript → `build/` directory (standalone, has own `package.json`)
2. `cd build && npm ci --production` — install only production deps inside `build/`
3. `node bin/server.js` — run the compiled app

**Note on ENV_PATH:** In the monorepo, `ENV_PATH=../../` is needed because `.env` is at root. In Docker, env vars are injected by `env_file` in docker-compose, so Adonis reads them from the system environment directly. **Do NOT use `ENV_PATH` in the Dockerfile** — it won't work inside the container.

**Backend Dockerfile template:**
```dockerfile
# apps/backend/Dockerfile
# Build context: monorepo root (.)
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
RUN pnpm install --frozen-lockfile --filter @battlecrm/backend

# Build stage
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY apps/backend ./apps/backend
WORKDIR /app/apps/backend
RUN node ace build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=build /app/apps/backend/build .
RUN npm ci --production
ENV NODE_ENV=production
EXPOSE 3333
CMD ["node", "bin/server.js"]
```

**Backend .dockerignore (`apps/backend/.dockerignore`):**
```
node_modules
build
tests
.env
*.spec.ts
```

### CRITICAL: Frontend Dockerfile + nginx config

**nginx.conf** (`apps/frontend/nginx.conf`):
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing — forward all non-file requests to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend container
    location /api/ {
        proxy_pass http://backend:3333/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Frontend Dockerfile** (`apps/frontend/Dockerfile`):
```dockerfile
# Build context: monorepo root (.) — needed for pnpm workspace and root .env
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --frozen-lockfile --filter @battlecrm/frontend

# Build stage (Vite build)
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY apps/frontend ./apps/frontend
# Copy root .env for VITE_ env vars (inlined at build time by Vite)
COPY .env ./.env
WORKDIR /app/apps/frontend
RUN pnpm run build

# Production stage (nginx serving static files)
FROM nginx:alpine AS production
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**Frontend .dockerignore (`apps/frontend/.dockerignore`):**
```
node_modules
dist
.env.local
```

**IMPORTANT: VITE_API_URL for Docker builds:**
- For **local dev** (without Docker): `VITE_API_URL=http://localhost:3333/api`
- For **Docker production build**: `VITE_API_URL=/api`

When building the Docker image, the `.env` at the root is copied into the build context. Before running `docker compose up --build` for production, set `VITE_API_URL=/api` in your `.env` (or use a `.env.prod` and `--env-file`).

### CRITICAL: docker-compose.yml

**Root `docker-compose.yml`:**
```yaml
services:
  postgres:
    image: postgres:16
    container_name: battlecrm-postgres
    restart: unless-stopped
    env_file: .env
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_DATABASE}
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${DB_USER} -d ${DB_DATABASE}']
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    container_name: battlecrm-backend
    restart: unless-stopped
    env_file: .env
    environment:
      DB_HOST: postgres
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
    container_name: battlecrm-frontend
    restart: unless-stopped
    ports:
      - '80:80'
    depends_on:
      - backend

volumes:
  pgdata:
```

**Key decisions:**
- `DB_HOST: postgres` overrides the `.env` value (where it's `localhost` for dev) to use Docker service name
- `backend` has no exposed ports (only accessible via frontend nginx proxy)
- `postgres` exposes 5432 for local dev DB workflow
- `healthcheck` on postgres ensures backend waits for DB to be ready

### Local Dev Workflow (DB only)

For day-to-day development, start only the DB:
```bash
# Start only PostgreSQL
docker compose up postgres -d

# Run backend locally (connects to Docker DB on localhost:5432)
cd apps/backend
ENV_PATH=../../ node ace serve --hmr

# Run frontend locally
cd apps/frontend
pnpm dev
```

This replaces the deprecated `db_dev/docker-compose.yml` workflow.

### Project Structure Notes

**Files to CREATE:**
```
/                             ← monorepo root
└── docker-compose.yml        # NEW: full production stack

apps/backend/
├── Dockerfile                # NEW: multi-stage (deps → build → production)
└── .dockerignore             # NEW

apps/frontend/
├── nginx.conf                # NEW: SPA routing + /api proxy
├── Dockerfile                # NEW: multi-stage (vite build → nginx)
└── .dockerignore             # NEW
```

**Files to DELETE:**
```
db_dev/
├── docker-compose.yml        # DELETE: replaced by root docker-compose.yml
└── README.md                 # DELETE (if exists)

apps/backend/
├── database/migrations/
│   └── 0002_enable_rls_on_users.ts    # DELETE: RLS not used with local PostgreSQL
└── app/middleware/
    └── set_rls_user_middleware.ts     # DELETE: RLS middleware no longer needed
```

**Files to MODIFY:**
```
apps/backend/
├── start/kernel.ts      # REMOVE: rls named middleware registration
├── start/env.ts         # REMOVE: DB_SSL env schema
└── config/database.ts   # REMOVE: ssl conditional in connection config

.env                     # REMOVE: DB_SSL=false line
.env.example             # UPDATE: remove DB_SSL, update DB section comment, add Docker notes
```

### Previous Story Intelligence

**Story 1.7 (User Logout) — Key Learnings:**
- All test files use dedicated email domains (`@test-login.com`, `@test-register.com`) for isolation
- `loginAs(user)` from `@japa/api-client` establishes test sessions for authenticated endpoint tests
- `ENV_PATH=../../ node ace migration:run` required for all ace commands from `apps/backend/`
- Backend has 17 functional tests (login: 6, register: 5, me: 2, logout: 3, registration_status: 1)
- RLS middleware `set_rls_user_middleware.ts` is registered as named `rls` in `start/kernel.ts` but **not assigned to any route** — it's safe to delete without breaking anything
- `forUser()` scope on User model is the primary isolation mechanism (already functional)

**Story 1.4 Architecture Change Note:**
- `0002_enable_rls_on_users.ts` adds `ENABLE ROW LEVEL SECURITY` and policies on users table
- When using plain PostgreSQL (not Supabase), `current_setting('app.current_user_id')` still works but the middleware to set it is being removed, making the RLS policies inert
- Safe to remove both the migration AND the middleware

### Git Intelligence

**Recent commits (from main):**
- `345086e` Merge pull request #5 from RomainSire/story-1.7
- `c226087` BMAD(architecture): transition from Supabase to local PostgreSQL (doc updates)
- `4903f21` feat(auth): finalize user logout implementation and fix redirect loop
- `bb69700` feat(auth): implement user logout functionality with loading state and tests

**Key patterns established:**
- Branch naming: `story-1-8`
- Commit format: `feat(docker): description` or `chore(cleanup): description`
- Tests use teardown cleanup (lifecycle hooks)
- Bruno API files in `.brunoCollection/auth/`

### Naming Conventions (CRITICAL)

| Element | Convention | Example |
|---------|------------|---------|
| Docker service | lowercase | `postgres`, `backend`, `frontend` |
| Container name | kebab-case | `battlecrm-postgres`, `battlecrm-backend` |
| Docker volume | lowercase snake | `pgdata` |
| nginx config | lowercase | `nginx.conf` |
| Dockerfile | PascalCase (standard) | `Dockerfile` |

### Anti-Patterns to AVOID

- **DO NOT** use `ENV_PATH=../../` in Dockerfiles — env vars are injected via `env_file` in compose
- **DO NOT** expose backend port 3333 externally — only accessible via frontend nginx proxy
- **DO NOT** commit `.env` to version control — use `.env.example`
- **DO NOT** hardcode credentials in Dockerfile — use `env_file` and `environment` in compose
- **DO NOT** skip the PostgreSQL healthcheck — backend must wait for DB to be ready
- **DO NOT** use `FORCE ROW LEVEL SECURITY` or any RLS-specific SQL — that's the old Supabase approach
- **DO NOT** keep `rls` in kernel.ts exports even as unused — it would cause TypeScript errors after deleting the file
- **DO NOT** forget to update `.env.example` — it still references Supabase in comments

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.8]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure & Configuration]
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions]
- [Source: _bmad-output/planning-artifacts/prd.md#Deployment Strategy]
- [Source: _bmad-output/project-context.md#Technology Stack]
- [Source: _bmad-output/implementation-artifacts/1-4-configure-supabase-database-schema.md#Architecture Change Note]
- [Source: _bmad-output/implementation-artifacts/1-7-implement-user-logout.md]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

#### Migration Rollback Strategy

Both migrations 0001 and 0002 were in batch 1. To remove only the RLS migration:
1. `migration:rollback` → rolled back both (batch 1)
2. Deleted `0002_enable_rls_on_users.ts`
3. `migration:run` → re-applied only 0001
This is acceptable for dev — no production data was affected.

#### Biome Import Fix

`pnpm biome check --write .` fixed a pre-existing import order issue in `useAuth.ts` (unrelated to this story's changes — `@/lib/queryKeys` was listed before `@tanstack/react-query`).

#### Docker Daemon Access

Docker CLI commands (7.1, 7.4, 7.5, 7.6) require manual verification by Romain since the CI environment lacks Docker daemon access.

#### Root .dockerignore Required

When build context is `.` (root), Docker reads `.dockerignore` from the root — NOT from `apps/backend/.dockerignore` or `apps/frontend/.dockerignore`. Without a root `.dockerignore`, Docker includes `apps/backend/tests/` in the build context, causing `tsc` to compile test files that reference deleted middleware. Fixed by creating `/.dockerignore` that excludes `apps/backend/tests`.

#### New Docker Volume on First Run

`docker compose up postgres -d` using the new root `docker-compose.yml` creates volume `battlecrm_pgdata` (different from old `db_dev_pgdata`). Migrations must be re-run: `ENV_PATH=../../ node ace migration:run`.

#### Deleted Unit Test

`tests/unit/middleware/set_rls_user.spec.ts` was not in the story's File List but references the deleted `set_rls_user_middleware`. It was deleted to fix TypeScript compilation errors in the Docker build.

### Completion Notes List

- Cleaned up all RLS artifacts: deleted 0002 migration + middleware, removed from kernel.ts, env.ts, database.ts, .env
- Removed db_dev/ directory (replaced by root docker-compose.yml)
- Created multi-stage backend Dockerfile (deps → build → production)
- Created multi-stage frontend Dockerfile (deps → vite build → nginx:alpine)
- Created nginx.conf with SPA routing (`try_files`) and `/api/` proxy to backend:3333
- Created root docker-compose.yml with 3 services: postgres (healthcheck), backend, frontend
- Updated .env.example: removed DB_SSL, updated DB section comment, added VITE_API_URL explanation
- Fixed pre-existing Biome import order in useAuth.ts (`pnpm biome check --write .`)
- All 21 tests pass (17 functional + 4 unit; deleted obsolete RLS unit test)
- `pnpm lint` passes clean
- Created root `.dockerignore` (effective for `context: .` builds); `apps/backend/.dockerignore` and `apps/frontend/.dockerignore` are only used when their respective dirs are the build context
- `npm install --omit=dev` instead of `npm ci --production` (ace build output has no package-lock.json)
- Full Docker verification: `docker compose up --build` ✓, `curl http://localhost/api/health` → `{"status":"ok"}` ✓, `curl http://localhost` → HTML ✓

### File List

- `apps/backend/database/migrations/0002_enable_rls_on_users.ts` — DELETED: RLS not needed with plain PostgreSQL
- `apps/backend/app/middleware/set_rls_user_middleware.ts` — DELETED: RLS middleware removed
- `apps/backend/start/kernel.ts` — MODIFIED: removed `rls` named middleware registration
- `apps/backend/start/env.ts` — MODIFIED: removed `DB_SSL` env variable schema
- `apps/backend/config/database.ts` — MODIFIED: removed `ssl` conditional from connection config
- `apps/backend/Dockerfile` — MODIFIED: added HEALTHCHECK + `USER node` for security
- `apps/frontend/Dockerfile` — MODIFIED: replaced `COPY .env` with `ARG VITE_API_URL` (no secrets in build layer)
- `apps/frontend/nginx.conf` — MODIFIED: added `proxy_http_version 1.1`, keep-alive headers, `X-Forwarded-Proto`, security headers (`server_tokens off`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`)
- `.dockerignore` — MODIFIED: added `.env` exclusion + `apps/backend/tests` exclusion
- `apps/backend/.dockerignore` — DELETED: dead code (build context is `.`; root `.dockerignore` applies)
- `apps/frontend/.dockerignore` — DELETED: dead code (build context is `.`; root `.dockerignore` applies)
- `apps/backend/tests/unit/middleware/set_rls_user.spec.ts` — DELETED: unit test for removed RLS middleware
- `apps/frontend/src/features/auth/hooks/useAuth.ts` — MODIFIED: Biome import sort fix (pre-existing issue)
- `docker-compose.yml` — MODIFIED: frontend `depends_on` uses `condition: service_healthy`; added `build.args: VITE_API_URL: /api`
- `.env` — MODIFIED: removed `DB_SSL=false` line
- `.env.example` — MODIFIED: removed DB_SSL, updated comments, added Docker notes, clarified VITE_API_URL ARG behavior
- `db_dev/` — DELETED: entire directory removed (replaced by root docker-compose.yml)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-19 | Story created with Docker production environment analysis | SM Agent (Opus 4.6) |
| 2026-02-19 | Full implementation: RLS cleanup, db_dev removal, Dockerfiles, docker-compose, .env.example update | Dev Agent (Sonnet 4.6) |
| 2026-02-19 | Bug fix: deleted set_rls_user.spec.ts (TS compile error in Docker), added root .dockerignore, re-ran migrations vs new volume | Dev Agent (Sonnet 4.6) |
| 2026-02-19 | Bug fix: npm ci → npm install --omit=dev (no package-lock.json in ace build output) | Dev Agent (Sonnet 4.6) |
| 2026-02-19 | Full verification: docker compose up --build ✓, /api/health ✓, frontend ✓ | Dev Agent (Sonnet 4.6) |
| 2026-02-19 | Code review fixes: USER node + HEALTHCHECK in backend Dockerfile; ARG VITE_API_URL (no .env copy); nginx http/1.1 keepalive + security headers; depends_on service_healthy; .dockerignore cleanup (add .env + tests); deleted dead app-level .dockerignore files | Code Review (Sonnet 4.6) |
| 2026-02-20 | Bug fix: healthcheck CMD replaced wget with node http module (wget behavior unreliable on Alpine BusyBox); all containers healthy and verified | Code Review (Sonnet 4.6) |
