# Story 6.7: Implement Performance Matrix Drill-Down

Status: review

## Story

As a user,
I want to drill down from a conversion rate cell in the dashboard to see the underlying prospect data,
so that I can understand the details behind the numbers and identify optimization patterns.

## Acceptance Criteria

1. **Given** I am viewing an expanded Funnel Card / **When** I click on a conversion rate cell (e.g., "47% (22/47)") / **Then** a drill-down dialog opens showing:
   - Title: `[positioning name] — [stage name]`
   - Rate summary at the top: `47% (22/47)` — rate × 100 with numerator/denominator
   - List of prospects who were assigned this positioning at this stage, each showing:
     - Prospect name
     - Outcome badge: `success` → green "Converted", `failed` → red "Failed", `null` → gray "In progress"

2. **Given** I am viewing the drill-down dialog / **When** I click on a prospect / **Then** I navigate to `/prospects` (same pattern as PositioningRow linked prospects — no deep-link to drawer exists)

3. **Given** I want to identify patterns / **When** I view drill-down data / **Then** I can see which prospects converted vs didn't / **And** an empty state is shown when no prospects exist for this cell

## Tasks / Subtasks

- [x] Task 1: Backend — add `funnel_stage_id` filter to `GET /api/positionings/:id/prospects` (AC: #1)
  - [x] 1.1 In `positionings_controller.ts` → `prospects()`: read `request.qs().funnel_stage_id` (optional string)
  - [x] 1.2 If provided, validate it matches `UUID_REGEX`; if invalid → return `response.badRequest({ message: 'Invalid funnel_stage_id format' })`
  - [x] 1.3 Add `.where('funnel_stage_id', funnelStageId)` to the `ProspectPositioning.query()` when param is present
  - [x] 1.4 The filter is **optional** — no param means all stages (backward compatible; `PositioningRow` still works)
  - [x] 1.5 `HttpContext` already provides `request` — add it to the destructured params of `prospects()`

- [x] Task 2: Backend — functional tests for the new filter (AC: #1)
  - [x] 2.1 Add tests to `apps/backend/tests/functional/positionings/api.spec.ts` in the existing `GET /api/positionings/:id/prospects` group:
    - `funnel_stage_id filter returns only prospects at that stage`
    - `funnel_stage_id filter returns empty list when no prospects at that stage`
    - `invalid UUID funnel_stage_id → 400`
    - `missing funnel_stage_id → returns all stages (backward compat)`

- [x] Task 3: Frontend — API function + queryKey + hook (AC: #1)
  - [x] 3.1 In `apps/frontend/src/features/dashboard/lib/api.ts` add `drillDown(positioningId, stageId)` calling `GET /api/positionings/:id/prospects?funnel_stage_id=:stageId` typed as `{ data: PositioningLinkedProspectType[], meta: { total: number } }`
  - [x] 3.2 In `apps/frontend/src/lib/queryKeys.ts`, add `drillDown(positioningId, stageId)` to `analytics`
  - [x] 3.3 Create `apps/frontend/src/features/dashboard/hooks/useDrillDown.ts`

- [x] Task 4: Frontend — DrillDownDialog component (AC: #1, #2, #3)
  - [x] 4.1 Create `apps/frontend/src/features/dashboard/components/DrillDownDialog.tsx`
  - [x] 4.2 Props: `cell: ConversionCellType`, `children: ReactNode`
  - [x] 4.3 Use shadcn `Dialog` with `open` + `onOpenChange` state; pass `enabled: open` to `useDrillDown` (lazy load)
  - [x] 4.4 Dialog title via `t('dashboard.drillDown.title', { name, stage })`
  - [x] 4.5 Rate summary row via `t('dashboard.drillDown.rate', { rate, n, total })`
  - [x] 4.6 `OutcomeBadge` helper: success → green, failed → red, null → outline gray
  - [x] 4.7 Each prospect row: `<Link to="/prospects">` wrapping prospect name
  - [x] 4.8 `DialogTrigger asChild` wrapping `children`
  - [x] 4.9 Loading skeleton + error state + empty state

- [x] Task 5: Frontend — FunnelCard integration (AC: #1)
  - [x] 5.1 In `FunnelCard.tsx`, import `DrillDownDialog`
  - [x] 5.2 Wrap each `<li>` in the conversion rates section with `DrillDownDialog`
  - [x] 5.3 Inner `<button type="button" className="w-full cursor-pointer space-y-1 text-left">` for Biome a11y compliance (same pattern as story 6.6)
  - [x] 5.4 Active battle highlight ring stays on `<li>`, cursor-pointer on button

- [x] Task 6: i18n (AC: #1, #3)
  - [x] 6.1 Added `dashboard.drillDown.*` keys to `en.json`
  - [x] 6.2 Added `dashboard.drillDown.*` keys to `fr.json`

- [x] Task 7: Validation
  - [x] 7.1 52/52 positionings functional tests pass (including 4 new drill-down filter tests)
  - [x] 7.2 `pnpm lint` — Biome clean (0 fixes, 273 files)
  - [x] 7.3 `pnpm type-check` — 0 errors across all workspaces (shared, backend, frontend, extension)

## Dev Notes

### What's already built — DO NOT reinvent

- **`GET /api/positionings/:id/prospects`** already exists and returns `{ data: PositioningLinkedProspectType[], meta: { total: number } }` — just add the optional `?funnel_stage_id` filter. Do NOT create a new endpoint.
- **`PositioningLinkedProspectType`** (from `@battlecrm/shared`) already has everything needed: `id, name, funnelStageId, outcome, createdAt, isActive, deletedAt`. Use this type directly — do NOT use `ProspectType` (which has different fields).
- **`DrillDownDialog` pattern**: follow `BattleDetailDialog.tsx` exactly — `Dialog` + `DialogTrigger asChild` + `children` as trigger. Same lazy-load pattern with `enabled: open`.
- **`Badge` component** is already installed in shadcn. Use `variant="secondary"` + color classes for outcome badges. Do NOT install new dependencies.
- **Navigation pattern**: `<Link to="/prospects">` from `react-router` — same as `PositioningRow.tsx:456`. No drawer deep-link exists; navigating to the list page is the correct approach.
- **`analyticsApi` in dashboard**: already contains `getPerformanceMatrix` and `battlesApi`; add `drillDown` there (not in `positioningsApi` — dashboard feature owns this call).
- **`UUID_REGEX`** already imported in `positionings_controller.ts` from `#helpers/regex` — reuse it for query param validation.

### FunnelCard — cell click pattern

The cell `<li>` in `FunnelCard.tsx` (lines 219–245) currently has NO button/interactive element. To make it clickable:
- Wrap inner content in a `<button type="button" className="w-full text-left">` (consistent with Story 6.6 history item pattern at line 261)
- OR use `role="button" tabIndex={0}` on the `<li>` — but Biome a11y may flag this
- **Recommended**: use inner `<button>` to maintain Biome compliance. The button wraps all cell content (name + rate + progress bar).

```tsx
<DrillDownDialog cell={cell}>
  <li className={`rounded-md ... ${isVariantInActiveBattle(...) ? '...' : ''}`}>
    <button type="button" className="w-full text-left space-y-1">
      {/* name row */}
      {/* progress bar */}
    </button>
  </li>
</DrillDownDialog>
```

Note: the active battle highlight (`isVariantInActiveBattle`) ring stays on the `<li>`, not inside the button.

### Backend filter — implementation in positionings_controller.ts

Current `prospects()` signature (line 180):
```ts
async prospects({ params, response, auth }: HttpContext) {
```

New signature — add `request`:
```ts
async prospects({ params, request, response, auth }: HttpContext) {
  const userId = auth.user!.id
  const funnelStageId = request.qs().funnel_stage_id as string | undefined

  if (funnelStageId !== undefined && !UUID_REGEX.test(funnelStageId)) {
    return response.badRequest({ message: 'Invalid funnel_stage_id format' })
  }

  const positioning = await Positioning.query()
    .withTrashed()
    .withScopes((s) => s.forUser(userId))
    .where('id', params.id)
    .firstOrFail()

  const query = ProspectPositioning.query()
    .withScopes((s) => s.forUser(userId))
    .where('positioning_id', positioning.id)
    .preload('prospect', (q) => q.withTrashed())
    .orderBy('created_at', 'desc')

  if (funnelStageId) {
    query.where('funnel_stage_id', funnelStageId)
  }

  const pps = await query
  return response.ok({ data: pps.map(serializePositioningLinkedProspect), meta: { total: pps.length } })
}
```

### Type mismatch note (pre-existing, do not fix in this story)

`positioningsApi.prospects(id)` in `apps/frontend/src/features/positionings/lib/api.ts` is typed as `Promise<ProspectsListResponse>` (which is `{ data: ProspectType[] }`), but the backend returns `PositioningLinkedProspectType[]`. This is a pre-existing inconsistency that makes `prospect.company` undefined in `PositioningRow` (the `prospect.company &&` guard handles it silently). **Do NOT fix this in Story 6.7** — it's out of scope and would break the existing positionings feature.

For the drill-down, use the correct type `PositioningLinkedProspectType` by adding a properly-typed call directly to `dashboard/lib/api.ts` (separate from `positioningsApi`).

### DrillDownDialog — lazy loading pattern

```tsx
export function DrillDownDialog({ cell, children }: DrillDownDialogProps) {
  const [open, setOpen] = useState(false)
  const { data, isLoading, isError } = useDrillDown(
    cell.positioningId,
    cell.funnelStageId,
    { enabled: open }
  )
  const prospects = data?.data ?? []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('dashboard.drillDown.title', {
              name: cell.positioningName ?? t('dashboard.deletedPositioning'),
              stage: cell.funnelStageName,
            })}
          </DialogTitle>
        </DialogHeader>
        {/* rate summary */}
        <p className="text-sm text-muted-foreground">
          {t('dashboard.drillDown.rate', {
            rate: (cell.rate * 100).toFixed(0),
            n: cell.numerator,
            total: cell.denominator,
          })}
        </p>
        {/* prospect list */}
        {isLoading ? <Skeleton ... /> : isError ? <p>...</p> : prospects.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{t('dashboard.drillDown.noProspects')}</p>
        ) : (
          <ul className="space-y-2">
            {prospects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <Link to="/prospects" className="text-sm font-medium text-primary hover:underline underline-offset-4">
                  {p.name}
                </Link>
                <OutcomeBadge outcome={p.outcome} />
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

### Outcome badge — color tokens

Use shadcn `Badge` with Tailwind color classes. Do NOT use arbitrary hex colors — use semantic tokens:
- `success`: `className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"` with `variant="secondary"` (no border)
- `failed`: `className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"` with `variant="secondary"`
- `null` (in-progress): `variant="outline"` with `className="text-muted-foreground"` — no special color

Alternative: use `Badge variant="outline"` with border colors. Either is fine — pick one and stay consistent.

### queryKeys — add to analytics

```ts
analytics: {
  all: ['analytics'] as const,
  performanceMatrix: () => [...queryKeys.analytics.all, 'performance-matrix'] as const,
  drillDown: (positioningId: string, stageId: string) =>
    [...queryKeys.analytics.all, 'drill-down', positioningId, stageId] as const,
},
```

### No new backend routes or migrations

This story requires NO new routes (extend existing endpoint) and NO new migrations. The `prospect_positionings` table already has `funnel_stage_id` column (added in Epic 5B migration).

### Project Structure Notes

- New files:
  - `apps/frontend/src/features/dashboard/components/DrillDownDialog.tsx`
  - `apps/frontend/src/features/dashboard/hooks/useDrillDown.ts`
- Modified files:
  - `apps/backend/app/controllers/positionings_controller.ts` (add `request` param + `funnel_stage_id` filter)
  - `apps/backend/tests/functional/positionings/api.spec.ts` (new test cases)
  - `apps/frontend/src/lib/queryKeys.ts` (add `drillDown` to analytics)
  - `apps/frontend/src/features/dashboard/lib/api.ts` (add `drillDown` function to `analyticsApi`)
  - `apps/frontend/src/features/dashboard/components/FunnelCard.tsx` (wrap cells with DrillDownDialog)
  - `apps/frontend/public/locales/en.json` + `fr.json` (add `dashboard.drillDown.*` keys)

### References

- Existing `GET /api/positionings/:id/prospects` implementation: [Source: apps/backend/app/controllers/positionings_controller.ts#prospects]
- `PositioningLinkedProspectType`: [Source: packages/shared/src/types/prospect-positioning.ts]
- `BattleDetailDialog` (Dialog + lazy load pattern): [Source: apps/frontend/src/features/dashboard/components/BattleDetailDialog.tsx]
- PositioningRow linked-prospects display (Link + outcome pattern): [Source: apps/frontend/src/features/positionings/components/PositioningRow.tsx:434-473]
- FunnelCard cells section to modify: [Source: apps/frontend/src/features/dashboard/components/FunnelCard.tsx:210-245]
- FunnelCard history item button pattern (a11y): [Source: apps/frontend/src/features/dashboard/components/FunnelCard.tsx:261-274]
- `analyticsApi` to extend: [Source: apps/frontend/src/features/dashboard/lib/api.ts]
- `queryKeys.analytics`: [Source: apps/frontend/src/lib/queryKeys.ts]
- `UUID_REGEX` import: [Source: apps/backend/app/helpers/regex.ts (via #helpers/regex)]
- Existing positionings functional tests: [Source: apps/backend/tests/functional/positionings/api.spec.ts:496-623]
- `useDrillDown` pattern reference: [Source: apps/frontend/src/features/positionings/hooks/usePositioningProspects.ts]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Backend filter uses query chaining on Lucid builder — `query.where('funnel_stage_id', funnelStageId)` called conditionally after building the base query; confirmed Lucid supports this pattern.
- Biome formatter required multi-line `Prospect.create({...})` calls and single-line `<button type="button" className="...">` in JSX — fixed iteratively.

### Completion Notes List

- **Task 1**: `positionings_controller.ts` `prospects()` — added optional `?funnel_stage_id` query param with UUID validation and conditional `.where()` filter. Backward compatible: no param returns all stages.
- **Task 2**: 4 new tests added to `positionings/api.spec.ts`: filter by stage, empty result for unmatched stage, invalid UUID → 400, no param → all stages. All 52 tests pass.
- **Task 3**: `analyticsApi.drillDown()` in `dashboard/lib/api.ts` (properly typed as `PositioningLinkedProspectType[]`); `queryKeys.analytics.drillDown(positioningId, stageId)` added; `useDrillDown` hook created.
- **Task 4**: `DrillDownDialog.tsx` — lazy-loads on open, shows rate summary, outcome badges (green/red/outline), prospect list with `<Link to="/prospects">`, loading/error/empty states.
- **Task 5**: `FunnelCard.tsx` — each cell `<li>` wrapped in `DrillDownDialog` with inner `<button type="button">` for a11y compliance (Biome-safe).
- **Task 6**: `dashboard.drillDown.*` keys added to `en.json` and `fr.json`.
- **Task 7**: `pnpm lint` ✅ (0 fixes), `pnpm type-check` ✅ (0 errors, 4 workspaces), 52/52 functional tests ✅.

### File List

- `apps/backend/app/controllers/positionings_controller.ts` (modified — add `request` param + `funnel_stage_id` optional filter to `prospects()`)
- `apps/backend/tests/functional/positionings/api.spec.ts` (modified — 4 new drill-down filter tests)
- `apps/frontend/src/features/dashboard/lib/api.ts` (modified — `analyticsApi.drillDown()` function)
- `apps/frontend/src/lib/queryKeys.ts` (modified — `analytics.drillDown` query key)
- `apps/frontend/src/features/dashboard/hooks/useDrillDown.ts` (created)
- `apps/frontend/src/features/dashboard/components/DrillDownDialog.tsx` (created)
- `apps/frontend/src/features/dashboard/components/FunnelCard.tsx` (modified — DrillDownDialog integration + inner button a11y)
- `apps/frontend/public/locales/en.json` (modified — `dashboard.drillDown.*` keys)
- `apps/frontend/public/locales/fr.json` (modified — `dashboard.drillDown.*` keys)
- `_bmad-output/implementation-artifacts/6-7-implement-performance-matrix-drill-down.md` (this file)
