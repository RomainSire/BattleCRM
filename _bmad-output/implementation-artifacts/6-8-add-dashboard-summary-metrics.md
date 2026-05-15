# Story 6.8: Add Dashboard Summary Metrics

Status: done

## Story

As a user,
I want to see high-level metrics at the top of the Dashboard,
so that I can quickly assess my overall prospecting performance without scrolling through individual funnel cards.

## Acceptance Criteria

1. **Given** I am on the Dashboard / **When** the page loads / **Then** a summary section appears ABOVE the FunnelCards accordion showing:
   - Total active prospects (non-archived)
   - Interactions this week (Monday to now)
   - Interactions this month (1st of month to now)
   - Best performing positioning overall (highest rate among cells with `numerator > 0` and `confidenceLevel !== 'low'`) — shows positioning name + stage name + rate%; shows "—" if no qualifying cell

2. **Given** I am on the Dashboard / **When** the summary loads / **Then** a compact "Funnel Overview" sub-section shows each funnel stage (in order) with its active prospect count and a proportional progress bar (width relative to the stage with the most prospects)

3. **Given** no data exists yet (new user: 0 active prospects, 0 positionings) / **When** I view the Dashboard / **Then** the summary section shows empty-state guidance cards:
   - "Add prospects to get started" → links to `/prospects`
   - "Create positionings to start A/B testing" → links to `/positionings`
   - "Log interactions to see conversion data" (shown when prospects exist but 0 interactions this month)

4. **Given** the summary section is loading / **When** data is not yet available / **Then** skeleton placeholders are shown for all KPI cards

## Tasks / Subtasks

- [x] Task 1: Shared type — `DashboardSummaryType` (AC: #1, #2)
  - [x] 1.1 Create `packages/shared/src/types/dashboard-summary.ts` with:
    ```ts
    export type ProspectsByStageType = { stageId: string; stageName: string; count: number }
    export type DashboardSummaryType = {
      totalActiveProspects: number
      prospectsByStage: ProspectsByStageType[]
      interactionsThisWeek: number
      interactionsThisMonth: number
    }
    ```
  - [x] 1.2 Export from `packages/shared/src/index.ts`: add `export type * from './types/dashboard-summary.js'`
  - [x] 1.3 Build shared: `pnpm --filter @battlecrm/shared build`

- [x] Task 2: Backend — `GET /api/analytics/summary` endpoint (AC: #1, #2)
  - [x] 2.1 In `apps/backend/app/controllers/battles_controller.ts`, add imports: `import Prospect from '#models/prospect'` and `import Interaction from '#models/interaction'`
  - [x] 2.2 Add `summary()` action to `BattlesController`:
    - Count active prospects: `Prospect.query().withScopes(forUser).count('* as total')`
    - Prospects by stage: single GROUP BY query — `Prospect.query().withScopes(forUser).select('funnel_stage_id').count('* as total').groupBy('funnel_stage_id')` then map to `{ stageId, count }`. Load stage names separately via `FunnelStage.query().withScopes(forUser).orderBy('position', 'asc')` to get ordered list with names — merge the two.
    - `interactionsThisWeek`: `Interaction.query().withScopes(forUser).where('created_at', '>=', DateTime.now().startOf('week').toISO()).count('* as total')`
    - `interactionsThisMonth`: same pattern with `.startOf('month')`
    - Return: `response.ok({ totalActiveProspects, prospectsByStage, interactionsThisWeek, interactionsThisMonth })` typed via `DashboardSummaryType`
  - [x] 2.3 Serializer skipped — réponse construite inline dans le controller avec typage `DashboardSummaryType` explicite (suffisant per dev notes)
  - [x] 2.4 Register route in `apps/backend/start/routes.ts` under `/analytics` group: `router.get('/summary', [BattlesController, 'summary'])`

- [x] Task 3: Backend — functional tests (AC: #1, #2)
  - [x] 3.1 Create `apps/backend/tests/functional/analytics/summary.spec.ts` with tests:
    - `GET /api/analytics/summary returns correct shape → 200`
    - `totalActiveProspects counts only active (non-archived) prospects`
    - `prospectsByStage is ordered by funnel stage position`
    - `interactionsThisWeek counts only interactions from current week`
    - `interactionsThisMonth counts only interactions from current month`
    - `returns 401 for unauthenticated request`
    - `user isolation: only counts own data`

- [x] Task 4: Frontend — API + queryKey + hook (AC: #1, #2)
  - [x] 4.1 In `apps/frontend/src/features/dashboard/lib/api.ts`, add to `analyticsApi`:
    ```ts
    getSummary() {
      return fetchApi<DashboardSummaryType>('/analytics/summary')
    }
    ```
  - [x] 4.2 In `apps/frontend/src/lib/queryKeys.ts`, add to `analytics`:
    ```ts
    summary: () => [...queryKeys.analytics.all, 'summary'] as const,
    ```
  - [x] 4.3 Create `apps/frontend/src/features/dashboard/hooks/useDashboardSummary.ts` — same pattern as `usePerformanceMatrix.ts`

- [x] Task 5: Frontend — `DashboardSummary` component (AC: #1, #2, #3, #4)
  - [x] 5.1 Create `apps/frontend/src/features/dashboard/components/DashboardSummary.tsx`
  - [x] 5.2 Props: `summary: DashboardSummaryType`, `cells: ConversionCellType[]`, `isLoading: boolean`
  - [x] 5.3 KPI row: 4 shadcn `Card` components en `grid grid-cols-2 sm:grid-cols-4`
  - [x] 5.4 Best performing positioning: dérivé client-side depuis `cells` — filtre + sort + affichage name/stage/rate%
  - [x] 5.5 Funnel overview sub-section: `<ul>` avec barre de progression proportionnelle
  - [x] 5.6 Empty state guidance: 3 cards conditionnelles (prospects, positionings, interactions)
  - [x] 5.7 Loading state: skeletons pour les 4 KPI cards

- [x] Task 6: Frontend — DashboardPage integration (AC: #1, #2, #3, #4)
  - [x] 6.1 In `DashboardPage.tsx`, add `useDashboardSummary` hook call
  - [x] 6.2 Render `<DashboardSummary>` ABOVE the Accordion, BELOW the `<h1>` title
  - [x] 6.3 Pass `summary={summaryData}`, `cells={cells}`, `isLoading={summaryLoading}` to the component

- [x] Task 7: i18n (AC: #1, #2, #3)
  - [x] 7.1 Add to `apps/frontend/public/locales/en.json` under `dashboard`: toutes les clés `summary.*`
  - [x] 7.2 Add equivalent keys to `fr.json` (ajouté après détection de l'oubli)

- [x] Task 8: Validation
  - [x] 8.1 9 functional tests passent (7 originaux + 2 tz)
  - [x] 8.2 `pnpm lint` — Biome clean
  - [x] 8.3 `pnpm type-check` — 0 erreurs (4 workspaces)

## Review Follow-ups (appliqués lors du code review)

- [x] [AI-Review][MEDIUM] E2E tests for DashboardSummary ACs 1-3 → `tests/e2e/dashboard-summary.spec.ts` (13 tests)
- [x] [AI-Review][MEDIUM] Summary API error silently swallowed → `isError` propagé dans DashboardPage + DashboardSummary affiche message d'erreur + clé i18n `dashboard.summary.loadError`
- [x] [AI-Review][MEDIUM] Timezone UTC côté serveur → `tz` query param accepté, calcul des bornes semaine/mois dans le timezone client via Luxon `setZone()`, fallback UTC si invalide ; frontend passe `Intl.DateTimeFormat().resolvedOptions().timeZone`
- [x] [AI-Review][LOW] `FunnelStage.query()` séquentiel → 5 requêtes en parallèle dans un seul `Promise.all`
- [x] [AI-Review][LOW] `bestCell`/`maxCount` sans `useMemo` → `useMemo` ajouté avec dépendances correctes
- [x] [AI-Review][LOW] Skeleton `h-20` ≠ spec story `h-24` → corrigé à `h-24`

## Dev Notes

### Architecture constraints — DO NOT reinvent

- **`BattlesController`** already handles analytics (`performanceMatrix`). Add `summary()` action there — do NOT create a new `AnalyticsController`. Route goes under the existing `/analytics` prefix group (`routes.ts:72-78`).
- **`FunnelStage.query().withScopes(forUser).orderBy('position', 'asc')`** — always use `position` (not `created_at`) for funnel stage ordering. Seen in every existing functional test setup.
- **`Interaction.query().withScopes(forUser)`** — `forUser` scope is available on `Interaction` model (same pattern as prospects, positionings).
- **Soft-deleted prospects** — `Prospect.query()` already excludes soft-deleted by default (adonis-lucid-soft-deletes mixin). No additional filter needed for "active" count.
- **`DashboardSummaryType`** has no serializer needed for the array items — just inline object construction in the controller action is sufficient. The serializer only needs to return the typed shape.
- **`DateTime.now().startOf('week')`** in Luxon — week starts on Monday by default (ISO). Matches "interactions this week" semantics. Already imported in `BattlesController`.
- **Best performing positioning** — computed client-side from `cells` (already available in DashboardPage via `usePerformanceMatrix`). No backend calculation needed. Filter: `numerator > 0 && confidenceLevel !== 'low'`. Sort by `rate` descending. Take first. `ConversionCellType` (from `@battlecrm/shared`) has all needed fields: `positioningName`, `funnelStageName`, `rate`, `numerator`, `confidenceLevel`.
- **`analyticsApi.getSummary()`** goes in `dashboard/lib/api.ts` (NOT in a new file) — same pattern as `drillDown()` added in Story 6.7.

### COUNT query pattern in AdonisJS/Lucid

```ts
// Single count
const result = await Prospect.query()
  .withScopes((s) => s.forUser(userId))
  .count('* as total')
  .first()
const total = Number(result?.$extras.total ?? 0)

// Group by count
const groupedResult = await Prospect.query()
  .withScopes((s) => s.forUser(userId))
  .select('funnel_stage_id')
  .count('* as total')
  .groupBy('funnel_stage_id')
// Each row: row.$extras.total (string — convert with Number())
// row.funnelStageId is the grouped value (camelCase from Lucid)
```

### Prospects by stage — merge approach

Load stages and prospect counts separately, then merge:
```ts
const stages = await FunnelStage.query()
  .withScopes((s) => s.forUser(userId))
  .orderBy('position', 'asc')

const countRows = await Prospect.query()
  .withScopes((s) => s.forUser(userId))
  .select('funnel_stage_id')
  .count('* as total')
  .groupBy('funnel_stage_id')

const countMap = new Map(
  countRows.map((r) => [r.funnelStageId, Number(r.$extras.total ?? 0)])
)

const prospectsByStage = stages.map((s) => ({
  stageId: s.id,
  stageName: s.name,
  count: countMap.get(s.id) ?? 0,
}))
```

This gives ordered stages (by position) with counts including 0-count stages (important for the mini funnel viz to show all stages, even empty ones).

### Funnel overview progress bar

Max value for the bar width is the highest count across all stages (not `totalActiveProspects`):
```ts
const maxCount = Math.max(...summary.prospectsByStage.map((s) => s.count), 1)
// width: `${(stage.count / maxCount * 100).toFixed(0)}%`
```

Reuse the same progress bar JSX pattern as `FunnelCard.tsx:237-242`:
```tsx
<div className="h-2 w-full rounded-full bg-muted">
  <div
    className="h-2 rounded-full bg-primary transition-all"
    style={{ width: `${((stage.count / maxCount) * 100).toFixed(0)}%` }}
  />
</div>
```

### Empty state logic

Show empty state cards inline ABOVE the funnel overview — they should not replace the KPI row. A user with some prospects but no interactions should still see the KPI counts AND the empty state for interactions.

```ts
const showEmptyProspects = summary.totalActiveProspects === 0
const showEmptyPositionings = summary.totalActiveProspects > 0 && cells.length === 0
const showEmptyInteractions = summary.totalActiveProspects > 0 && summary.interactionsThisMonth === 0
```

### Functional test setup patterns (from api.spec.ts)

Follow the exact pattern used in existing test files:
```ts
const TEST_EMAIL_DOMAIN = '@test-analytics-summary.com'

test.group('Analytics Summary API', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })
  group.each.teardown(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  async function registerUser(client: ApiClient, prefix: string): Promise<User> {
    const res = await client.post('/api/auth/register').json({
      email: `${prefix}${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    res.assertStatus(201)
    return User.findOrFail(res.body().user.id)
  }
  ...
})
```

For `interactionsThisWeek`/`interactionsThisMonth` tests: create an `Interaction` record directly (via `Interaction.create({ ... })`) with an explicit `created_at` within the current week/month vs. outside. The `createdAt` must be set explicitly in `.create()` for test control:
```ts
await Interaction.create({
  userId: user.id,
  prospectId: prospect.id,
  type: 'email',
  content: 'Test interaction',
  createdAt: DateTime.now().minus({ days: 40 }), // outside this month
})
```

Check if `Interaction.create()` with `createdAt` override works in Lucid (it typically does since `autoCreate: true` only means Lucid sets it if not provided).

### DashboardSummary component structure

```tsx
export function DashboardSummary({ summary, cells, isLoading }: DashboardSummaryProps) {
  const { t } = useTranslation()

  const bestCell = cells
    .filter((c) => c.numerator > 0 && c.confidenceLevel !== 'low')
    .sort((a, b) => b.rate - a.rate)[0] ?? null

  const maxCount = Math.max(...summary.prospectsByStage.map((s) => s.count), 1)

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-4">...</CardContent></Card>
        {/* ... */}
      </div>

      {/* Empty state guidance */}
      {(showEmptyProspects || showEmptyPositionings || showEmptyInteractions) && (
        <div className="flex flex-wrap gap-2">
          {/* ... guidance cards */}
        </div>
      )}

      {/* Funnel overview */}
      {summary.prospectsByStage.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('dashboard.summary.funnelOverview')}
          </h3>
          <ul className="space-y-2">
            {summary.prospectsByStage.map((stage) => (
              <li key={stage.stageId} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate text-muted-foreground">{stage.stageName}</span>
                  <span className="tabular-nums">{stage.count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${((stage.count / maxCount) * 100).toFixed(0)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
```

### shadcn components to use

Already installed — DO NOT install new ones:
- `Card`, `CardContent`, `CardHeader` — for KPI cards
- `Skeleton` — for loading state
- `Badge` — for best positioning chip (optional)
- `Link` (from react-router, not shadcn) — for empty state CTAs

### Project Structure Notes

- New files:
  - `packages/shared/src/types/dashboard-summary.ts`
  - `apps/backend/app/serializers/dashboard-summary.ts`
  - `apps/backend/tests/functional/analytics/summary.spec.ts`
  - `apps/frontend/src/features/dashboard/hooks/useDashboardSummary.ts`
  - `apps/frontend/src/features/dashboard/components/DashboardSummary.tsx`
- Modified files:
  - `packages/shared/src/index.ts` (add export)
  - `apps/backend/app/controllers/battles_controller.ts` (add `summary()` action + 2 imports)
  - `apps/backend/start/routes.ts` (add `/summary` route under `/analytics`)
  - `apps/frontend/src/features/dashboard/lib/api.ts` (add `getSummary()`)
  - `apps/frontend/src/lib/queryKeys.ts` (add `analytics.summary`)
  - `apps/frontend/src/features/dashboard/DashboardPage.tsx` (add hook + render DashboardSummary)
  - `apps/frontend/public/locales/en.json` (add `dashboard.summary.*`)
  - `apps/frontend/public/locales/fr.json` (add `dashboard.summary.*`)

### References

- `BattlesController` existing analytics action: [Source: apps/backend/app/controllers/battles_controller.ts#performanceMatrix]
- Analytics route group: [Source: apps/backend/start/routes.ts:72-78]
- `ConversionCellType` (for best performing filter): [Source: packages/shared/src/types/performance-matrix.ts]
- FunnelCard progress bar pattern: [Source: apps/frontend/src/features/dashboard/components/FunnelCard.tsx:237-242]
- `analyticsApi` object to extend: [Source: apps/frontend/src/features/dashboard/lib/api.ts]
- `queryKeys.analytics` to extend: [Source: apps/frontend/src/lib/queryKeys.ts:8-13]
- `useDrillDown` hook pattern to follow: [Source: apps/frontend/src/features/dashboard/hooks/useDrillDown.ts]
- `DashboardPage.tsx` — integration point: [Source: apps/frontend/src/features/dashboard/DashboardPage.tsx]
- Existing functional test pattern: [Source: apps/backend/tests/functional/positionings/api.spec.ts:1-35]
- Empty state guidance (existing): [Source: apps/frontend/src/features/dashboard/DashboardPage.tsx:50-52]
- `interactionsThisWeek` date calc: use `DateTime.now().startOf('week')` — Luxon already imported in BattlesController

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Aucun blocage majeur.

### Completion Notes List

- **Task 2.3 (serializer) skippée** : la réponse est construite inline dans `BattlesController.summary()` avec le type `DashboardSummaryType` explicite — couverture fonctionnelle identique.
- **Correction test fonctionnel** : `createInteraction()` dans `summary.spec.ts` utilisait `type` et `content` (inexistants sur le modèle `Interaction`). Corrigé en `interactionDate` + `notes`.
- **Code review appliqué** (6 issues) : timezone UTC → `tz` query param + `Intl.DateTimeFormat` côté frontend ; erreur silencieuse → `isError` propagé ; E2E manquants → `tests/e2e/dashboard-summary.spec.ts` (13 tests, 4 suites couvrant AC 1-3) ; `Promise.all` parallèle pour les 5 requêtes DB ; `useMemo` sur `bestCell`/`maxCount` ; skeleton `h-24`.
- **i18n fr.json oublié** : les clés `dashboard.summary.*` n'avaient pas été ajoutées au fichier français. Ajoutées lors de la finalisation.
- **Régressions E2E** : le composant `DashboardSummary` affiche les noms d'étapes dans la section "Funnel overview", créant des duplicats pour `getByText('Lead qualified')` dans 3 fichiers de tests E2E (strict mode violation). Corrigé en scopant les locators sur `[data-slot="accordion-trigger"]`.

### File List

**Nouveaux fichiers :**
- `packages/shared/src/types/dashboard-summary.ts`
- `apps/backend/tests/functional/analytics/summary.spec.ts`
- `apps/frontend/src/features/dashboard/hooks/useDashboardSummary.ts`
- `apps/frontend/src/features/dashboard/components/DashboardSummary.tsx`

**Nouveaux fichiers (code review) :**
- `tests/e2e/dashboard-summary.spec.ts`

**Fichiers modifiés :**
- `packages/shared/src/index.ts`
- `apps/backend/app/controllers/battles_controller.ts`
- `apps/backend/start/routes.ts`
- `apps/backend/tests/functional/analytics/summary.spec.ts`
- `apps/frontend/src/features/dashboard/lib/api.ts`
- `apps/frontend/src/lib/queryKeys.ts`
- `apps/frontend/src/features/dashboard/DashboardPage.tsx`
- `apps/frontend/src/features/dashboard/components/DashboardSummary.tsx`
- `apps/frontend/public/locales/en.json`
- `apps/frontend/public/locales/fr.json`
- `tests/e2e/dashboard.spec.ts` (fix locators E2E)
- `tests/e2e/battles.spec.ts` (fix locators E2E)
- `tests/e2e/dashboard-drilldown.spec.ts` (fix locators E2E)
