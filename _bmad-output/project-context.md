---
project_name: 'BattleCRM'
user_name: 'Romain'
date: '2026-02-03'
status: 'complete'
---

# Project Context for AI Agents

_Critical rules and patterns for implementing BattleCRM. Read this before writing any code._

---

## Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React 18+ / Vite | TypeScript strict |
| UI | Tailwind CSS + shadcn/ui | Light mode only |
| State | TanStack Query | Centralized query keys |
| Routing | React Router v7 | Declarative mode |
| Backend | Adonis.js 6 | API kit, sessions |
| Database | PostgreSQL 16 (Docker) | Backend-enforced user isolation |
| Validation | VineJS | Both front and back (separate) |
| Linting/Formatting | Biome | Root config, replaces ESLint+Prettier |
| Monorepo | pnpm workspaces | No Turborepo |

---

## Critical Implementation Rules

### TypeScript
- Strict mode enabled everywhere
- Types suffixed with `Type` (e.g., `ProspectType`, `BattleType`)
- No `any` without explicit justification

### Naming Conventions
- **Database/API:** snake_case (`user_id`, `created_at`, `/api/prospects`)
- **Code:** camelCase for variables/functions, PascalCase for components
- **Pages:** Suffix with `Page` (e.g., `DashboardPage.tsx`)
- **Files:** PascalCase for components, camelCase for utils/hooks

### Project Structure (Frontend)
- Feature-based organization in `src/features/`
- Shared components only if used by 2+ features
- Co-locate tests with source files (`Component.test.tsx`)

### Authentication
- Sessions with httpOnly cookies (NOT JWT)
- Adonis native auth: scrypt password hashing, users in local PostgreSQL
- All fetch calls: `credentials: 'include'`
- User isolation enforced at backend level (all queries scoped to `auth.user.id`)

### Data Patterns
- **Soft delete only** - never hard delete, use `deleted_at`
- API lists: wrapped `{ data: [...], meta: {...} }`
- API single: direct object `{ id, name, ... }`
- Dates: ISO 8601 strings
- Nulls: explicit `null`, not absent fields

### State Management
- TanStack Query for ALL server state
- Query keys centralized in `src/lib/queryKeys.ts`
- Context for simple UI state, Zustand for complex

### Validation
- VineJS on frontend AND backend (separate schemas)
- Backend: Adonis validators in `app/validators/`
- Frontend: schemas in `src/schemas/`

### Error Handling
- Use Adonis default error format
- Frontend: inline errors under fields, toast for API errors
- Never use popups except for destructive confirmations

### Environment
- Single `.env` at monorepo root
- Vite: `envDir: '../../'` in config
- Adonis: `--env-path=../../.env` flag

---

## Anti-Patterns to Avoid

- ❌ Using JWT/access tokens (use sessions)
- ❌ Hard deleting records (use soft delete)
- ❌ camelCase in API/DB fields (use snake_case)
- ❌ Zod for validation (use VineJS)
- ❌ Full-page loading overlays (use skeletons)
- ❌ Separate .env per app (use root .env)
- ❌ Generic component folders (use feature-based)
- ❌ ESLint/Prettier (use Biome - single `biome.json` at monorepo root)
- ❌ Supabase SDK or external DB (use local PostgreSQL in Docker)
- ❌ Database-level RLS (not applicable without Supabase — enforce isolation in backend)

---

## Quick Reference

```bash
# Run dev
pnpm -r --parallel dev

# Lint all workspaces (from root)
pnpm lint

# Format all workspaces (from root)
pnpm format

# Add dependency to frontend
pnpm --filter @battlecrm/frontend add <package>

# Run backend migrations
cd apps/backend && node ace migration:run
```

```typescript
// Query key pattern
queryKeys.prospects.list()
queryKeys.prospects.detail(id)
```
