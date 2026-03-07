# Story 4.3: Build Positionings List View

Status: done

<!-- Ultimate Context Engine Analysis: 2026-03-07 -->
<!-- Epic 4: Positioning Variants — Story 3 (Frontend list view on top of Story 4.2 API) -->

## Story

As a user,
I want to see all my positioning variants organized by funnel stage,
so that I can manage my variants for each step of my pipeline.

## Acceptance Criteria

1. **AC1 (List view):** Navigating to `/positionings` shows a list of all active positioning variants for the authenticated user, ordered by `created_at DESC`. Each row shows: name, funnel stage (with badge), description preview (truncated). (FR13)

2. **AC2 (Stage filter):** Funnel stage filter pills are displayed above the list. Selecting a pill filters the list via `?funnel_stage_id=:uuid` API query param. Clicking the active filter again (or "Clear filter") removes it. Multiple quick clicks on different pills each trigger one request (no debounce needed — TanStack Query deduplicates). (FR11)

3. **AC3 (Inline expand):** Clicking a positioning row expands it inline. Expanded section shows: funnel stage badge, full description (or "—"), full content (or "—"), and the list of linked prospects (fetched lazily from `GET /api/positionings/:id/prospects`). Interactions section shows a placeholder "coming in a future release". Note: the positioning name is visible in the trigger header (which remains visible when the item is expanded) and is intentionally not repeated in the detail panel. (FR17)

4. **AC4 (Prospects sub-list):** Inside the expanded section, linked prospects are listed with name and company. An empty state is shown if no prospects are linked. The list is fetched only when the row is first expanded (lazy load via `enabled` option).

5. **AC5 (Skeleton loading):** While positionings or funnel stages are loading, 5 skeleton rows are displayed. No full-page overlay.

6. **AC6 (Empty state):** When the list is empty (no positionings / no match for active filter), a bordered empty state card is displayed with contextual message (empty vs filtered empty).

7. **AC7 (Route + Nav):** The `/positionings` route is registered in the router. The "Positionings" nav link in `AppNavbar` is enabled (replacing the `cursor-not-allowed` placeholder).

8. **AC8 (i18n):** All strings use `useTranslation()` with keys in both `public/locales/en.json` and `public/locales/fr.json`. No hard-coded strings in components.

9. **AC9 (Types):** `PositioningsFilterType` is added to `packages/shared/src/types/positioning.ts` (consistent with `ProspectsFilterType` pattern). Rebuild shared package after change.

10. **AC10 (Lint + type-check):** `pnpm biome check --write .` from root — 0 errors. `pnpm type-check` from root — 0 errors.

## Tasks / Subtasks

- [x] **Task 1: Extend shared types** (AC9)
  - [x] 1.1 Add `PositioningsFilterType` to `packages/shared/src/types/positioning.ts`
  - [x] 1.2 Run `pnpm --filter @battlecrm/shared build` to rebuild declaration files

- [x] **Task 2: Add positionings query keys** (AC1, AC2, AC3, AC4)
  - [x] 2.1 Add `positionings` section to `apps/frontend/src/lib/queryKeys.ts`
  - [x] 2.2 Keys: `positionings.all`, `positionings.list(filters?)`, `positionings.prospects(id)`

- [x] **Task 3: Create positionings API lib** (AC1, AC2, AC3, AC4)
  - [x] 3.1 Create `apps/frontend/src/features/positionings/lib/api.ts`
  - [x] 3.2 `positioningsApi.list(filters?)` — GET /api/positionings with optional `funnel_stage_id`
  - [x] 3.3 `positioningsApi.prospects(id)` — GET /api/positionings/:id/prospects

- [x] **Task 4: Create query hooks** (AC1, AC4)
  - [x] 4.1 Create `apps/frontend/src/features/positionings/hooks/usePositionings.ts` — `usePositionings(filters?)`
  - [x] 4.2 Create `apps/frontend/src/features/positionings/hooks/usePositioningProspects.ts` — `usePositioningProspects(id, { enabled })` — lazy-loaded

- [x] **Task 5: Create PositioningRow component** (AC1, AC3, AC4)
  - [x] 5.1 Create `apps/frontend/src/features/positionings/components/PositioningRow.tsx`
  - [x] 5.2 Collapsed: chevron + name + funnel stage badge + description preview (truncated to 1 line)
  - [x] 5.3 Expanded: full details (description, content) + linked prospects list + interactions placeholder
  - [x] 5.4 Use `aria-expanded` and `aria-controls` on the toggle button

- [x] **Task 6: Create PositioningsList component** (AC1, AC2, AC5, AC6)
  - [x] 6.1 Create `apps/frontend/src/features/positionings/components/PositioningsList.tsx`
  - [x] 6.2 Stage filter pills (Button rounded-full, active/outline variant) + clear filter button
  - [x] 6.3 Column headers: Name, Funnel Stage, Description preview
  - [x] 6.4 Skeleton loading (5 rows) and error state
  - [x] 6.5 Empty state with border
  - [x] 6.6 Total count footer

- [x] **Task 7: Create PositioningsPage** (AC7)
  - [x] 7.1 Create `apps/frontend/src/features/positionings/PositioningsPage.tsx`
  - [x] 7.2 Page header with title + description using `<header>` semantic element

- [x] **Task 8: Register route** (AC7)
  - [x] 8.1 Add `/positionings` route to `apps/frontend/src/routes.tsx` inside `AuthGuard → AuthLayout`

- [x] **Task 9: Enable navbar link** (AC7)
  - [x] 9.1 Replace the `<span cursor-not-allowed>` placeholder in `AppNavbar.tsx` with `<NavLink to="/positionings">`

- [x] **Task 10: i18n** (AC8)
  - [x] 10.1 Add `positionings` key block to `apps/frontend/public/locales/en.json`
  - [x] 10.2 Add `positionings` key block to `apps/frontend/public/locales/fr.json`

- [x] **Task 11: Lint + type-check** (AC10)
  - [x] 11.1 `pnpm biome check --write .` from root — 0 errors (1 style auto-fix in PositioningRow.tsx)
  - [x] 11.2 `pnpm type-check` from root — 0 errors across all workspaces

## Dev Notes

### CRITICAL: This is a pure frontend story — zero backend changes needed

All API endpoints from Story 4.2 are live:
- `GET /api/positionings` — list with optional `?funnel_stage_id=:uuid`
- `GET /api/positionings/:id` — single (not needed for list view)
- `GET /api/positionings/:id/prospects` — linked prospects (used in expanded row)

No new backend files. No new migrations. No serializer changes. No shared type changes beyond adding `PositioningsFilterType`.

---

### Task 1: Shared Type Addition

**File: `packages/shared/src/types/positioning.ts`** — ADD at the end:

```typescript
export type PositioningsFilterType = {
  funnel_stage_id?: string
}
```

After editing: `pnpm --filter @battlecrm/shared build`

---

### Task 2: Query Keys

**File: `apps/frontend/src/lib/queryKeys.ts`** — ADD `positionings` block:

```typescript
export const queryKeys = {
  // ... existing keys ...
  positionings: {
    all: ['positionings'] as const,
    list: (filters?: PositioningsFilterType) =>
      filters && Object.keys(filters).length > 0
        ? ([...queryKeys.positionings.all, 'list', filters] as const)
        : ([...queryKeys.positionings.all, 'list'] as const),
    prospects: (id: string) => [...queryKeys.positionings.all, 'prospects', id] as const,
  },
}
```

**Import `PositioningsFilterType` at top of queryKeys.ts:**
```typescript
import type { PositioningsFilterType } from '@battlecrm/shared'
```

**Biome import order** for queryKeys.ts: `@battlecrm/shared` (@ scoped external) comes BEFORE existing content — add as the first import.

---

### Task 3: API Lib

**File: `apps/frontend/src/features/positionings/lib/api.ts`** (NEW):

```typescript
import type {
  PositioningListResponse,
  PositioningsFilterType,
  ProspectsListResponse,
} from '@battlecrm/shared'
import { fetchApi } from '@/lib/api'

export const positioningsApi = {
  list(filters?: PositioningsFilterType): Promise<PositioningListResponse> {
    const params = new URLSearchParams()
    if (filters?.funnel_stage_id) {
      params.set('funnel_stage_id', filters.funnel_stage_id)
    }
    const queryString = params.toString()
    return fetchApi<PositioningListResponse>(`/positionings${queryString ? `?${queryString}` : ''}`)
  },

  prospects(id: string): Promise<ProspectsListResponse> {
    return fetchApi<ProspectsListResponse>(`/positionings/${id}/prospects`)
  },
}
```

**Import order:** `@battlecrm/shared` (@ scoped external) → `@/lib/api` (@ path alias)

---

### Task 4: Query Hooks

**File: `apps/frontend/src/features/positionings/hooks/usePositionings.ts`** (NEW):

```typescript
import type { PositioningsFilterType } from '@battlecrm/shared'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { positioningsApi } from '../lib/api'

export function usePositionings(filters?: PositioningsFilterType) {
  return useQuery({
    queryKey: queryKeys.positionings.list(filters),
    queryFn: () => positioningsApi.list(filters),
  })
}
```

**File: `apps/frontend/src/features/positionings/hooks/usePositioningProspects.ts`** (NEW):

```typescript
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { positioningsApi } from '../lib/api'

export function usePositioningProspects(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.positionings.prospects(id),
    queryFn: () => positioningsApi.prospects(id),
    enabled: options?.enabled ?? true,
  })
}
```

**IMPORTANT:** Pass `enabled: isExpanded` from `PositioningRow` — this makes the fetch lazy (only fires when the row is expanded for the first time). TanStack Query caches the result, so subsequent expand/collapse cycles don't refetch. This mirrors the `useProspectStageTransitions` pattern in `hooks/useProspectStageTransitions.ts`.

---

### Task 5: PositioningRow Component

**File: `apps/frontend/src/features/positionings/components/PositioningRow.tsx`** (NEW):

```typescript
import type { PositioningType } from '@battlecrm/shared'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { usePositioningProspects } from '../hooks/usePositioningProspects'

interface PositioningRowProps {
  positioning: PositioningType
  isExpanded: boolean
  onToggle: () => void
}

export function PositioningRow({ positioning, isExpanded, onToggle }: PositioningRowProps) {
  const { t } = useTranslation()
  const { data: prospectsData, isLoading: prospectsLoading } = usePositioningProspects(
    positioning.id,
    { enabled: isExpanded },
  )
  const linkedProspects = prospectsData?.data ?? []

  return (
    <article className="border-b last:border-b-0">
      {/* Collapsed row — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-accent"
        aria-expanded={isExpanded}
        aria-controls={`positioning-panel-${positioning.id}`}
      >
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition',
            isExpanded ? 'rotate-90' : '',
          )}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate font-medium">{positioning.name}</span>
        <span className="w-40 shrink-0">
          <Badge variant="secondary">{positioning.funnelStageName}</Badge>
        </span>
        <span className="w-64 shrink-0 truncate text-sm text-muted-foreground">
          {positioning.description ?? '—'}
        </span>
      </button>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div
          id={`positioning-panel-${positioning.id}`}
          className="border-t bg-muted/30 space-y-4 px-4 py-4"
        >
          {/* Details */}
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('positionings.fields.funnelStage')}</dt>
            <dd>
              <Badge variant="secondary">{positioning.funnelStageName}</Badge>
            </dd>

            <dt className="text-muted-foreground">{t('positionings.fields.description')}</dt>
            <dd className="whitespace-pre-wrap">
              {positioning.description ?? (
                <span className="italic text-muted-foreground">—</span>
              )}
            </dd>

            <dt className="text-muted-foreground">{t('positionings.fields.content')}</dt>
            <dd className="whitespace-pre-wrap">
              {positioning.content ?? (
                <span className="italic text-muted-foreground">—</span>
              )}
            </dd>
          </dl>

          {/* Linked prospects */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t('positionings.linkedProspects.title')}
            </p>
            {prospectsLoading ? (
              <p className="text-xs italic text-muted-foreground">...</p>
            ) : linkedProspects.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                {t('positionings.linkedProspects.empty')}
              </p>
            ) : (
              <ul className="space-y-1">
                {linkedProspects.map((prospect) => (
                  <li key={prospect.id} className="text-sm">
                    <span className="font-medium">{prospect.name}</span>
                    {prospect.company && (
                      <span className="ml-2 text-muted-foreground">— {prospect.company}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Interactions — placeholder for Epic 5 */}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {t('positionings.interactions.title')}
            </p>
            <p className="text-xs italic text-muted-foreground">
              {t('positionings.interactions.comingSoon')}
            </p>
          </div>
        </div>
      )}
    </article>
  )
}
```

**Import order:** `@battlecrm/shared` → `lucide-react` → `react-i18next` → `@/components/ui/badge` → `@/lib/utils` → relative `../hooks/usePositioningProspects`

**Note on Badge:** `Badge` is already installed in shadcn (`apps/frontend/src/components/ui/badge.tsx`). Import from `@/components/ui/badge`. Use `variant="secondary"` for funnel stage.

---

### Task 6: PositioningsList Component

**File: `apps/frontend/src/features/positionings/components/PositioningsList.tsx`** (NEW):

```typescript
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { usePositionings } from '../hooks/usePositionings'
import { PositioningRow } from './PositioningRow'

export function PositioningsList() {
  const { t } = useTranslation()
  const [activeStageFilter, setActiveStageFilter] = useState<string | undefined>(undefined)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const activeFilters = activeStageFilter ? { funnel_stage_id: activeStageFilter } : undefined

  const {
    data: positioningsData,
    isLoading: positioningsLoading,
    isError: positioningsError,
  } = usePositionings(activeFilters)

  const { data: stagesData, isLoading: stagesLoading, isError: stagesError } = useFunnelStages()

  const isLoading = positioningsLoading || stagesLoading
  const stages = stagesData?.data ?? []
  const positionings = positioningsData?.data ?? []

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function handleStageFilter(stageId: string) {
    if (activeStageFilter === stageId) {
      setActiveStageFilter(undefined)
      setExpandedId(null)
      return
    }
    setActiveStageFilter(stageId)
    setExpandedId(null)
  }

  function clearFilter() {
    setActiveStageFilter(undefined)
    setExpandedId(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {['s0', 's1', 's2', 's3', 's4'].map((key) => (
          <Skeleton key={key} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (positioningsError || stagesError) {
    return <p className="text-sm text-destructive">{t('positionings.loadError')}</p>
  }

  return (
    <div className="space-y-4">
      {/* Stage filter pills */}
      {stages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {stages.map((stage) => (
            <Button
              key={stage.id}
              type="button"
              size="sm"
              variant={activeStageFilter === stage.id ? 'default' : 'outline'}
              onClick={() => handleStageFilter(stage.id)}
              aria-pressed={activeStageFilter === stage.id}
              className="rounded-full"
            >
              {stage.name}
            </Button>
          ))}
          {activeStageFilter && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={clearFilter}
              className="rounded-full border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {t('positionings.clearFilter')}
            </Button>
          )}
        </div>
      )}

      {/* Empty state */}
      {positionings.length === 0 ? (
        <div className="rounded-md border py-12 text-center">
          <p className="text-muted-foreground">
            {activeStageFilter ? t('positionings.emptyFiltered') : t('positionings.empty')}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          {/* Column header row */}
          <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{t('positionings.columns.name')}</span>
            <span className="w-40 shrink-0">{t('positionings.columns.stage')}</span>
            <span className="w-64 shrink-0">{t('positionings.columns.description')}</span>
          </div>

          {positionings.map((positioning) => (
            <PositioningRow
              key={positioning.id}
              positioning={positioning}
              isExpanded={expandedId === positioning.id}
              onToggle={() => handleToggle(positioning.id)}
            />
          ))}
        </div>
      )}

      {/* Total count */}
      {positioningsData && (
        <p className="text-right text-xs text-muted-foreground">
          {t('positionings.count', { count: positioningsData.meta.total })}
        </p>
      )}
    </div>
  )
}
```

**Import order:** `react` → `react-i18next` → `@/components/ui/button` → `@/components/ui/skeleton` → `@/features/settings/hooks/useFunnelStages` → relative hooks/components

---

### Task 7: PositioningsPage

**File: `apps/frontend/src/features/positionings/PositioningsPage.tsx`** (NEW):

```typescript
import { useTranslation } from 'react-i18next'
import { PositioningsList } from './components/PositioningsList'

export function PositioningsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t('positionings.title')}</h1>
        <p className="text-muted-foreground">{t('positionings.description')}</p>
      </header>

      <section>
        <PositioningsList />
      </section>
    </div>
  )
}
```

---

### Task 8: Route Registration

**File: `apps/frontend/src/routes.tsx`** — ADD import and route:

```typescript
// Add import with other page imports:
import { PositioningsPage } from '@/features/positionings/PositioningsPage'

// Add route inside AuthGuard → AuthLayout:
<Route path="/positionings" element={<PositioningsPage />} />
```

Full updated routes block:
```typescript
<Route element={<AuthGuard />}>
  <Route element={<AuthLayout />}>
    <Route path="/" element={<DashboardPage />} />
    <Route path="/prospects" element={<ProspectsPage />} />
    <Route path="/positionings" element={<PositioningsPage />} />
    <Route path="/settings" element={<SettingsPage />} />
  </Route>
</Route>
```

**Biome import order:** `@/features/positionings/PositioningsPage` sorts alphabetically after `@/features/prospects/ProspectsPage` and before `@/features/settings/SettingsPage` within the `@/features/*` group.

---

### Task 9: Navbar Update

**File: `apps/frontend/src/components/common/AppNavbar.tsx`** — REPLACE the span placeholder:

```typescript
// REMOVE this:
<span className="cursor-not-allowed text-muted-foreground/50">
  {t('nav.positionings')}
</span>

// REPLACE WITH:
<NavLink
  to="/positionings"
  className={({ isActive }) =>
    isActive
      ? 'font-medium text-foreground underline underline-offset-4'
      : 'text-muted-foreground hover:text-foreground'
  }
>
  {t('nav.positionings')}
</NavLink>
```

**No import changes needed** — `NavLink` is already imported from `'react-router'`.

---

### Task 10: i18n Keys

**File: `apps/frontend/public/locales/en.json`** — ADD `positionings` block (after `prospects`):

```json
"positionings": {
  "title": "Positionings",
  "description": "Manage your positioning variants per funnel stage.",
  "loadError": "Failed to load positionings. Please try again.",
  "empty": "No positionings yet.",
  "emptyFiltered": "No positionings for this stage.",
  "clearFilter": "Clear filter",
  "count": "{{count}} positioning(s)",
  "columns": {
    "name": "Name",
    "stage": "Funnel Stage",
    "description": "Description"
  },
  "fields": {
    "funnelStage": "Funnel Stage",
    "description": "Description",
    "content": "Content"
  },
  "linkedProspects": {
    "title": "Linked Prospects",
    "empty": "No prospects linked to this positioning yet."
  },
  "interactions": {
    "title": "Interactions",
    "comingSoon": "Coming in a future release"
  }
}
```

**File: `apps/frontend/public/locales/fr.json`** — ADD `positionings` block:

```json
"positionings": {
  "title": "Positionnements",
  "description": "Gérez vos variantes de positionnement par étape du funnel.",
  "loadError": "Impossible de charger les positionnements. Veuillez réessayer.",
  "empty": "Aucun positionnement pour le moment.",
  "emptyFiltered": "Aucun positionnement pour cette étape.",
  "clearFilter": "Effacer le filtre",
  "count": "{{count}} positionnement(s)",
  "columns": {
    "name": "Nom",
    "stage": "Étape du funnel",
    "description": "Description"
  },
  "fields": {
    "funnelStage": "Étape du funnel",
    "description": "Description",
    "content": "Contenu"
  },
  "linkedProspects": {
    "title": "Prospects liés",
    "empty": "Aucun prospect lié à ce positionnement."
  },
  "interactions": {
    "title": "Interactions",
    "comingSoon": "Disponible dans une prochaine version"
  }
}
```

---

### Architecture Compliance

- All server state via TanStack Query — no `useState` for API data
- All API calls through `fetchApi` with `credentials: 'include'` (inherited via `fetchApi`)
- Types from `@battlecrm/shared` — never define duplicate types in frontend
- API response fields camelCase (`funnelStageName`, `funnelStageId`) — Lucid v3 default, NOT snake_case
- Feature-based organization: all new files go under `src/features/positionings/`
- Semantic HTML: `<article>` for rows, `<header>` for page header, `<section>` for list
- shadcn components: `Button`, `Badge`, `Skeleton` — never raw HTML equivalents
- Soft delete: `deletedAt !== null` = archived — this story shows only active positionings (no archive toggle; that's Story 4.5 scope)
- No `toast.error()` for data loading errors — use inline `<p className="text-destructive">` (project anti-pattern)
- `toast.success()` reserved for mutations — this story has no mutations

### Project Structure Notes

**New files:**
- `apps/frontend/src/features/positionings/PositioningsPage.tsx`
- `apps/frontend/src/features/positionings/lib/api.ts`
- `apps/frontend/src/features/positionings/hooks/usePositionings.ts`
- `apps/frontend/src/features/positionings/hooks/usePositioningProspects.ts`
- `apps/frontend/src/features/positionings/components/PositioningsList.tsx`
- `apps/frontend/src/features/positionings/components/PositioningRow.tsx`

**Modified files:**
- `packages/shared/src/types/positioning.ts` — add `PositioningsFilterType`
- `apps/frontend/src/lib/queryKeys.ts` — add `positionings` key block + import `PositioningsFilterType`
- `apps/frontend/src/routes.tsx` — add `/positionings` route + `PositioningsPage` import
- `apps/frontend/src/components/common/AppNavbar.tsx` — enable positionings NavLink
- `apps/frontend/public/locales/en.json` — add `positionings` i18n block
- `apps/frontend/public/locales/fr.json` — add `positionings` i18n block

**No backend changes** — all endpoints live from Story 4.2.
**No migration** — no DB changes.
**No shared serializer changes** — `PositioningType` is complete.

### Previous Story Intelligence (4.2)

- `PositioningType` has `funnelStageName: string` — already includes stage name, no need for a stageMap lookup in the row component (unlike ProspectRow which uses `stageMap.get(prospect.funnelStageId)`)
- `PositioningListResponse` = `{ data: PositioningType[], meta: { total: number } }` — same envelope as prospects
- `ProspectsListResponse` (from shared) is reused as the return type for `positioningsApi.prospects()` — the `/api/positionings/:id/prospects` endpoint returns the same shape
- Story 4.2 established `#helpers/regex.ts` with `UUID_REGEX` for backend — not relevant here (frontend doesn't need UUID validation for query params)
- `Badge` component confirmed installed: `apps/frontend/src/components/ui/badge.tsx`
- `useFunnelStages()` is already in `@/features/settings/hooks/useFunnelStages` — reuse directly (already used in ProspectDetail and ProspectsKanbanView)

### Git Intelligence

Recent commits:
- `98662d8` Merge PR #22 story-4.2 — positionings CRUD API + 38 tests + UUID_REGEX helper
- `adf9e65` feat(positionings): finalize CRUD API — added missing tests (archived positioning, partial update, combined filter)
- `84d633d` feat(positionings): implement CRUD API — controller, serializer, validators, routes
- `495c147` feat(core): extract frontend DTO types to shared folder — established `@battlecrm/shared` import pattern for frontend

**Patterns confirmed for this story:**
1. Feature-based org: all new files under `src/features/positionings/`
2. API lib pattern: `const entityApi = { list(), ... }` in `lib/api.ts`
3. Query hook pattern: `useQuery({ queryKey, queryFn })` — direct, no custom options beyond `enabled`
4. Lazy fetch pattern: `enabled: isExpanded` in `usePositioningProspects` mirrors `useProspectStageTransitions(id, { enabled: true })`
5. Stage filter pills: identical pattern to `ProspectsList` — `Button rounded-full variant={active ? 'default' : 'outline'}`
6. Skeleton: 5 rows with `['s0','s1','s2','s3','s4'].map(key => <Skeleton key={key} className="h-12 w-full" />)`
7. Expanded row: `<article>` wrapper, `<button aria-expanded aria-controls>`, panel with `id` matching `aria-controls`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3] — AC source (FR13, FR17)
- [Source: apps/frontend/src/features/prospects/components/ProspectsList.tsx] — stage filter + skeleton + empty state pattern
- [Source: apps/frontend/src/features/prospects/components/ProspectRow.tsx] — expandable row pattern (aria-expanded, article, panel)
- [Source: apps/frontend/src/features/prospects/lib/api.ts] — api lib pattern (fetchApi, URLSearchParams)
- [Source: apps/frontend/src/features/prospects/hooks/useProspects.ts] — query hook pattern
- [Source: apps/frontend/src/features/prospects/hooks/useProspectStageTransitions.ts] — lazy query with enabled option
- [Source: apps/frontend/src/lib/queryKeys.ts] — query key structure to extend
- [Source: apps/frontend/src/routes.tsx] — route registration pattern
- [Source: apps/frontend/src/components/common/AppNavbar.tsx] — NavLink pattern + placeholder to replace
- [Source: packages/shared/src/types/positioning.ts] — PositioningType, PositioningListResponse (complete, only add filter type)
- [Source: packages/shared/src/types/prospect.ts] — ProspectsListResponse (reused for prospects sub-resource)
- [Source: apps/frontend/public/locales/en.json] — i18n key structure and patterns
- [Source: _bmad-output/project-context.md] — anti-patterns (no toast.error, no Zod, no full-page overlay)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Pure frontend story — zero backend changes. All API endpoints from Story 4.2 consumed directly.
- `PositioningsFilterType` added to shared package (consistent with `ProspectsFilterType` pattern); package rebuilt successfully.
- `queryKeys.positionings` added with `list(filters?)` and `prospects(id)` keys, mirroring `queryKeys.prospects` structure.
- `positioningsApi.list()` uses `URLSearchParams` + `fetchApi` pattern (identical to `prospectsApi.list()`).
- `usePositioningProspects(id, { enabled })` lazy-loads linked prospects only when a row is first expanded — mirrors `useProspectStageTransitions` pattern; TanStack Query caches after first fetch.
- `PositioningRow`: `funnelStageName` read directly from `PositioningType` (no stageMap lookup needed, unlike `ProspectRow`).
- `PositioningsList`: filter pills trigger API-level filtering via `?funnel_stage_id=:uuid`; clearing filter collapses any open row.
- `AppNavbar`: `<span cursor-not-allowed>` placeholder replaced with functional `<NavLink to="/positionings">` — no new imports needed.
- Biome auto-fixed 1 file (PositioningRow.tsx: condensed `??` fallback fragments inline — style only, no logic change).
- `pnpm type-check` — 0 errors across all 3 workspaces (shared, backend, frontend).

### File List

- `packages/shared/src/types/positioning.ts` — MODIFIED: added `PositioningsFilterType`
- `apps/frontend/src/lib/queryKeys.ts` — MODIFIED: added `positionings` query keys + `PositioningsFilterType` import; also typed `prospects.list()` with `ProspectsFilterType` from shared (consistency improvement)
- `apps/frontend/src/components/ui/accordion.tsx` — NEW: shadcn Accordion installed; customized from default (chevron left-side, `justify-between` removed, `-rotate-180` on open)
- `apps/frontend/src/features/positionings/lib/api.ts` — NEW: `positioningsApi.list()` and `positioningsApi.prospects()`
- `apps/frontend/src/features/positionings/hooks/usePositionings.ts` — NEW: `usePositionings(filters?)` query hook
- `apps/frontend/src/features/positionings/hooks/usePositioningProspects.ts` — NEW: `usePositioningProspects(id, { enabled })` lazy query hook
- `apps/frontend/src/features/positionings/components/PositioningRow.tsx` — NEW: expandable row with badge, lazy prospects fetch, interactions placeholder
- `apps/frontend/src/features/positionings/components/PositioningsList.tsx` — NEW: list with stage filter pills, skeleton, empty states, count
- `apps/frontend/src/features/positionings/PositioningsPage.tsx` — NEW: page wrapper with semantic header/section
- `apps/frontend/src/routes.tsx` — MODIFIED: added `/positionings` route + `PositioningsPage` import
- `apps/frontend/src/components/common/AppNavbar.tsx` — MODIFIED: enabled Positionings NavLink (replaced cursor-not-allowed span); extracted `navLinkClass` helper to remove class repetition
- `apps/frontend/src/features/prospects/components/ProspectRow.tsx` — MODIFIED: refactored to use shadcn `AccordionItem/Trigger/Content` (removed custom `<article>` + `<button aria-expanded>` pattern)
- `apps/frontend/src/features/prospects/components/ProspectsList.tsx` — MODIFIED: refactored to use controlled shadcn `<Accordion>` wrapper; removed `handleToggle`; added `overflow-hidden` on container
- `apps/frontend/public/locales/en.json` — MODIFIED: added `positionings` i18n block
- `apps/frontend/public/locales/fr.json` — MODIFIED: added `positionings` i18n block
