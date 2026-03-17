# Story 5.5: Build Interactions Timeline View

Status: review

## Story

As a user,
I want to see a chronological timeline of all my interactions,
so that I can review my prospecting activity over time.

## Acceptance Criteria

1. **AC1 (Interactions Page — Route & Nav):** A `/interactions` route exists, is accessible from the navbar (using existing `nav.interactions` i18n key), and is wrapped in `AuthGuard` + `AuthLayout` like other protected pages.

2. **AC2 (Chronological list):** `InteractionsPage` renders `InteractionsList`. The list calls `GET /api/interactions` and shows interactions ordered by `interaction_date` DESC. Each row displays: formatted date, prospect name, funnel stage (shadcn `Badge`), status icon (✅ positive / ⏳ pending / ❌ negative), notes preview (truncated to ~80 chars).

3. **AC3 (Expand inline):** Clicking an interaction row expands a detail panel inline (same two-`TableRow` fragment pattern used in `ProspectRow` from Story 5.4). The expanded panel shows: full notes (or "—"), positioning name (or `t('interactions.noPositioning')`), date of interaction, and a link to the prospect.

4. **AC4 (Filters):** A filter bar above the list provides: Prospect (select/combobox filtered to the user's prospects), Positioning (select/combobox), Status (select: positive/pending/negative/all), Funnel Stage (select). These params map directly to the backend query params. Filters can be combined and individually cleared. The date range filter is implemented **client-side** (after the full list is fetched) using two date inputs (from/to on `interaction_date`), since the backend API does not expose date range params.

5. **AC5 (Filter clear):** A "Clear filters" button resets all active filters and restores the full interactions list.

6. **AC6 (Empty & error states):** Empty state shows `t('interactions.empty')`. Loading state uses shadcn `Skeleton` rows (not a spinner). Error state shows `t('interactions.loadError')` inline.

7. **AC7 (ProspectDetail interactions section):** The placeholder text on line 507–509 of `ProspectDetail.tsx` (`<p className="text-xs italic text-muted-foreground">{t('prospects.interactions.empty')}</p>`) is replaced with a real interactions list filtered by `prospect.id`. The list is a vertical timeline (per UX spec — NOT a table), showing each interaction as a row with date, status icon, and notes preview. An interaction can be expanded inline to show full details. This component is `ProspectInteractionsTimeline` (separate from the global `InteractionsList` to keep concerns clean).

8. **AC8 (No new backend work):** All required endpoints exist in `InteractionsController`. No backend changes needed for this story.

9. **AC9 (Lint + type-check):** `pnpm biome check --write .` from monorepo root — 0 errors. `pnpm --filter @battlecrm/frontend type-check` — 0 errors.

## Tasks / Subtasks

- [ ] **Task 1: Extend interactions API lib** (AC2, AC4)
  - [ ] 1.1 In `apps/frontend/src/features/interactions/lib/api.ts`, add:
    ```typescript
    list(filters?: InteractionsFilterType): Promise<InteractionListResponse> {
      const params = new URLSearchParams()
      if (filters?.prospect_id) params.set('prospect_id', filters.prospect_id)
      if (filters?.positioning_id) params.set('positioning_id', filters.positioning_id)
      if (filters?.status) params.set('status', filters.status)
      if (filters?.funnel_stage_id) params.set('funnel_stage_id', filters.funnel_stage_id)
      const qs = params.toString()
      return fetchApi<InteractionListResponse>(`/interactions${qs ? `?${qs}` : ''}`)
    }
    ```
  - [ ] 1.2 Import `InteractionListResponse` and `InteractionsFilterType` from `@battlecrm/shared`

- [ ] **Task 2: Create `useInteractions` hook** (AC2, AC4)
  - [ ] 2.1 Create `apps/frontend/src/features/interactions/hooks/useInteractions.ts`:
    ```typescript
    export function useInteractions(filters?: InteractionsFilterType) {
      return useQuery({
        queryKey: queryKeys.interactions.list(filters),
        queryFn: () => interactionsApi.list(filters),
      })
    }
    ```
  - [ ] 2.2 Import `useQuery` from `@tanstack/react-query`, `queryKeys` from `@/lib/queryKeys`, `interactionsApi` from `../lib/api`, `InteractionsFilterType` from `@battlecrm/shared`

- [ ] **Task 3: Create `InteractionsList` component (global page)** (AC2, AC3, AC4, AC5, AC6)
  - [ ] 3.1 Create `apps/frontend/src/features/interactions/components/InteractionsList.tsx`
  - [ ] 3.2 Local state for filters: `prospect_id`, `positioning_id`, `status`, `funnel_stage_id`, `dateFrom`, `dateTo` (all nullable)
  - [ ] 3.3 Pass server-side filters to `useInteractions()`. Apply `dateFrom`/`dateTo` client-side after fetch:
    ```typescript
    const filtered = (data?.data ?? []).filter((i) => {
      const d = new Date(i.interactionDate)
      if (dateFrom && d < new Date(dateFrom)) return false
      if (dateTo && d > new Date(dateTo)) return false
      return true
    })
    ```
  - [ ] 3.4 Filter bar: use shadcn `Select` for status, funnel stage; use existing `useFunnelStages()` for stage options; use `useProspects()` for prospect options; use `usePositionings()` for positioning options
  - [ ] 3.5 Use shadcn `Table/TableHeader/TableBody/TableRow/TableHead/TableCell` (same as ProspectsList)
  - [ ] 3.6 `expandedId` state managed in `InteractionsList` — same pattern as `ProspectsList.expandedId`
  - [ ] 3.7 Each interaction renders as a React fragment of two `<TableRow>` (main row + optional expanded row) — extract as `InteractionRow` component
  - [ ] 3.8 Skeleton loading: render 5 `Skeleton` rows during `isLoading`
  - [ ] 3.9 Error: inline error text, not toast
  - [ ] 3.10 Empty state: render `t('interactions.empty')` when filtered list is empty

- [ ] **Task 4: Create `InteractionRow` component** (AC2, AC3)
  - [ ] 4.1 Create `apps/frontend/src/features/interactions/components/InteractionRow.tsx`
  - [ ] 4.2 Props: `{ interaction: InteractionType, isExpanded: boolean, onToggle: () => void }`
  - [ ] 4.3 Main `<TableRow onClick={onToggle} aria-expanded={isExpanded} className="cursor-pointer">`:
    - Col 1: Chevron icon (rotated 180° when expanded)
    - Col 2: `new Date(interaction.interactionDate).toLocaleDateString()` (locale-aware)
    - Col 3: `interaction.prospectName`
    - Col 4: `<Badge variant="outline">{interaction.prospectFunnelStageName}</Badge>`
    - Col 5: Status icon — `CheckCircle` (green) for positive, `Clock` (yellow) for pending, `XCircle` (red) for negative — from `lucide-react`
    - Col 6: Notes preview — `interaction.notes ? interaction.notes.slice(0, 80) + (interaction.notes.length > 80 ? '…' : '') : '—'`
  - [ ] 4.4 Expanded `<TableRow className="hover:bg-transparent">` with `<TableCell colSpan={6}>` containing:
    - Full notes (`interaction.notes ?? '—'`)
    - Positioning: `interaction.positioningName ?? t('interactions.noPositioning')`
    - Link to prospect (or just prospect name — no dedicated prospect detail page route yet, so just display the name with note)

- [ ] **Task 5: Create `InteractionsPage`** (AC1, AC2)
  - [ ] 5.1 Create `apps/frontend/src/features/interactions/InteractionsPage.tsx`:
    ```tsx
    export function InteractionsPage() {
      const { t } = useTranslation()
      return (
        <div className="space-y-6">
          <header className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{t('interactions.title')}</h1>
            </div>
            <AddInteractionDialog />
          </header>
          <section><InteractionsList /></section>
        </div>
      )
    }
    ```
  - [ ] 5.2 Include `AddInteractionDialog` (no `trigger` prop = default button) so user can log from the page

- [ ] **Task 6: Add route and navbar link** (AC1)
  - [ ] 6.1 In `apps/frontend/src/routes.tsx`, add inside `AuthGuard > AuthLayout`:
    ```tsx
    <Route path="/interactions" element={<InteractionsPage />} />
    ```
    Import `InteractionsPage` from `@/features/interactions/InteractionsPage`
  - [ ] 6.2 In `apps/frontend/src/components/common/AppNavbar.tsx`, add nav link after positionings:
    ```tsx
    <NavLink to="/interactions" className={navLinkClass}>
      {t('nav.interactions')}
    </NavLink>
    ```
    The key `nav.interactions = "Interactions"` already exists in both EN and FR

- [ ] **Task 7: ProspectDetail interactions timeline** (AC7)
  - [ ] 7.1 Create `apps/frontend/src/features/interactions/components/ProspectInteractionsTimeline.tsx`
  - [ ] 7.2 Props: `{ prospectId: string }`
  - [ ] 7.3 Calls `useInteractions({ prospect_id: prospectId })` to fetch
  - [ ] 7.4 Renders a **vertical timeline list** (NOT a table — per UX spec "liste verticale avec indicateur de type, pas de table"):
    ```tsx
    <ul className="space-y-2">
      {interactions.map(i => (
        <li key={i.id} className="flex gap-3 text-sm">
          <StatusIcon status={i.status} className="mt-0.5 size-4 shrink-0" />
          <div>
            <span className="text-muted-foreground text-xs">
              {new Date(i.interactionDate).toLocaleDateString()}
            </span>
            {i.notes && <p className="line-clamp-2">{i.notes}</p>}
            {i.positioningName && (
              <p className="text-xs text-muted-foreground">{i.positioningName}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
    ```
  - [ ] 7.5 Skeleton loader during `isLoading` (3 rows)
  - [ ] 7.6 Empty: `t('prospects.interactions.empty')` (already translates to "No interactions logged yet.")
  - [ ] 7.7 In `ProspectDetail.tsx`, replace lines 507–509 (the `<p className="text-xs italic...">` placeholder) with `<ProspectInteractionsTimeline prospectId={prospect.id} />`
  - [ ] 7.8 Remove the old `t('prospects.interactions.empty')` usage from ProspectDetail (it will now live inside `ProspectInteractionsTimeline`)

- [ ] **Task 8: Add missing i18n keys** (AC2, AC3, AC4)
  - [ ] 8.1 In `apps/frontend/public/locales/en.json`, add under `"interactions"`:
    ```json
    "filters": {
      "allStatuses": "All statuses",
      "allProspects": "All prospects",
      "allPositionings": "All positionings",
      "allStages": "All stages",
      "dateFrom": "From",
      "dateTo": "To",
      "clearFilters": "Clear filters"
    },
    "detail": {
      "positioning": "Positioning",
      "date": "Date"
    }
    ```
  - [ ] 8.2 Mirror identical keys in `apps/frontend/public/locales/fr.json`:
    ```json
    "filters": {
      "allStatuses": "Tous les statuts",
      "allProspects": "Tous les prospects",
      "allPositionings": "Tous les positionnements",
      "allStages": "Toutes les étapes",
      "dateFrom": "Du",
      "dateTo": "Au",
      "clearFilters": "Effacer les filtres"
    },
    "detail": {
      "positioning": "Positionnement",
      "date": "Date"
    }
    ```

- [ ] **Task 9: Lint + type-check** (AC9)
  - [ ] 9.1 `pnpm biome check --write .` from monorepo root — 0 errors
  - [ ] 9.2 `pnpm --filter @battlecrm/frontend type-check` — 0 errors

## Dev Notes

### Architecture Overview

This is a **pure frontend story**. No backend changes required.
- All API endpoints exist: `GET /api/interactions`, `GET /api/interactions/:id`
- The backend already supports filters: `prospect_id`, `positioning_id`, `status`, `funnel_stage_id`
- **Date range filtering is client-side only** — no backend date params exist. Implemented by filtering the fetched array after TanStack Query resolves.

---

### CRITICAL: Two Distinct UI Patterns

Per UX spec (decision from Epic 4 retro, 2026-03-12):

| Location | Component | Pattern |
|---|---|---|
| `/interactions` page | `InteractionsList` + `InteractionRow` | `shadcn Table` (same as ProspectsList/PositioningsList) |
| `ProspectDetail` | `ProspectInteractionsTimeline` | Vertical list with icon markers — **NOT a table** |

The UX spec states: "Composant recommandé : liste verticale avec indicateur de type (icône + couleur), pas de table" for the prospect-scoped view.

---

### Status Icon Pattern

Use consistent icons from `lucide-react` for interaction statuses:

```tsx
// StatusIcon helper — create inline or extract to a small util
function StatusIcon({ status, className }: { status: InteractionStatus; className?: string }) {
  if (status === 'positive') return <CheckCircle className={cn('text-green-500', className)} />
  if (status === 'negative') return <XCircle className={cn('text-red-500', className)} />
  return <Clock className={cn('text-yellow-500', className)} />
}
```

Lucide icons used: `CheckCircle`, `XCircle`, `Clock` — already in the dependency (used throughout the project).

---

### InteractionRow Expand Pattern (same as ProspectRow)

Story 5.4 established the "two-TableRow fragment" pattern for expandable rows. Use the identical approach:

```tsx
export function InteractionRow({ interaction, isExpanded, onToggle }: InteractionRowProps) {
  return (
    <>
      <TableRow onClick={onToggle} aria-expanded={isExpanded} className="cursor-pointer">
        <TableCell className="w-8 pr-0">
          <ChevronDown className={cn('size-4 transition-transform', isExpanded && 'rotate-180')} />
        </TableCell>
        {/* ... other cells */}
      </TableRow>
      {isExpanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={6} className="p-4 bg-muted/30">
            {/* expanded detail */}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
```

`expandedId` state in `InteractionsList` — same pattern as `ProspectsList.expandedId` (only one row open at a time).

---

### Filter State — Local useState (not URL params)

No existing page uses URL search params for filters (ProspectsList, PositioningsList use local state). Keep consistent — use `useState` for all filter values in `InteractionsList`.

```tsx
const [filters, setFilters] = useState<InteractionsFilterType>({})
const [dateFrom, setDateFrom] = useState<string>('')
const [dateTo, setDateTo] = useState<string>('')
```

Pass `filters` (server-side) to `useInteractions(filters)`. Apply `dateFrom`/`dateTo` as client-side post-filter.

---

### Combobox vs Select for Prospect/Positioning Filters

The user may have many prospects. Use shadcn `Command` (combobox pattern) for the prospect filter, NOT a plain `Select` — consistent with `AddInteractionDialog.tsx` which already uses `Command` for prospect selection.

**BUT** — for simplicity in this story, a plain `Select` is acceptable given it's the first version of filters. If `Command` is already understood from `AddInteractionDialog`, prefer it for prospects. For status, funnel stage, and positioning, `Select` is fine.

---

### QueryKeys — Already Exists

`queryKeys.interactions.list(filters)` already defined in `apps/frontend/src/lib/queryKeys.ts` with proper filter-aware cache keys:
```typescript
list: (filters?: InteractionsFilterType) =>
  filters && Object.keys(filters).length > 0
    ? ([...queryKeys.interactions.all, 'list', filters] as const)
    : ([...queryKeys.interactions.all, 'list'] as const),
```

**Important:** The mutation `useCreateInteraction` already calls `queryClient.invalidateQueries({ queryKey: queryKeys.interactions.all })` on success — this will automatically refresh `InteractionsList` and `ProspectInteractionsTimeline` when a new interaction is created. No additional invalidation needed.

---

### i18n — Existing Keys

These translation keys already exist and must be reused:

| Key | EN | FR |
|-----|----|----|
| `interactions.title` | "Interactions" | "Interactions" |
| `interactions.empty` | "No interactions logged yet." | "Aucune interaction enregistrée." |
| `interactions.loadError` | "Failed to load interactions." | "Impossible de charger les interactions." |
| `interactions.status.positive` | "Positive" | "Positive" |
| `interactions.status.pending` | "Pending" | "En attente" |
| `interactions.status.negative` | "Negative" | "Négative" |
| `interactions.noPositioning` | "No positioning" | "Sans positionnement" |
| `interactions.addInteraction` | "Log Interaction" | "Journaliser une interaction" |
| `nav.interactions` | "Interactions" | "Interactions" |
| `prospects.interactions.title` | "Interactions" | "Interactions" |
| `prospects.interactions.empty` | "No interactions logged yet." | "Aucune interaction enregistrée." |

All `filters.*` and `detail.*` keys listed in Task 8 are **new** and must be added to both locale files.

---

### Navbar — No New Route Guard Needed

`AppNavbar.tsx` already renders inside `AuthLayout` (wraps all auth routes). Adding a `<NavLink to="/interactions">` is all that's needed — no guard logic.

Current navbar order: Dashboard → Settings → Prospects → Positionings. Add **Interactions** after Positionings:
```tsx
<NavLink to="/interactions" className={navLinkClass}>
  {t('nav.interactions')}
</NavLink>
```

---

### Existing `AddInteractionDialog` — Unchanged

`AddInteractionDialog.tsx` already works with the `POST /api/interactions` endpoint and invalidates `queryKeys.interactions.all` on success. No modification needed for this story.

**On `InteractionsPage`:** Use `<AddInteractionDialog />` without a `trigger` prop — the component has a default button trigger.

---

### ProspectDetail — Exact Change

Current code (lines 507–509):
```tsx
<p className="text-xs italic text-muted-foreground">
  {t('prospects.interactions.empty')}
</p>
```

Replace with:
```tsx
<ProspectInteractionsTimeline prospectId={prospect.id} />
```

The `{!isArchived && (` guard on line 491 is already in place — the timeline only shows for active prospects. This is correct behavior (archived prospects still have interactions that can be seen on the global `/interactions` page filtered by prospect).

**Wait — should archived prospect interactions be shown?** The backend `GET /api/interactions` preloads `.preload('prospect', (q) => q.withTrashed())` so interactions for archived prospects ARE accessible. However, since ProspectDetail for archived prospects doesn't show the interactions section (the `!isArchived` guard), this is by design. No change needed to the guard.

---

### TypeScript — API Response Typing

The `InteractionType` from `@battlecrm/shared` has:
```typescript
type InteractionType = {
  id: string
  userId: string
  prospectId: string
  prospectName: string
  prospectFunnelStageId: string
  prospectFunnelStageName: string   // ← already includes stage name!
  positioningId: string | null
  positioningName: string | null    // ← already includes positioning name!
  status: InteractionStatus
  notes: string | null
  interactionDate: string           // ISO 8601
  createdAt: string
  updatedAt: string | null
  deletedAt: string | null
}
```

**Key insight:** `prospectFunnelStageName` and `positioningName` are already serialized by `serializeInteraction()` in the backend. No additional API calls or joins needed in the frontend to display stage name and positioning name.

This means `InteractionRow` does NOT need `useFunnelStages()` or `usePositionings()` — just use `interaction.prospectFunnelStageName` and `interaction.positioningName` directly.

---

### Date Formatting

Use `toLocaleDateString()` for display. No date library needed:
```tsx
new Date(interaction.interactionDate).toLocaleDateString()
// → "3/16/2026" (EN) or "16/03/2026" (FR) based on browser locale
```

For date range filter inputs: use `<input type="date" />` (HTML5 native). Value is always `"YYYY-MM-DD"` regardless of locale. Compare with `new Date(interaction.interactionDate)`.

---

### Skeleton Loading Pattern

Use shadcn `Skeleton` (already installed). For table rows:
```tsx
{isLoading && Array.from({ length: 5 }).map((_, i) => (
  <TableRow key={i}>
    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
  </TableRow>
))}
```

---

### Project Structure Notes

**New files:**
```
apps/frontend/src/features/interactions/InteractionsPage.tsx
apps/frontend/src/features/interactions/hooks/useInteractions.ts
apps/frontend/src/features/interactions/components/InteractionsList.tsx
apps/frontend/src/features/interactions/components/InteractionRow.tsx
apps/frontend/src/features/interactions/components/ProspectInteractionsTimeline.tsx
```

**Modified files:**
```
apps/frontend/src/features/interactions/lib/api.ts          (add list() method)
apps/frontend/src/routes.tsx                                 (add /interactions route)
apps/frontend/src/components/common/AppNavbar.tsx            (add nav link)
apps/frontend/src/features/prospects/components/ProspectDetail.tsx  (replace placeholder)
apps/frontend/public/locales/en.json                         (new filter + detail keys)
apps/frontend/public/locales/fr.json                         (new filter + detail keys)
```

**No backend changes. No new shared types.**

---

### References

- [Source: packages/shared/src/types/interaction.ts] — `InteractionType`, `InteractionListResponse`, `InteractionsFilterType`
- [Source: apps/backend/app/controllers/interactions_controller.ts] — Supported filter params: `prospect_id`, `positioning_id`, `status`, `funnel_stage_id`; no date range
- [Source: apps/frontend/src/features/interactions/lib/api.ts] — Current API lib (only `create` method)
- [Source: apps/frontend/src/lib/queryKeys.ts#interactions] — `queryKeys.interactions.list(filters)` already defined
- [Source: apps/frontend/src/features/prospects/components/ProspectRow.tsx] — Two-TableRow fragment pattern for expandable rows
- [Source: apps/frontend/src/features/prospects/components/ProspectsList.tsx] — `expandedId` state pattern
- [Source: apps/frontend/src/features/interactions/components/AddInteractionDialog.tsx] — Combobox pattern for prospect selection, `'none'` sentinel for positioning
- [Source: apps/frontend/src/features/prospects/components/ProspectDetail.tsx:490-511] — Current interactions placeholder (to be replaced in Task 7)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Timeline Unifiée par Prospect] — Decision: vertical list (not table) for per-prospect timeline
- [Source: _bmad-output/planning-artifacts/architecture.md#UI Coherence Principle] — shadcn/ui first, consistent patterns

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
