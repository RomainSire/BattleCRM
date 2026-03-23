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

### Prospect-Positioning Assignment (CRITIQUE — révisé 2026-03-23)
- **`prospect_positionings`** est une junction table many-to-many entre prospects et positionings. Un prospect peut avoir UN positionnement par funnel stage (max).
- **Positionnement actif d'un prospect :** `prospect_positionings WHERE prospect_id = X AND funnel_stage_id = prospect.funnel_stage_id` (dérivé automatiquement — aucune colonne "actif" à maintenir).
- **`outcome`** (`null` | `'success'` | `'failed'`) — défini TOUJOURS explicitement par l'utilisateur : boutons sur le détail prospect, ou pop-up lors du changement de stage. Jamais automatique. Archivage d'un prospect → `outcome = 'failed'` sur le positionnement du stage courant.
- **Contrainte UNIQUE** sur `(user_id, prospect_id, funnel_stage_id)` — assigner un nouveau positionnement sur un stage existant remplace l'ancien (delete + insert).
- **`interaction.funnel_stage_id` :** snapshot du stage courant du prospect au moment de la création. Immutable. Permet de retrouver le contexte même après changement de stage.
- **`interaction.positioning_id` :** snapshot du positionnement actif au moment de la création. Immutable.
- **Bug à corriger :** `apps/backend/app/models/positioning.ts:53` — `hasMany(() => Prospect)` est cassé depuis migration 0007, doit être supprimé.
- **Suppression funnel stage :** bloquée si un prospect est actuellement dessus (`prospect.funnel_stage_id = stage.id`). Autorisée si seulement des interactions ou `prospect_positionings` y référencent — afficher "Stage supprimé" dans l'UI.
- ❌ Ne pas chercher `prospect.positioning_id` — cette colonne n'existe plus (migration 0007).
- ❌ Ne pas utiliser `ended_at` ni `assigned_at` — ces champs n'existent pas dans le modèle final.

### Data Patterns
- **Soft delete only** - never hard delete, use `deleted_at`
- Soft delete implemented via `adonis-lucid-soft-deletes` package; `.delete()` on a model instance performs a soft delete
- `withTrashed()` is not declared in the default Lucid types — use `apps/backend/types/soft_deletes.d.ts` module augmentation (already exists)
- ⚠️ **SoftDeletes + sub-resource endpoints checklist** — any endpoint that looks up a **parent model** to serve a sub-resource (e.g. `GET /api/prospects/:id/interactions`) MUST add `.withTrashed()` on the parent query, otherwise archived parents return 404 and silently break access to their child data. This has caused bugs in Stories 3.6, 4.2 — check this every time a sub-resource endpoint is implemented.
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
- Frontend: inline errors for ALL API errors — **never `toast.error()`** for mutation failures
- Toasts (`toast.success()`) for successful mutations only — reserved for actions with no obvious visual feedback
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

# Run backend migrations (from apps/backend/)
ENV_PATH=../../ node ace migration:run
```

```typescript
// Query key pattern
queryKeys.prospects.list()
queryKeys.prospects.detail(id)
```
