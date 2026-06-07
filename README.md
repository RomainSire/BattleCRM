# BattleCRM

Personal CRM for job hunting with A/B testing capabilities. Track prospects, manage positioning variants ("Battles"), and optimize your outreach through data-driven experimentation.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 / Vite / TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui |
| Backend | AdonisJS 6 + Lucid ORM |
| Database | PostgreSQL (via Docker) |
| Extension | WXT + React (Chrome/Firefox) |
| Monorepo | pnpm workspaces |

> Auth is native AdonisJS sessions (scrypt, httpOnly cookies). **No Supabase.**

## Project Structure

```
BattleCRM/
├── apps/
│   ├── frontend/          # React + Vite SPA
│   ├── backend/           # AdonisJS REST API
│   └── extension/         # Chrome/Firefox extension (WXT)
├── packages/
│   └── shared/            # @battlecrm/shared — shared TypeScript types
├── docker-compose.yml     # postgres + backend + frontend (prod)
├── pnpm-workspace.yaml    # Workspace configuration
├── package.json           # Root scripts
└── .env                   # Environment variables (single file at root)
```

## Getting Started

### Prerequisites

- Node.js >= 20.6.0
- pnpm >= 8.0.0
- Docker (for the PostgreSQL database)
- A **native** Chrome/Chromium binary (only for the browser extension dev server).
  On Fedora: `sudo dnf install chromium`. A Flatpak Chromium does **not** work —
  WXT/`chrome-launcher` needs a real executable on `PATH`.

> **Docker permissions (Linux):** your user must be in the `docker` group, otherwise
> Docker commands fail with `permission denied ... /var/run/docker.sock`.
> Fix once with `sudo usermod -aG docker $USER`, then log out / log back in
> (or run `newgrp docker` in the current shell). Verify with `docker ps`.

### 1. Install

```bash
git clone <repository-url>
cd BattleCRM
pnpm install

# Create your env file (a single .env lives at the repo root)
cp .env.example .env
```

Then edit `.env`:
- `APP_KEY` — generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `DB_PASSWORD` — any value; the same value is used by the Postgres container and the backend.

### 2. Start the database (PostgreSQL via Docker)

The `postgres` service in `docker-compose.yml` does **not** publish its port (that's
intentional for production, where the backend runs inside the Docker network). For
local development, create a `docker-compose.override.yml` at the repo root to expose
the port on `localhost` — Compose merges it automatically:

```yaml
# docker-compose.override.yml (not versioned — gitignored)
services:
  postgres:
    ports:
      - "${DB_PORT:-5432}:5432"
```

Then start it:

```bash
docker compose up postgres -d
docker compose ps               # should show 0.0.0.0:5432->5432/tcp, status "healthy"
```

### 3. Run the migrations

On a fresh database (e.g. after a clean Docker volume), apply the schema.
All `node ace` commands require the `ENV_PATH=../../` prefix (the `.env` lives at the root).

```bash
cd apps/backend
ENV_PATH=../../ node ace migration:run
cd ../..
```

### 4. Run the app

```bash
pnpm dev          # runs ALL apps in parallel: backend + frontend + extension
```

- Frontend (Vite): **http://localhost:5173**
- Backend (AdonisJS API): **http://localhost:3333**
- Extension (WXT) opens its own Chromium dev window with the extension hot-loaded.

> `pnpm dev` runs the apps in parallel, so **if one fails, the whole command aborts.**
> The most common cause after a fresh setup is the extension not finding a native
> Chrome/Chromium (see Prerequisites) — install it, or run the apps you need
> individually (see below).

> `pnpm dev` automatically builds `@battlecrm/shared` first (via a `predev` hook),
> so the shared TypeScript types are always available. If your editor still shows
> `Cannot find module '@battlecrm/shared'`, restart the TS server
> (VS Code: *TypeScript: Restart TS Server*).

### 5. Running apps individually (optional)

```bash
pnpm dev:extension                      # only the extension (WXT + Chromium dev window)
pnpm --filter @battlecrm/backend dev    # only the backend
pnpm --filter @battlecrm/frontend dev   # only the frontend
```

> If the extension dev window doesn't open after a fresh clone, generate WXT's files
> once with `pnpm --filter @battlecrm/extension type-check`, then retry.

### Common scripts

```bash
pnpm dev           # Run backend + frontend in dev mode
pnpm build         # Build all apps
pnpm lint          # Biome check (read-only)
pnpm format        # Biome check --write (auto-fix)
pnpm type-check    # TypeScript type checking across the monorepo
pnpm test          # Run all tests (excludes E2E)
```

### Backend (AdonisJS) — useful commands

> Always prefix with `ENV_PATH=../../` (run from `apps/backend`).

```bash
ENV_PATH=../../ node ace serve --hmr          # Dev with hot reload
ENV_PATH=../../ node ace migration:run        # Apply migrations
ENV_PATH=../../ node ace migration:rollback   # Roll back
ENV_PATH=../../ node ace test                 # Run Japa tests
```

### Adding dependencies

```bash
pnpm --filter @battlecrm/frontend add <package>   # frontend
pnpm --filter @battlecrm/backend  add <package>   # backend
pnpm add -D -w <package>                           # root dev dependency
```

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `permission denied ... /var/run/docker.sock` | Your user isn't in the `docker` group → `sudo usermod -aG docker $USER`, then re-login (or `newgrp docker`). |
| Migration fails with `AggregateError` / `ECONNREFUSED` on connect | Postgres isn't reachable on `localhost:5432`. Make sure the container is up **and** the port is published (see the `docker-compose.override.yml` step above). Check with `docker compose ps`. |
| `docker compose ps` shows `5432/tcp` (no `0.0.0.0:...`) | The port isn't published → add the `docker-compose.override.yml` and re-run `docker compose up postgres -d`. |
| TS errors `Cannot find module '@battlecrm/shared'` / frontend won't start | The shared package isn't built. `pnpm dev` builds it automatically, but you can force it with `pnpm shared:build`. In VS Code, restart the TS server afterwards. |
| `http://localhost:5173` refuses the connection | Vite may bind to IPv6 only — try `http://127.0.0.1:5173`. Also make sure Vite actually started (it needs `@battlecrm/shared` built — see the row above). |
| `pnpm dev` aborts with `CHROME_PATH ... must be set` / `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` | The extension (WXT) can't find a native Chrome/Chromium → `sudo dnf install chromium` (a Flatpak Chromium won't do). Or run the other apps individually (see "Running apps individually"). |

## Environment Variables

A single `.env` lives at the repo root. See `.env.example` for all variables.

Key variables:
- `APP_KEY` — AdonisJS app key (see generation command above)
- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_DATABASE` — PostgreSQL connection
- `SESSION_DRIVER` — `cookie` for local development

## Browser Extension

BattleCRM includes a Chrome/Firefox extension that detects LinkedIn profiles and lets you add or update prospects without leaving the browser.

→ **[Extension Installation Guide](docs/extension-install.md)**

## License

Private - All rights reserved.
