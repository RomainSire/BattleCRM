# Story 3.3: Build Prospects List View

Status: done

<!-- Ultimate Context Engine Analysis: 2026-02-28 -->
<!-- Epic 3: Prospect Management — first frontend story of the epic -->

## Story

As a user,
I want to see all my prospects in a list with key information visible,
so that I can quickly scan and find the prospects I need.

## Acceptance Criteria

1. **AC1 (List display):** Navigating to `/prospects` shows a list of all active prospects (`deleted_at IS NULL`), sorted by most recently updated by default. Each row shows: name, company, current funnel stage name, email.

2. **AC2 (Stage filter):** Funnel stage filter buttons are displayed (one per stage). Clicking a stage button filters the list to show only prospects in that stage. An active filter shows a "Clear filter" button to reset. Filter uses `?funnel_stage_id=:uuid` query param.

3. **AC3 (Inline expansion):** Clicking a prospect row expands it inline to show full details: company, LinkedIn URL, email, phone, title, notes. Clicking again collapses. Only one row can be expanded at a time.

4. **AC4 (Loading skeleton):** Animated skeleton rows display while prospects or funnel stages are being fetched.

5. **AC5 (Empty state):** When no prospects match the current filter (or there are no prospects at all), a context-appropriate empty state message is shown.

6. **AC6 (Route + Navigation):** `/prospects` route is added to the router inside `AuthGuard`. The "Prospects" nav link in `AppNavbar` becomes a functional `NavLink` pointing to `/prospects`.

7. **AC7 (Lint + type-check):** `pnpm biome check --write .` from root passes with 0 errors. TypeScript strict type-check passes with 0 errors.

**Deferred from this story:**
- Infinite scroll / backend pagination: API returns all prospects at once; personal CRM with small dataset — loading all is acceptable. Track as tech debt if dataset grows.
- Create/edit forms: Story 3.4.
- Archive/restore: Story 3.5.
- Funnel stage change: Story 3.6.
- Interaction timeline in drill-down: Epic 5 (interactions table not yet created). Show placeholder text.

## Tasks / Subtasks

- [x] **Task 1: Scaffold prospects feature API layer** (AC1, AC2)
  - [x] 1.1 Create `apps/frontend/src/features/prospects/lib/api.ts` with `ProspectType`, `ProspectsListResponseType`, `ProspectsFilterType`, and `prospectsApi.list(filters?)`
  - [x] 1.2 Add `queryKeys.prospects` (with `all`, `list(filters?)`, `detail(id)`) to `apps/frontend/src/lib/queryKeys.ts`
  - [x] 1.3 Create `apps/frontend/src/features/prospects/hooks/useProspects.ts` exporting `useProspects(filters?)`

- [x] **Task 2: Create `ProspectRow` component** (AC3)
  - [x] 2.1 Create `apps/frontend/src/features/prospects/components/ProspectRow.tsx`
  - [x] 2.2 Collapsed state: full-width clickable `<button>` showing chevron, name, company, stage name, email
  - [x] 2.3 Expanded state: `<dl>/<dt>/<dd>` pairs showing all non-null optional fields (company, linkedinUrl, email, phone, title, notes) + interactions placeholder text
  - [x] 2.4 `aria-expanded` on the toggle button; `<article>` semantic element for the row

- [x] **Task 3: Create `ProspectsList` component** (AC1, AC2, AC4, AC5)
  - [x] 3.1 Create `apps/frontend/src/features/prospects/components/ProspectsList.tsx`
  - [x] 3.2 Use `useProspects(filters?)` + `useFunnelStages()` hooks; build `stageMap` for O(1) ID → name lookup
  - [x] 3.3 Implement stage filter buttons with `aria-pressed`, active styling, and clear button
  - [x] 3.4 Render skeleton loader (5 rows, `animate-pulse`) when `isLoading`
  - [x] 3.5 Render inline error text `text-destructive` (NOT `toast.error`) when `isError`
  - [x] 3.6 Render empty state with context-appropriate message (filtered vs. completely empty)
  - [x] 3.7 `expandedId` state controls which single row is expanded; collapse on filter change

- [x] **Task 4: Create `ProspectsPage`** (AC6)
  - [x] 4.1 Create `apps/frontend/src/features/prospects/ProspectsPage.tsx` with `<header>` + `<section>` + `<ProspectsList />`

- [x] **Task 5: Wire up routing and navigation** (AC6)
  - [x] 5.1 Add `<Route path="/prospects" element={<ProspectsPage />} />` inside `AuthGuard > AuthLayout` in `apps/frontend/src/routes.tsx`
  - [x] 5.2 Replace the disabled `<span>` for Prospects in `AppNavbar.tsx` with a `<NavLink to="/prospects">` using the same active/inactive class pattern as Dashboard/Settings links

- [x] **Task 6: Add i18n translations** (all ACs)
  - [x] 6.1 Add `prospects.*` keys to `apps/frontend/public/locales/en.json`
  - [x] 6.2 Add `prospects.*` keys to `apps/frontend/public/locales/fr.json`

- [x] **Task 7: Lint and type-check** (AC7)
  - [x] 7.1 `pnpm biome check --write .` from root — 0 errors (3 files auto-formatted)
  - [x] 7.2 `pnpm --filter @battlecrm/frontend type-check` — 0 errors

---

## Dev Notes

### CRITICAL: This Story Is Pure Frontend Read-Only

Story 3.3 is a **pure frontend story — no backend changes, no write operations**. Only 6 new files + 5 file modifications. Deliverables:

1. `features/prospects/lib/api.ts` — type definitions + API call
2. `features/prospects/hooks/useProspects.ts` — TanStack Query hook
3. `features/prospects/components/ProspectRow.tsx` — collapsible row
4. `features/prospects/components/ProspectsList.tsx` — filter + list
5. `features/prospects/ProspectsPage.tsx` — page shell
6. Updated `queryKeys.ts`, `routes.tsx`, `AppNavbar.tsx`, `en.json`, `fr.json`

**Files NOT to touch:** `apps/backend/`, migrations, auth components, settings components (only IMPORT from them).

---

### CRITICAL: API Returns camelCase (NOT snake_case)

⚠️ **Architecture doc says snake_case for JSON API fields — this is WRONG for the actual implementation.**

Lucid v3 serializes camelCase by default. The actual API responses use:
- `funnelStageId` (not `funnel_stage_id`)
- `deletedAt` (not `deleted_at`)
- `userId` (not `user_id`)
- `linkedinUrl` (not `linkedin_url`)
- `positioningId` (not `positioning_id`)
- `createdAt` / `updatedAt`

All frontend TypeScript types **MUST use camelCase** to match actual API. This is a known tracked divergence from Story 3.2.

---

### Task 1.1: API Layer — Complete Implementation

**File: `apps/frontend/src/features/prospects/lib/api.ts`**

```typescript
import { fetchApi } from '../../..' // CHECK: use the same relative path pattern as features/settings/lib/api.ts imports fetchApi

// ⚠️ CRITICAL: All fields are camelCase — Lucid v3 default serialization
export type ProspectType = {
  id: string
  userId: string
  name: string
  company: string | null
  linkedinUrl: string | null
  email: string | null
  phone: string | null
  title: string | null
  notes: string | null
  funnelStageId: string
  positioningId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type ProspectsListResponseType = {
  data: ProspectType[]
  meta: { total: number }
}

// snake_case here because these are URL query params (API spec)
export type ProspectsFilterType = {
  funnel_stage_id?: string
  include_archived?: boolean
}

export const prospectsApi = {
  list(filters?: ProspectsFilterType): Promise<ProspectsListResponseType> {
    const params = new URLSearchParams()
    if (filters?.funnel_stage_id) {
      params.set('funnel_stage_id', filters.funnel_stage_id)
    }
    if (filters?.include_archived) {
      params.set('include_archived', 'true')
    }
    const queryString = params.toString()
    return fetchApi<ProspectsListResponseType>(
      `/api/prospects${queryString ? `?${queryString}` : ''}`,
    )
  },
}
```

**Import path:** Check how `features/settings/lib/api.ts` imports `fetchApi` from `lib/api.ts` — use the exact same relative path pattern. Do NOT invent a new import style.

**Note on `FunnelStageType`:** The `useFunnelStages` hook used in `ProspectsList` returns `FunnelStageType` from `features/settings/lib/api.ts`. That type was written before Story 3.2 added `prospect_count` to the response. If `FunnelStageType` doesn't include `prospectCount: number`, the TypeScript compiler will still work (extra fields are ignored), but you may want to add `prospectCount?: number` to avoid future confusion. This is optional — do NOT block the story on it.

---

### Task 1.2: queryKeys.ts — Add Prospects

**File: `apps/frontend/src/lib/queryKeys.ts`** — ADD prospects key to the export:

```typescript
// Add inside the exported queryKeys object:
prospects: {
  all: ['prospects'] as const,
  list: (filters?: { funnel_stage_id?: string; include_archived?: boolean }) =>
    filters && Object.keys(filters).length > 0
      ? ([...queryKeys.prospects.all, 'list', filters] as const)
      : ([...queryKeys.prospects.all, 'list'] as const),
  detail: (id: string) => [...queryKeys.prospects.all, 'detail', id] as const,
},
```

**Note:** Do not import `ProspectsFilterType` into `queryKeys.ts` — this creates a cross-module dependency. Use the inline type or `Record<string, unknown>` for the filter param type here. The `project-context.md` already documents `queryKeys.prospects.list()` and `queryKeys.prospects.detail(id)` as expected patterns.

---

### Task 1.3: useProspects Hook

**File: `apps/frontend/src/features/prospects/hooks/useProspects.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../../lib/queryKeys'
import { prospectsApi, type ProspectsFilterType } from '../lib/api'

export function useProspects(filters?: ProspectsFilterType) {
  return useQuery({
    queryKey: queryKeys.prospects.list(filters),
    queryFn: () => prospectsApi.list(filters),
  })
}
```

---

### Task 2: ProspectRow — Complete Implementation

**File: `apps/frontend/src/features/prospects/components/ProspectRow.tsx`**

```tsx
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProspectType } from '../lib/api'

interface ProspectRowProps {
  prospect: ProspectType
  stageName: string | undefined
  isExpanded: boolean
  onToggle: () => void
}

export function ProspectRow({ prospect, stageName, isExpanded, onToggle }: ProspectRowProps) {
  const { t } = useTranslation()

  return (
    <article className="border-b last:border-b-0">
      {/* Collapsed row — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-accent"
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{prospect.name}</span>
        <span className="w-40 shrink-0 truncate text-sm text-muted-foreground">
          {prospect.company ?? '—'}
        </span>
        <span className="w-40 shrink-0 truncate text-sm">{stageName ?? '—'}</span>
        <span className="w-48 shrink-0 truncate text-sm text-muted-foreground">
          {prospect.email ?? '—'}
        </span>
      </button>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div className="space-y-2 border-t bg-muted/30 px-4 py-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {prospect.company && (
              <>
                <dt className="text-muted-foreground">{t('prospects.fields.company')}</dt>
                <dd>{prospect.company}</dd>
              </>
            )}
            {prospect.linkedinUrl && (
              <>
                <dt className="text-muted-foreground">{t('prospects.fields.linkedinUrl')}</dt>
                <dd>
                  <a
                    href={prospect.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-primary underline-offset-4 hover:underline"
                  >
                    {prospect.linkedinUrl}
                  </a>
                </dd>
              </>
            )}
            {prospect.email && (
              <>
                <dt className="text-muted-foreground">{t('prospects.fields.email')}</dt>
                <dd>{prospect.email}</dd>
              </>
            )}
            {prospect.phone && (
              <>
                <dt className="text-muted-foreground">{t('prospects.fields.phone')}</dt>
                <dd>{prospect.phone}</dd>
              </>
            )}
            {prospect.title && (
              <>
                <dt className="text-muted-foreground">{t('prospects.fields.title')}</dt>
                <dd>{prospect.title}</dd>
              </>
            )}
            {prospect.notes && (
              <>
                <dt className="text-muted-foreground">{t('prospects.fields.notes')}</dt>
                <dd className="whitespace-pre-wrap">{prospect.notes}</dd>
              </>
            )}
          </dl>
          {/* Interactions — Epic 5 */}
          <p className="mt-4 text-xs italic text-muted-foreground">
            {t('prospects.interactionsComingSoon')}
          </p>
        </div>
      )}
    </article>
  )
}
```

**Key decisions:**
- `<article>` semantic element per UX spec ("article pour cards autonomes")
- `<button type="button">` for accessible keyboard interaction
- `<dl>/<dt>/<dd>` for labeled field pairs (semantic HTML for key-value data)
- Only non-null fields shown in expanded state — no empty `"—"` placeholders in detail panel
- LinkedIn URL: external link with `target="_blank"` + `rel="noopener noreferrer"` (security)
- `ChevronDown`/`ChevronRight` from Lucide (already installed in project)
- `aria-expanded` for screen reader support

---

### Task 3: ProspectsList — Complete Implementation

**File: `apps/frontend/src/features/prospects/components/ProspectsList.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFunnelStages } from '../../settings/hooks/useFunnelStages'
import { useProspects } from '../hooks/useProspects'
import { ProspectRow } from './ProspectRow'

export function ProspectsList() {
  const { t } = useTranslation()
  const [activeStageFilter, setActiveStageFilter] = useState<string | undefined>(undefined)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const {
    data: prospectsData,
    isLoading: prospectsLoading,
    isError: prospectsError,
  } = useProspects(activeStageFilter ? { funnel_stage_id: activeStageFilter } : undefined)

  const { data: stagesData, isLoading: stagesLoading } = useFunnelStages()

  const isLoading = prospectsLoading || stagesLoading
  const stages = stagesData?.data ?? []
  const prospects = prospectsData?.data ?? []

  // O(1) lookup map: funnelStageId -> stage name
  const stageMap = new Map(stages.map((s) => [s.id, s.name]))

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function handleStageFilter(stageId: string) {
    setActiveStageFilter(stageId)
    setExpandedId(null) // collapse on filter change
  }

  function clearFilter() {
    setActiveStageFilter(undefined)
    setExpandedId(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {['s0', 's1', 's2', 's3', 's4'].map((key) => (
          <div key={key} className="h-12 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    )
  }

  if (prospectsError) {
    return <p className="text-sm text-destructive">{t('prospects.loadError')}</p>
  }

  return (
    <div className="space-y-4">
      {/* Funnel stage filter buttons */}
      {stages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {stages.map((stage) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => handleStageFilter(stage.id)}
              aria-pressed={activeStageFilter === stage.id}
              className={
                activeStageFilter === stage.id
                  ? 'rounded-full border border-primary bg-primary px-3 py-1 text-sm font-medium text-primary-foreground'
                  : 'rounded-full border px-3 py-1 text-sm hover:bg-accent'
              }
            >
              {stage.name}
            </button>
          ))}
          {activeStageFilter && (
            <button
              type="button"
              onClick={clearFilter}
              className="rounded-full border border-destructive px-3 py-1 text-sm text-destructive hover:bg-destructive/10"
            >
              {t('prospects.clearFilter')}
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {prospects.length === 0 ? (
        <div className="rounded-md border py-12 text-center">
          <p className="text-muted-foreground">
            {activeStageFilter ? t('prospects.emptyFiltered') : t('prospects.empty')}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          {/* Column header row */}
          <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span className="size-4 shrink-0" aria-hidden="true" /> {/* chevron spacer */}
            <span className="min-w-0 flex-1">{t('prospects.columns.name')}</span>
            <span className="w-40 shrink-0">{t('prospects.columns.company')}</span>
            <span className="w-40 shrink-0">{t('prospects.columns.stage')}</span>
            <span className="w-48 shrink-0">{t('prospects.columns.email')}</span>
          </div>

          {prospects.map((prospect) => (
            <ProspectRow
              key={prospect.id}
              prospect={prospect}
              stageName={stageMap.get(prospect.funnelStageId)}
              isExpanded={expandedId === prospect.id}
              onToggle={() => handleToggle(prospect.id)}
            />
          ))}
        </div>
      )}

      {/* Total count */}
      {prospectsData && (
        <p className="text-right text-xs text-muted-foreground">
          {t('prospects.count', { count: prospectsData.meta.total })}
        </p>
      )}
    </div>
  )
}
```

**Key decisions:**
- Cross-feature import: `useFunnelStages` imported from `features/settings/hooks/useFunnelStages`. Both use `queryKeys.funnelStages.list()` — TanStack Query deduplicates the request (one network call). Safe for MVP; refactoring candidate if a 3rd feature also needs it.
- `stageMap` `Map<string, string>` for O(1) lookup (avoids nested `.find()` in render)
- `expandedId` controlled at this level to enforce single-expanded constraint
- Both queries needed before rendering (`isLoading = prospectsLoading || stagesLoading`) — skeleton shows while either is pending
- Error is shown inline as `text-destructive` — **never `toast.error()`** (project-context.md rule)
- `aria-pressed` on filter buttons for accessibility
- Column header mimics a table header (avoids the full `<table>` complexity for this expandable row use case)

---

### Task 4: ProspectsPage — Complete Implementation

**File: `apps/frontend/src/features/prospects/ProspectsPage.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { ProspectsList } from './components/ProspectsList'

export function ProspectsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t('prospects.title')}</h1>
        <p className="text-muted-foreground">{t('prospects.description')}</p>
      </header>

      <section>
        <ProspectsList />
      </section>
    </div>
  )
}
```

Identical structure to `SettingsPage.tsx` — `<header>` + `<section>`, i18n strings, delegate to feature component.

---

### Task 5: Routes and Navigation — Complete Implementation

**File: `apps/frontend/src/routes.tsx`** — ADD inside the `AuthGuard > AuthLayout` block:

```typescript
// Add import at top:
import { ProspectsPage } from './features/prospects/ProspectsPage'

// Add route inside AuthGuard > AuthLayout block:
<Route path="/prospects" element={<ProspectsPage />} />
```

**File: `apps/frontend/src/components/common/AppNavbar.tsx`** — FIND and REPLACE the disabled prospects span:

```typescript
// REMOVE:
<span className="cursor-not-allowed text-muted-foreground/50">{t('nav.prospects')}</span>

// ADD (match the exact className pattern used for Dashboard/Settings NavLinks):
<NavLink
  to="/prospects"
  className={({ isActive }) =>
    isActive
      ? 'font-medium text-foreground'   // ← verify this matches the active style in AppNavbar
      : 'text-muted-foreground hover:text-foreground'  // ← verify inactive style
  }
>
  {t('nav.prospects')}
</NavLink>
```

⚠️ **IMPORTANT**: Before writing this code, read `AppNavbar.tsx` and copy the EXACT className function used for the Dashboard `NavLink`. Do not invent new class names — match exactly.

---

### Task 6: i18n Translations

**File: `apps/frontend/public/locales/en.json`** — ADD the `prospects` key (alongside existing `funnelStages`, `dashboard`, etc.):

```json
"prospects": {
  "title": "Prospects",
  "description": "Manage your prospecting contacts.",
  "loadError": "Failed to load prospects. Please try again.",
  "empty": "No prospects yet.",
  "emptyFiltered": "No prospects in this stage.",
  "clearFilter": "Clear filter",
  "count": "{{count}} prospect(s)",
  "interactionsComingSoon": "Interaction history coming soon.",
  "columns": {
    "name": "Name",
    "company": "Company",
    "stage": "Funnel Stage",
    "email": "Email"
  },
  "fields": {
    "company": "Company",
    "linkedinUrl": "LinkedIn",
    "email": "Email",
    "phone": "Phone",
    "title": "Title",
    "notes": "Notes"
  }
}
```

**File: `apps/frontend/public/locales/fr.json`** — ADD the `prospects` key:

```json
"prospects": {
  "title": "Prospects",
  "description": "Gérez vos contacts de prospection.",
  "loadError": "Impossible de charger les prospects. Veuillez réessayer.",
  "empty": "Aucun prospect pour le moment.",
  "emptyFiltered": "Aucun prospect dans cette étape.",
  "clearFilter": "Effacer le filtre",
  "count": "{{count}} prospect(s)",
  "interactionsComingSoon": "Historique des interactions à venir.",
  "columns": {
    "name": "Nom",
    "company": "Entreprise",
    "stage": "Étape du funnel",
    "email": "Email"
  },
  "fields": {
    "company": "Entreprise",
    "linkedinUrl": "LinkedIn",
    "email": "Email",
    "phone": "Téléphone",
    "title": "Poste",
    "notes": "Notes"
  }
}
```

---

### Architecture Compliance

| Requirement | Implementation |
|-------------|----------------|
| FR2: View list with inline preview | Collapsed row: name, company, stage name, email |
| FR6: Filter by funnel stage | Stage filter buttons → `?funnel_stage_id=:uuid` query param |
| FR9: Drill-down inline (partial) | Row expand shows all fields; interactions deferred to Epic 5 |
| Feature-based organization | All in `features/prospects/` |
| Semantic HTML | `<article>`, `<header>`, `<section>`, `<dl>/<dt>/<dd>` |
| TanStack Query | `useProspects()` + `useFunnelStages()` |
| Centralized query keys | `queryKeys.prospects.list(filters)` |
| Error handling: inline only | `isError` → `<p className="text-destructive">` — **NO `toast.error()`** |
| Loading: skeleton loader | `animate-pulse` rows while `isLoading` |
| i18n all strings | All user-visible text via `t()` |
| TypeScript strict | `ProspectType`, `ProspectsListResponseType` (Type suffix) |
| No `any` | All types fully specified |

**Known Divergence — camelCase API fields:**
Architecture doc specifies snake_case for JSON API fields, but Lucid v3 serializes camelCase by default. Frontend types use camelCase (`funnelStageId`, `linkedinUrl`, etc.). This is a tracked divergence from Story 3.2 debug log.

**Anti-patterns to avoid per project-context.md:**
- ❌ `toast.error()` for API failures — use inline `text-destructive` text
- ❌ Full-page loading overlay — use skeleton rows
- ❌ Generic `<div>` when semantic element applies — use `<article>`, `<header>`, `<section>`
- ❌ `zod` — use VineJS (not needed in this story; no forms)
- ❌ Hard delete — N/A (read-only story)

---

### Cross-Feature Import Pattern

`ProspectsList` imports `useFunnelStages` from `../../settings/hooks/useFunnelStages`. This is intentional:

**Why safe for MVP:**
- Both features share the `queryKeys.funnelStages.list()` cache key
- TanStack Query deduplicates: if `SettingsPage` and `ProspectsPage` are mounted simultaneously (they won't be in this SPA), only one network request is made
- One-directional dependency: `features/prospects` → `features/settings` (no circular)

**Refactoring candidate:** If interactions, dashboard, or another 3rd feature also needs funnel stages, move the hook to `src/hooks/useFunnelStages.ts` and update both existing usages.

---

### Project Structure Notes

**Files to CREATE:**

```
apps/frontend/
└── src/
    └── features/
        └── prospects/
            ├── ProspectsPage.tsx                # NEW — page shell
            ├── lib/
            │   └── api.ts                      # NEW — ProspectType + prospectsApi.list()
            ├── hooks/
            │   └── useProspects.ts             # NEW — useQuery wrapper with filters
            └── components/
                ├── ProspectsList.tsx            # NEW — filter UI + list container
                └── ProspectRow.tsx             # NEW — collapsible row with detail panel
```

**Files to MODIFY:**

```
apps/frontend/
└── src/
    ├── lib/
    │   └── queryKeys.ts                        # MODIFY — add queryKeys.prospects
    ├── routes.tsx                              # MODIFY — add /prospects route
    ├── components/
    │   └── common/
    │       └── AppNavbar.tsx                  # MODIFY — enable Prospects NavLink
└── public/
    └── locales/
        ├── en.json                            # MODIFY — add prospects.* keys
        └── fr.json                            # MODIFY — add prospects.* keys
```

**Files NOT to touch:**
- `apps/backend/` — no backend changes
- `features/settings/` — only read/import from it (never modify)
- `features/auth/` — no changes
- Any backend models, migrations, or controllers

---

### Previous Story Intelligence (Story 3.2 — done)

**Backend is complete and working. Key facts for this frontend story:**

| Fact | Detail |
|------|--------|
| `GET /api/prospects` response shape | `{ data: ProspectType[], meta: { total: number } }` |
| Default sort | `updated_at DESC` — API already returns in correct order |
| Stage filter | `?funnel_stage_id=:uuid` — validated as UUID by backend |
| Archived filter | `?include_archived=true` — NOT needed for Story 3.3 (deferred to Story 3.5) |
| Response field case | **camelCase**: `funnelStageId`, `linkedinUrl`, `deletedAt`, `userId` |
| Auth | Session cookies, `credentials: 'include'` already in `fetchApi` |
| User isolation | Enforced by backend — frontend just calls API, gets only own data |
| Empty list | Returns `{ data: [], meta: { total: 0 } }` — not an error |
| Backend tests | 89/89 passing — do not break by touching backend files |

**Funnel Stages API (from `useFunnelStages`):**
- `GET /api/funnel_stages` returns `FunnelStageType[]` with `id`, `name`, `position`, `prospectCount` (added in Story 3.2)
- `FunnelStageType` in `features/settings/lib/api.ts` may not yet have `prospectCount: number` — this is fine, TypeScript will still compile (extra fields ignored)
- Funnel stages are sorted by `position ASC` — use that order for filter buttons

---

### Git Intelligence

**Recent commits (for branch/commit naming context):**
```
c291ef6 Merge pull request #13 from RomainSire/story-3.2
f3866b8 feat(prospects): finalize implementation of CRUD API and update status to done
5ab624f feat(prospects): implement prospects API with CRUD operations
```

**Expected branch:** `story-3.3`
**Expected commit scope:** `feat(prospects): build prospects list view`

---

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3: Build Prospects List View — AC1-AC4]
- [Source: _bmad-output/planning-artifacts/epics.md#FR2 — List with inline preview]
- [Source: _bmad-output/planning-artifacts/epics.md#FR6 — Filter by funnel stage]
- [Source: _bmad-output/planning-artifacts/epics.md#FR9 — Drill-down inline]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Table display patterns — row hover, click=expand, actions right]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Dense list layout for "mode guerre"]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accordion/Collapsible for drill-down inline]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Semantic HTML: article, dl, dt, dd]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Empty state: icon + message + CTA]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture — TanStack Query, feature-based structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns — PascalCase components, Type suffix, camelCase functions]
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns — loading skeletons, inline errors, soft delete toggle]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules — no toast.error, skeleton loaders, semantic HTML]
- [Source: _bmad-output/project-context.md#Anti-Patterns — no Zod, no full-page overlay, no hard delete]
- [Source: _bmad-output/implementation-artifacts/3-2-implement-prospects-crud-api.md#Architecture Compliance — camelCase divergence]
- [Source: apps/frontend/src/features/settings/hooks/useFunnelStages.ts — reference hook pattern]
- [Source: apps/frontend/src/features/settings/components/FunnelStageList.tsx — skeleton loader pattern, error state]
- [Source: apps/frontend/src/features/settings/SettingsPage.tsx — page shell pattern]
- [Source: apps/frontend/src/lib/queryKeys.ts — query key factory pattern]
- [Source: apps/frontend/src/lib/api.ts — fetchApi, ApiError, credentials:include]
- [Source: apps/frontend/src/routes.tsx — AuthGuard > AuthLayout route nesting]
- [Source: apps/frontend/src/components/common/AppNavbar.tsx — NavLink active/inactive class pattern]
- [Source: apps/frontend/public/locales/en.json — existing key structure to follow]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Code Review Findings (resolved)

- **[MEDIUM] LinkedIn URL `javascript:` scheme not sanitized** — `ProspectRow.tsx` — Fixed: `href` now only passes `http://`/`https://` URLs; falls back to `#`.
- **[MEDIUM] `useFunnelStages()` error not handled** — `ProspectsList.tsx` — Fixed: destructured `isError: stagesError`; included in combined error check `prospectsError || stagesError`.
- **[MEDIUM] `aria-pressed` buttons didn't toggle** — `ProspectsList.tsx` — Fixed: `handleStageFilter` now calls `clearFilter()` when clicking the already-active stage, matching WAI-ARIA toggle semantics.
- **[LOW] Empty `<dl>` when all optional fields null** — `ProspectRow.tsx` — Fixed: `hasDetails` guard wraps the `<dl>`; panel shows only the interactions placeholder when no fields are set.
- **[LOW] Missing `aria-controls` on accordion button** — `ProspectRow.tsx` — Fixed: button has `aria-controls={prospect-panel-{id}}`; panel div has matching `id`.

### Completion Notes List

- AC1: `GET /api/prospects` list view implemented — name, company, funnel stage name (cross-referenced), email in collapsed row, sorted by `updated_at DESC` (API default).
- AC2: Funnel stage filter buttons rendered from `useFunnelStages()` data; active stage highlighted; `?funnel_stage_id=:uuid` passed to API; "Clear filter" button resets filter and collapses any expanded row.
- AC3: `ProspectRow` expands inline on click — `<dl>/<dt>/<dd>` pairs for all non-null fields; only one row expanded at a time (`expandedId` in parent); interactions placeholder text shown; `aria-expanded` for accessibility.
- AC4: Skeleton loader (5 animated rows) shown while either prospects or funnel stages are loading.
- AC5: Context-appropriate empty state — `prospects.empty` when no prospects at all, `prospects.emptyFiltered` when stage filter active.
- AC6: `/prospects` route added inside `AuthGuard > AuthLayout`; Prospects `NavLink` enabled with `underline underline-offset-4` active style matching existing nav links.
- AC7: `pnpm biome check --write .` → 3 files auto-formatted (import order), 0 errors. `pnpm --filter @battlecrm/frontend type-check` → 0 errors.
- Import alias `@/` used throughout (matches project pattern from `features/settings/lib/api.ts`).
- `fetchApi('/prospects')` — no `/api/` prefix (VITE_API_URL already includes `/api`).
- Biome auto-reordered import in `useProspects.ts`: `type ProspectsFilterType` moved before default export `prospectsApi`.

### File List

**Created:**
- `apps/frontend/src/features/prospects/lib/api.ts`
- `apps/frontend/src/features/prospects/hooks/useProspects.ts`
- `apps/frontend/src/features/prospects/components/ProspectRow.tsx`
- `apps/frontend/src/features/prospects/components/ProspectsList.tsx`
- `apps/frontend/src/features/prospects/ProspectsPage.tsx`

**Modified:**
- `apps/frontend/src/lib/queryKeys.ts` (added `queryKeys.prospects`)
- `apps/frontend/src/routes.tsx` (added `/prospects` route + import)
- `apps/frontend/src/components/common/AppNavbar.tsx` (enabled Prospects NavLink)
- `apps/frontend/public/locales/en.json` (added `prospects.*` keys)
- `apps/frontend/public/locales/fr.json` (added `prospects.*` keys)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (3-3 status: ready-for-dev → in-progress → review)
