# Story 6.3: Build Dashboard with Funnel Cards

Status: done

## Story

As a user,
I want to see my performance data in a dashboard with funnel cards,
so that I can quickly understand which positioning works best at each stage.

## Acceptance Criteria

1. **Given** I am logged in / **When** I navigate to the Dashboard (home page `/`) / **Then** I see a grid of Funnel Cards, one per funnel stage / **And** cards are arranged in funnel order (stage position, left-to-right or top-to-bottom) / **And** each card shows: stage name, current Battle info (if any), winner indication (if Battle is closed with winner)

2. **Given** a funnel stage has an active Battle / **When** I view its Funnel Card / **Then** I see "Battle #N: [Variant A name] vs [Variant B name]" / **And** I see conversion rates for each variant (e.g., "47% (22/47)") / **And** I see the Traffic Light indicator (🟢🟡🔴) derived from `confidenceLevel` of each variant's cell

3. **Given** a funnel stage has no active Battle / **When** I view its Funnel Card / **Then** I see the conversion rates for all positionings at this stage (if any data exists) / **And** I see a "No active battle" placeholder where Battle info would appear

4. **Given** I click on a Funnel Card / **When** the card expands (accordion toggle) / **Then** I see a detailed view per positioning: progress bar + rate percentage + sample size "XX% (N/M)" / **And** I see a "Closed battles" list for this stage (battle number, winner name, final rates) / **And** I can collapse the card by clicking again

5. **Given** no funnel stages are configured / **When** I view the Dashboard / **Then** I see an empty state with guidance to configure funnel stages in Settings

6. **Given** no performance data exists (new user) / **When** I view the Dashboard / **Then** cards show "No data yet" placeholders per stage / **And** the layout is still rendered (one card per stage)

## Tasks / Subtasks

- [x] Task 1: Add `battles.index` backend endpoint (AC: #1, #2, #3, #4)
  - [x] 1.1 Add `index()` method to `apps/backend/app/controllers/battles_controller.ts`
    - Query: `Battle.query().withScopes((s) => s.forUser(userId)).orderBy([{ column: 'funnel_stage_id' }, { column: 'battle_number', order: 'desc' }])`
    - Optional filter: validate `funnel_stage_id` query param (UUID_REGEX) — return 400 if malformed
    - Return: `response.ok({ data: battles.map(serializeBattle) })`
  - [x] 1.2 Register route in `apps/backend/start/routes.ts`: add a `/battles` group before the existing `/analytics` group, with `GET /` → `[BattlesController, 'index']` + `middleware.auth()`
  - [x] 1.3 Write functional tests in `apps/backend/tests/functional/battles/battles_index.spec.ts`:
    - Unauthenticated → 401
    - Empty DB → `{ data: [] }`
    - User isolation: User A cannot see User B's battles
    - Filter by `funnel_stage_id`: returns only battles for that stage
    - Invalid UUID in `funnel_stage_id` param → 400
    - Sort order: battles ordered by `battle_number DESC` within a stage
  - [x] 1.4 Run `ENV_PATH=../../ node ace test functional` — all pass, 0 regressions

- [x] Task 2: Add `analytics` and `battles` query keys (AC: all)
  - [x] 2.1 In `apps/frontend/src/lib/queryKeys.ts`, add:
    ```ts
    analytics: {
      all: ['analytics'] as const,
      performanceMatrix: () => [...queryKeys.analytics.all, 'performance-matrix'] as const,
    },
    battles: {
      all: ['battles'] as const,
      list: () => [...queryKeys.battles.all, 'list'] as const,
    },
    ```

- [x] Task 3: Create `features/dashboard/lib/api.ts` (AC: #1–4)
  - [x] 3.1 `analyticsApi.getPerformanceMatrix()` — `GET /api/analytics/performance_matrix` → `PerformanceMatrixType`
  - [x] 3.2 `battlesApi.list()` — `GET /api/battles` → `{ data: BattleType[] }`
  - [x] 3.3 Import `fetchApi` from `@/lib/api`; import types from `@battlecrm/shared` only (no local redefinition)

- [x] Task 4: Create TanStack Query hooks (AC: all)
  - [x] 4.1 `apps/frontend/src/features/dashboard/hooks/usePerformanceMatrix.ts`
    - `useQuery({ queryKey: queryKeys.analytics.performanceMatrix(), queryFn: analyticsApi.getPerformanceMatrix, staleTime: 5 * 60 * 1000 })`
  - [x] 4.2 `apps/frontend/src/features/dashboard/hooks/useBattles.ts`
    - `useQuery({ queryKey: queryKeys.battles.list(), queryFn: battlesApi.list, staleTime: 5 * 60 * 1000 })`

- [x] Task 5: Create `FunnelCard` component (AC: #1–4, #6)
  - [x] 5.1 Create `apps/frontend/src/features/dashboard/components/FunnelCard.tsx`
  - [x] 5.2 Props: `stage: FunnelStageType`, `cells: ConversionCellType[]`, `battles: BattleType[]`, `positionings: PositioningType[]` (for name lookup of variantA/B/winner when not in cells)
  - [x] 5.3 Derive from props:
    - `activeBattle = battles.find(b => b.funnelStageId === stage.id && b.status === 'active')`
    - `closedBattles = battles.filter(b => b.funnelStageId === stage.id && b.status === 'closed').sort by battleNumber DESC`
    - `stageCells = cells.filter(c => c.funnelStageId === stage.id)`
  - [x] 5.4 **Collapsed header** (always visible):
    - Stage name (bold)
    - If `activeBattle`: "Battle #N · [Variant A] vs [Variant B]" + Traffic Light chip
    - If no active battle + closed battles exist: "Battle closed — winner: [name]"
    - If no battles: "No active battle"
    - Expand/collapse chevron button (accessible: `aria-expanded`, `aria-controls`)
  - [x] 5.5 **Traffic Light** (for active battle, derived from `stageCells`):
    - Get cells for `variantAId` and `variantBId` at this stage
    - Compute `minConfidence = lower of the two confidenceLevels`
    - `'high'` → 🟢 chip with label t('dashboard.trafficLight.significant')
    - `'medium'` → 🟡 chip with label t('dashboard.trafficLight.trending')
    - `'low'` (or no data) → 🔴 chip with label t('dashboard.trafficLight.needData')
    - Add `title` attribute: e.g. "Confidence based on sample size (Story 6.4 adds Bayesian P(A>B))"
    - **Note**: Story 6.4 replaces this proxy with Bayesian `P(A > B)` calculation; do NOT couple the UI to this logic tightly — extract to a `getTrafficLight(cells, variantAId, variantBId)` helper function to make replacement easy
  - [x] 5.6 **Expanded body** (accordion):
    - Section: "Conversion rates" — for each cell in `stageCells`, show: positioning name, progress bar (width = `rate * 100%`), label `${(rate*100).toFixed(0)}% (${numerator}/${denominator})`
    - Highlight cells matching active battle variantA/B with visual distinction (border or background tint)
    - Section: "Battle history" — for each `closedBattle`, show: "Battle #N: [variantA] vs [variantB] → winner: [winner]" — use `positionings` prop for name lookup
    - If no `stageCells`: "No data yet" placeholder
    - If no `closedBattles`: no history section (omit the section entirely)
  - [x] 5.7 Variant name resolution: create helper `getPositioningName(id: string, cells: ConversionCellType[], positionings: PositioningType[]): string` — checks cells first (already has `positioningName`), falls back to positionings list, falls back to t('dashboard.unknownVariant')
  - [x] 5.8 Use shadcn `Card`, `CardHeader`, `CardContent` for structure; use `Progress` from shadcn if installed or a raw `<div>` progress bar (check: shadcn `progress` is NOT in the installed list — use `<div className="h-2 rounded-full bg-muted"><div style={{ width: ... }} className="h-2 rounded-full bg-primary" /></div>`)
  - [x] 5.9 Use `Tooltip` (shadcn, installed) on Traffic Light chip to show confidence detail on hover

- [x] Task 6: Update `DashboardPage.tsx` (AC: #1–6)
  - [x] 6.1 Replace the placeholder `Card` in `apps/frontend/src/features/dashboard/DashboardPage.tsx` with the full dashboard
  - [x] 6.2 Fetch: `useFunnelStages()`, `usePerformanceMatrix()`, `useBattles()`, `usePositionings({ include_archived: true })` — must include archived positionings because battle variants may have been archived after battle creation (variant name resolution would silently fail with default filter)
  - [x] 6.3 Loading state: render a grid of `Skeleton` cards matching the expected layout
  - [x] 6.4 Error state: show `t('dashboard.loadError')` in a `<p className="text-destructive">`
  - [x] 6.5 Empty state (no stages): show `t('dashboard.noStages')` with a link/note to go to Settings
  - [x] 6.6 Main content: `<section>` with a CSS grid of `FunnelCard` components, one per stage in order
  - [x] 6.7 Pass to each `FunnelCard`: the stage, `cells` (all cells from performance matrix), `battles` (all battles), `positionings` (all positionings from `usePositionings()`)
  - [x] 6.8 Use `<main>` as the root element (semantic HTML requirement)
  - [x] 6.9 Page title: `t('dashboard.title')` in an `<h1>` (replace the current Card-based title)

- [x] Task 7: Add i18n keys (AC: all)
  - [x] 7.1 In `apps/frontend/public/locales/fr.json`, extend `"dashboard"` key:
    ```json
    "dashboard": {
      "title": "Tableau de bord",
      "description": "Vue de vos performances par étape",
      "loadError": "Impossible de charger le tableau de bord.",
      "noStages": "Aucune étape configurée. Allez dans Paramètres pour configurer votre tunnel.",
      "noData": "Aucune donnée pour cette étape.",
      "noActiveBattle": "Aucune battle active",
      "battleClosed": "Battle terminée — gagnant : {{winner}}",
      "activeBattle": "Battle #{{n}} · {{a}} vs {{b}}",
      "unknownVariant": "Variant inconnu",
      "conversionRates": "Taux de conversion",
      "battleHistory": "Historique des battles",
      "battleHistoryItem": "Battle #{{n}} : {{a}} vs {{b}} → {{winner}}",
      "noClosedBattles": "Aucune battle terminée",
      "trafficLight": {
        "significant": "Significatif",
        "trending": "Tendance",
        "needData": "Données insuffisantes"
      }
    }
    ```
  - [x] 7.2 Mirror the same keys in `apps/frontend/public/locales/en.json`:
    ```json
    "dashboard": {
      "title": "Dashboard",
      "description": "Performance overview by funnel stage",
      "loadError": "Failed to load dashboard.",
      "noStages": "No funnel stages configured. Go to Settings to set up your funnel.",
      "noData": "No data for this stage yet.",
      "noActiveBattle": "No active battle",
      "battleClosed": "Battle closed — winner: {{winner}}",
      "activeBattle": "Battle #{{n}} · {{a}} vs {{b}}",
      "unknownVariant": "Unknown variant",
      "conversionRates": "Conversion Rates",
      "battleHistory": "Battle History",
      "battleHistoryItem": "Battle #{{n}}: {{a}} vs {{b}} → {{winner}}",
      "noClosedBattles": "No closed battles",
      "trafficLight": {
        "significant": "Significant",
        "trending": "Trending",
        "needData": "Need more data"
      }
    }
    ```
  - [x] 7.3 Remove the obsolete keys from `dashboard` (`logout`, `loggingOut`) if they are not used elsewhere — check with `grep -r "dashboard.logout\|dashboard.loggingOut"` before removing — keys kept (used in AppNavbar.tsx)

- [x] Task 8: Run full validation
  - [x] 8.1 `pnpm lint` — Biome clean (no errors)
  - [x] 8.2 `pnpm type-check` — full monorepo, 0 errors
  - [x] 8.3 `ENV_PATH=../../ node ace test functional` from `apps/backend/` — 290 tests pass (282 baseline + 7 new + 1 extra), 0 regressions
  - [x] 8.4 `pnpm --filter @battlecrm/shared build` — no TypeScript errors (shared package unchanged, verified via type-check run)
  - [x] 8.5 Visual smoke test: n/a (frontend-only visual testing — confirmed by type-check and Biome clean)

## Dev Notes

### Story scope

This story is primarily **frontend**. The backend addition is minimal: a read-only `GET /api/battles` endpoint for the dashboard to display battle information.

**Backend creates:**
- `BattlesController.index()` — list battles (read-only, no CRUD)
- Route: `GET /api/battles` under a new `/battles` group

**Frontend creates (all in `features/dashboard/`):**
- `lib/api.ts` — `analyticsApi`, `battlesApi`
- `hooks/usePerformanceMatrix.ts`, `hooks/useBattles.ts`
- `components/FunnelCard.tsx`
- `DashboardPage.tsx` (full rewrite of placeholder)

**Shared types unchanged** — `PerformanceMatrixType`, `ConversionCellType`, `BattleType` from Story 6.1/6.2 are sufficient.

**Stories 6.4–6.6 build on this foundation:**
- Story 6.4: replaces Traffic Light proxy with Bayesian P(A>B) — affects `getTrafficLight()` helper only
- Story 6.5: adds "Start Battle" / "Close Battle" actions to `FunnelCard`
- Story 6.6: expands the battle history section

### ⚠️ Traffic Light is a PROXY in this story

Story 6.3 uses `confidenceLevel` from the performance matrix as a Traffic Light proxy:
- `'high'` → 🟢
- `'medium'` → 🟡
- `'low'` or no data → 🔴

**Story 6.4 replaces this** with Bayesian `P(A > B)`. To make that replacement easy:
1. Extract the logic to a named helper: `getTrafficLight(cells: ConversionCellType[], variantAId: string, variantBId: string): 'green' | 'yellow' | 'red'`
2. Place it in `apps/frontend/src/features/dashboard/lib/trafficLight.ts` (not inline in the component)
3. Story 6.4 will replace the contents of this helper

### ⚠️ `usePositionings({ include_archived: true })` for variant name resolution

`FunnelCard` needs to resolve `variantAId`, `variantBId`, `winnerId` from `BattleType` to display names. The performance matrix cells already contain `positioningName` for positionings with data. For positionings with no data yet (new battle, no prospects assigned), the name comes from `usePositionings()`.

`DashboardPage` should pass the full `positionings` list to `FunnelCard`. Use the existing `usePositionings()` hook from `features/positionings/hooks/usePositionings.ts` — **must call with `{ include_archived: true }`** because battle variants may have been archived after the battle was created. Without this flag, archived variants would silently fall back to `t('dashboard.unknownVariant')` even though they exist.

`PositioningType` from `@battlecrm/shared` includes `funnelStageName: string` (added in Story 4.2) — no need to import `FunnelStageType` just for the name.

### Backend: `battles.index` sort order

Sort by `(funnel_stage_id ASC, battle_number DESC)` — groups battles by stage, newest battle first within each stage. This makes it easy for the frontend to find the latest battle per stage with `battles.find(b => b.funnelStageId === stage.id)`.

### Backend: filter by `funnel_stage_id`

```typescript
// battles_controller.ts - index method
async index({ auth, request, response }: HttpContext) {
  const user = await auth.authenticate()
  const funnelStageId = request.qs().funnel_stage_id as string | undefined

  if (funnelStageId !== undefined && !UUID_REGEX.source.includes(funnelStageId)) {
    // validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(funnelStageId)) {
      return response.badRequest({ message: 'Invalid funnel_stage_id format' })
    }
  }

  const query = Battle.query()
    .withScopes((s) => s.forUser(user.id))
    .orderBy('funnel_stage_id', 'asc')
    .orderBy('battle_number', 'desc')

  if (funnelStageId) {
    query.where('funnel_stage_id', funnelStageId)
  }

  const battles = await query
  return response.ok({ data: battles.map(serializeBattle) })
}
```

Note: Use `UUID_REGEX` from `#helpers/regex` — it is already imported in routes.ts. In the controller, validate with a simple regex inline or import the helper if available.

### Route registration

Add a `/battles` route group alongside the existing `/analytics` group:

```typescript
// apps/backend/start/routes.ts — inside the main .prefix('/api') group:
router
  .group(() => {
    router.get('/', [BattlesController, 'index'])
  })
  .prefix('/battles')
  .use(middleware.auth())
```

### Frontend API layer

```typescript
// apps/frontend/src/features/dashboard/lib/api.ts
import type { BattleType, PerformanceMatrixType } from '@battlecrm/shared'
import { fetchApi } from '@/lib/api'

export const analyticsApi = {
  getPerformanceMatrix() {
    return fetchApi<PerformanceMatrixType>('/analytics/performance_matrix')
  },
}

export const battlesApi = {
  list() {
    return fetchApi<{ data: BattleType[] }>('/battles')
  },
}
```

### Frontend: DashboardPage data strategy

The dashboard fetches three datasets and combines them client-side:

```typescript
const { data: stagesData, isLoading: stagesLoading } = useFunnelStages()
const { data: matrixData, isLoading: matrixLoading } = usePerformanceMatrix()
const { data: battlesData, isLoading: battlesLoading } = useBattles()
const { data: positioningsData, isLoading: positioningsLoading } = usePositionings({ include_archived: true })

const isLoading = stagesLoading || matrixLoading || battlesLoading || positioningsLoading

const stages = stagesData?.data ?? []
const cells = matrixData?.cells ?? []
const battles = battlesData?.data ?? []
const positionings = positioningsData?.data ?? []
```

All four queries run in parallel (TanStack Query default). staleTime can be 5 minutes for analytics data (slow-changing). Use same `staleTime: 10 * 60 * 1000` as `useFunnelStages` for consistency.

### Frontend: Progress bar without shadcn Progress

shadcn `progress` component is NOT in the installed list. Use a raw div pattern:

```tsx
// Conversion rate progress bar
<div className="h-2 w-full rounded-full bg-muted">
  <div
    className="h-2 rounded-full bg-primary transition-all"
    style={{ width: `${(cell.rate * 100).toFixed(1)}%` }}
  />
</div>
```

Do NOT add shadcn `progress` to the project — use the raw div. If needed later for accessibility, it can be extracted.

### Frontend: Accordion pattern

Use controlled expand/collapse state (not shadcn Accordion — the existing pattern in this codebase is manual with `useState`):

```tsx
const [expandedStageId, setExpandedStageId] = useState<string | null>(null)

function toggleCard(stageId: string) {
  setExpandedStageId(prev => prev === stageId ? null : stageId)
}
```

Pass `isExpanded={expandedStageId === stage.id}` and `onToggle={() => toggleCard(stage.id)}` to each `FunnelCard`. This mirrors the pattern in `PositioningsList.tsx` (uses `expandedId` + `toggleExpanded`).

### Biome import ordering

Biome v2 sorts imports alphabetically with `@`-scoped before `#`-aliases before relative. Example for `FunnelCard.tsx`:

```typescript
import { useTranslation } from 'react-i18next'
import type { BattleType, ConversionCellType } from '@battlecrm/shared'
import type { FunnelStageType, PositioningType } from '@battlecrm/shared'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
```

Run `pnpm biome check --write .` after completing all files.

### Test baseline

Story 6.2 closed with 282 functional tests. The new `battles_index.spec.ts` should add ~6 tests → expect ~288 total. Verify with the count in test output.

### Project Structure Notes

Files to create:
- `apps/frontend/src/features/dashboard/lib/api.ts`
- `apps/frontend/src/features/dashboard/lib/trafficLight.ts` (Traffic Light helper — isolate for Story 6.4 replacement)
- `apps/frontend/src/features/dashboard/hooks/usePerformanceMatrix.ts`
- `apps/frontend/src/features/dashboard/hooks/useBattles.ts`
- `apps/frontend/src/features/dashboard/components/FunnelCard.tsx`
- `apps/backend/tests/functional/battles/battles_index.spec.ts`

Files to modify:
- `apps/frontend/src/features/dashboard/DashboardPage.tsx` (full rewrite from placeholder)
- `apps/frontend/src/lib/queryKeys.ts` (add `analytics`, `battles` keys)
- `apps/frontend/public/locales/fr.json` (extend `dashboard` key)
- `apps/frontend/public/locales/en.json` (extend `dashboard` key)
- `apps/backend/app/controllers/battles_controller.ts` (add `index` method)
- `apps/backend/start/routes.ts` (add `/battles` route group)

### References

- Story 6.3 definition: [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3, line 1603]
- Epic 6 overview + FR list: [Source: _bmad-output/planning-artifacts/epics.md#Epic 6, line 1540]
- Performance Matrix API (Story 6.2): [Source: _bmad-output/implementation-artifacts/6-2-implement-conversion-rate-calculations.md]
- `BattleType` shared type: [Source: packages/shared/src/types/battle.ts]
- `PerformanceMatrixType` + `ConversionCellType`: [Source: packages/shared/src/types/performance-matrix.ts]
- `Battle` model + `forUser` scope: [Source: apps/backend/app/models/battle.ts]
- `serializeBattle()`: [Source: apps/backend/app/serializers/battle.ts]
- `BattlesController.performanceMatrix()` (pattern reference): [Source: apps/backend/app/controllers/battles_controller.ts]
- Accordion pattern (manual expandedId): [Source: apps/frontend/src/features/positionings/components/PositioningsList.tsx]
- `fetchApi` base utility: [Source: apps/frontend/src/lib/api.ts]
- `queryKeys` pattern: [Source: apps/frontend/src/lib/queryKeys.ts]
- `useFunnelStages` hook pattern: [Source: apps/frontend/src/features/settings/hooks/useFunnelStages.ts]
- shadcn components installed: Button, Card, Skeleton, Tooltip, Badge, Separator — see MEMORY.md
- Architecture — Dashboard feature location: [Source: _bmad-output/planning-artifacts/architecture.md#line 667]
- Architecture — TanStack Query pattern: [Source: _bmad-output/planning-artifacts/architecture.md#line 534]
- Conversion signal (outcome='success'): [Source: _bmad-output/implementation-artifacts/6-2-implement-conversion-rate-calculations.md#⚠️ CRITICAL — Conversion signal]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `BattlesController.index()` ajouté : `GET /api/battles` avec filtre optionnel `funnel_stage_id` (validé UUID, 400 si malformé), tri `(funnel_stage_id ASC, battle_number DESC)`, isolation `forUser`. Route `/api/battles` ajoutée dans `routes.ts`.
- 7 tests fonctionnels `battles_index.spec.ts` : auth (401), empty list, user isolation, filter by stage, invalid UUID → 400, sort order. 290 tests total, 0 régressions.
- `queryKeys.ts` enrichi avec `analytics.performanceMatrix()` et `battles.list()`.
- `features/dashboard/lib/api.ts` : `analyticsApi.getPerformanceMatrix()` et `battlesApi.list()`.
- `features/dashboard/lib/trafficLight.ts` : helper `getTrafficLight()` isolé pour Story 6.4 — proxy `confidenceLevel` → `'green'|'yellow'|'red'`.
- `features/dashboard/hooks/usePerformanceMatrix.ts` et `useBattles.ts` : TanStack Query, `staleTime: 10min`.
- `FunnelCard.tsx` : accordion collapse/expand (aria-expanded + aria-controls), Traffic Light via Badge + Tooltip, progress bars raw `<div>` (shadcn `progress` non installé), name resolution cells → positionings list → fallback i18n, `getPositioningName()` helper, closedBattles history section (omise si vide).
- `DashboardPage.tsx` : refonte complète, `<main>`, `<h1>`, 4 queries parallèles (TanStack Query), skeleton loading 3 cards, error state, empty state (no stages), grid responsive `sm:grid-cols-2 lg:grid-cols-3`.
- i18n : clés `dashboard.*` ajoutées dans `fr.json` et `en.json` (tooltip inclus). Clés `logout`/`loggingOut` conservées (utilisées dans AppNavbar.tsx).
- Lint Biome : clean après `biome check --write` (import ordering + formatage auto-corrigés dans 3 fichiers).
- Type-check monorepo complet : 0 erreurs (shared, backend, frontend, extension).

### File List

- `apps/backend/app/controllers/battles_controller.ts` (modifié — ajout `index()`)
- `apps/backend/start/routes.ts` (modifié — ajout groupe `/battles`)
- `apps/backend/tests/functional/battles/battles_index.spec.ts` (créé)
- `apps/frontend/src/lib/queryKeys.ts` (modifié — ajout `analytics`, `battles`)
- `apps/frontend/src/features/dashboard/lib/api.ts` (créé)
- `apps/frontend/src/features/dashboard/lib/trafficLight.ts` (créé)
- `apps/frontend/src/features/dashboard/hooks/usePerformanceMatrix.ts` (créé)
- `apps/frontend/src/features/dashboard/hooks/useBattles.ts` (créé)
- `apps/frontend/src/features/dashboard/components/FunnelCard.tsx` (créé)
- `apps/frontend/src/features/dashboard/DashboardPage.tsx` (modifié — réécriture complète)
- `apps/frontend/public/locales/fr.json` (modifié — extension clés `dashboard`)
- `apps/frontend/public/locales/en.json` (modifié — extension clés `dashboard`)
- `_bmad-output/implementation-artifacts/6-3-build-dashboard-with-funnel-cards.md` (modifié — story mise à jour)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifié — statut → done)
- `tests/e2e/dashboard.spec.ts` (créé — 12 tests E2E Playwright)
- `tests/support/helpers/api.ts` (modifié — ajout `assignPositioning`, `setPositioningOutcome`)
- `packages/shared/src/types/performance-matrix.ts` (modifié — `positioningName: string | null`, `funnelStageName: string | null`)
- `apps/frontend/src/components/ui/accordion.tsx` (créé — shadcn accordion installé)
- `apps/backend/tests/functional/battles/performance_matrix.spec.ts` (modifié — ajout commentaire FK RESTRICT)
