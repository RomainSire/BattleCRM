# Story 6.2: Implement Conversion Rate Calculations

Status: ready-for-dev

## Story

As a developer,
I want a service to calculate conversion rates per positioning per stage,
so that the Performance Matrix can display accurate analytics.

## Acceptance Criteria

1. **Given** a positioning variant is assigned to prospects at a funnel stage / **When** the analytics service calculates conversion rates / **Then** it computes: `(prospect_positionings WHERE outcome = 'success' AND positioning_id = X AND funnel_stage_id = N)` / `(total prospect_positionings WHERE positioning_id = X AND funnel_stage_id = N)` / **And** rates are computed per positioning × funnel stage combination / **And** the conversion signal is `prospect_positionings.outcome = 'success'` — NOT `interaction.status` (column dropped in migration 0010, Story 7.1) / **And** `prospect_positionings.funnel_stage_id` is used to filter by stage (denormalized at assignment time — do NOT join through positionings)

2. **Given** there are few data points (< 20) / **When** conversion rates are calculated / **Then** Bayesian updating is applied with a Beta(1, 1) prior (50% baseline, equivalent to 2 pseudo-observations) / **And** posterior mean = `(1 + successes) / (2 + total)` / **And** `confidenceLevel` is: `'high'` if denominator ≥ 20, `'medium'` if 10 ≤ denominator < 20, `'low'` if denominator < 10

3. **Given** the analytics endpoint is called (authenticated) / **When** I request `GET /api/analytics/performance_matrix` / **Then** I receive `{ cells: ConversionCellType[] }` with one entry per positioning × funnel stage combination that has at least one `prospect_positioning` row / **And** each cell includes: `positioningId`, `positioningName`, `funnelStageId`, `funnelStageName`, `rate` (number, 0–1), `numerator` (success count), `denominator` (total count), `confidenceLevel`

## Tasks / Subtasks

- [ ] Task 1: Add `PerformanceMatrixType` to `@battlecrm/shared` (AC: #3)
  - [ ] 1.1 Create `packages/shared/src/types/performance-matrix.ts` with `ConfidenceLevel`, `ConversionCellType`, `PerformanceMatrixType`
  - [ ] 1.2 Export from `packages/shared/src/index.ts`
  - [ ] 1.3 Run `pnpm --filter @battlecrm/shared build` — verify no TypeScript errors

- [ ] Task 2: Create `serializeBattle()` serializer (deferred from Story 6.1) (needed by Story 6.5)
  - [ ] 2.1 Create `apps/backend/app/serializers/battle.ts` with `serializeBattle(battle: Battle): BattleType`
  - [ ] 2.2 Run `pnpm type-check` — TypeScript must enforce the `BattleType` shape

- [ ] Task 3: Create `BayesianService` (AC: #1, #2)
  - [ ] 3.1 Create `apps/backend/app/services/bayesian_service.ts`
  - [ ] 3.2 Implement static `calculateConversionRate(successes: number, total: number): { rate: number; confidenceLevel: ConfidenceLevel }`
  - [ ] 3.3 Formula: `rate = (1 + successes) / (2 + total)` — never NaN, prior pulls toward 0.5

- [ ] Task 4: Create `BattlesController` with `performanceMatrix` method (AC: #1, #2, #3)
  - [ ] 4.1 Create `apps/backend/app/controllers/battles_controller.ts`
  - [ ] 4.2 Query `prospect_positionings` with raw SQL GROUP BY `(positioning_id, funnel_stage_id)` to get total + successes per cell (see query in Dev Notes)
  - [ ] 4.3 Resolve positioning names and stage names with separate queries (`.withTrashed()` — battles can reference archived entities)
  - [ ] 4.4 Apply `BayesianService.calculateConversionRate()` for each cell
  - [ ] 4.5 Return `{ cells: [...] }` shaped as `PerformanceMatrixType`

- [ ] Task 5: Register analytics route (AC: #3)
  - [ ] 5.1 Add `BattlesController` lazy import to `apps/backend/start/routes.ts`
  - [ ] 5.2 Add `/analytics` group with `GET /performance_matrix` → `[BattlesController, 'performanceMatrix']` + `middleware.auth()`

- [ ] Task 6: Write functional tests (AC: #1, #2, #3)
  - [ ] 6.1 Create `apps/backend/tests/functional/battles/performance_matrix.spec.ts`
  - [ ] 6.2 Test: unauthenticated request returns 401
  - [ ] 6.3 Test: no data → `{ cells: [] }`
  - [ ] 6.4 Test: cells computed correctly — verify rate, numerator, denominator for known data
  - [ ] 6.5 Test: Bayesian smoothing — 0 successes / 1 trial → rate ≈ 0.333 (not 0); 1 success / 1 trial → rate ≈ 0.667 (not 1)
  - [ ] 6.6 Test: user isolation — user A cannot see user B's cells
  - [ ] 6.7 Test: confidenceLevel mapping — low (< 10), medium (10–19), high (≥ 20)
  - [ ] 6.8 Test: archived positionings / stages still appear in cells (names resolved with `.withTrashed()`)
  - [ ] 6.9 Run `ENV_PATH=../../ node ace test functional` — all pass (0 regressions on 272 baseline)

## Dev Notes

### Story scope

Backend only. No frontend (Story 6.3). No Battle CRUD endpoints (Story 6.5). This story creates:
- the `PerformanceMatrixType` shared type
- the `serializeBattle()` serializer (deferred from 6.1, needed for Story 6.5)
- the `BayesianService` (pure math, no DB)
- one controller with one method
- one route: `GET /api/analytics/performance_matrix`

### ⚠️ CRITICAL — Conversion signal

**Do NOT use `interaction.status`** — that column was dropped in migration `0010_drop_status_from_interactions.ts` (Story 7.1). It no longer exists in the database.

The only conversion signal is:
```
prospect_positionings.outcome = 'success'
```

This is set explicitly by the user when they click "Succès" on a prospect (typically on stage transition). See Memory: "Signal conversion Epic 6: `interaction.status` a été supprimé. Le vrai signal est `prospect_positionings.outcome = 'success'`."

### ⚠️ CRITICAL — `funnel_stage_id` source

Use `prospect_positionings.funnel_stage_id` for stage filtering — NOT `positionings.funnel_stage_id` via join.

The column is intentionally denormalized: it is copied from `positioning.funnel_stage_id` at assignment time. This avoids joining through the positionings table and ensures correct filtering even if a positioning is reassigned to a different stage in the future.

### Bayesian formula

```
Prior:         Beta(α₀ = 1, β₀ = 1)  →  uniform prior ≡ 2 pseudo-observations at 50%
Posterior:     Beta(1 + successes, 1 + failures)
Posterior mean: (1 + successes) / (2 + total)
```

| denominator (total prospects) | confidenceLevel |
|-------------------------------|-----------------|
| ≥ 20                          | `'high'`        |
| 10 – 19                       | `'medium'`      |
| < 10                          | `'low'`         |

Zero prospects → cell not in matrix (GROUP BY produces no row). The formula never divides by zero; minimum valid denominator is 1.

### Shared types to create

```typescript
// packages/shared/src/types/performance-matrix.ts
export type ConfidenceLevel = 'high' | 'medium' | 'low'

export type ConversionCellType = {
  positioningId: string
  positioningName: string      // from preloaded Positioning (withTrashed)
  funnelStageId: string
  funnelStageName: string      // from preloaded FunnelStage (withTrashed)
  rate: number                 // Bayesian posterior mean, 0–1
  numerator: number            // prospect_positionings WHERE outcome = 'success'
  denominator: number          // total prospect_positionings for this cell
  confidenceLevel: ConfidenceLevel
}

export type PerformanceMatrixType = {
  cells: ConversionCellType[]
}
```

### `serializeBattle()` shape

```typescript
// apps/backend/app/serializers/battle.ts
import type { BattleType } from '@battlecrm/shared'
import type Battle from '#models/battle'

export function serializeBattle(battle: Battle): BattleType {
  return {
    id: battle.id,
    userId: battle.userId,
    funnelStageId: battle.funnelStageId,
    variantAId: battle.variantAId,
    variantBId: battle.variantBId,
    battleNumber: battle.battleNumber,
    status: battle.status,
    winnerId: battle.winnerId,
    startedAt: battle.startedAt.toISO()!,
    closedAt: battle.closedAt?.toISO() ?? null,
    createdAt: battle.createdAt.toISO()!,
    updatedAt: battle.updatedAt?.toISO() ?? null,
  }
}
```

### `BayesianService` — pure math, no DB

```typescript
// apps/backend/app/services/bayesian_service.ts
import type { ConfidenceLevel } from '@battlecrm/shared'

export class BayesianService {
  private static readonly ALPHA_PRIOR = 1
  private static readonly BETA_PRIOR = 1

  static calculateConversionRate(
    successes: number,
    total: number,
  ): { rate: number; confidenceLevel: ConfidenceLevel } {
    const rate = (this.ALPHA_PRIOR + successes) / (this.ALPHA_PRIOR + this.BETA_PRIOR + total)
    const confidenceLevel: ConfidenceLevel = total >= 20 ? 'high' : total >= 10 ? 'medium' : 'low'
    return { rate, confidenceLevel }
  }
}
```

### Controller — DB query strategy

Use raw SQL with GROUP BY for aggregation, then resolve names via separate Lucid queries:

```typescript
import db from '@adonisjs/lucid/services/db'

// Step 1: aggregate at DB level
const result = await db.rawQuery<{
  rows: Array<{
    positioning_id: string
    funnel_stage_id: string
    total: string       // PostgreSQL COUNT → bigint string
    successes: string   // PostgreSQL COUNT → bigint string
  }>
}>(
  `SELECT positioning_id,
          funnel_stage_id,
          COUNT(*)                                                 AS total,
          COUNT(CASE WHEN outcome = 'success' THEN 1 END)         AS successes
   FROM prospect_positionings
   WHERE user_id = ?
   GROUP BY positioning_id, funnel_stage_id`,
  [userId],
)

const rows = result.rows

// Step 2: resolve names (withTrashed — archived entities still appear in cells)
const positioningIds = [...new Set(rows.map((r) => r.positioning_id))]
const stageIds = [...new Set(rows.map((r) => r.funnel_stage_id))]

const positionings = positioningIds.length
  ? await Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .withTrashed()
      .whereIn('id', positioningIds)
  : []

const stages = stageIds.length
  ? await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .withTrashed()
      .whereIn('id', stageIds)
  : []

// Step 3: build cells
const positioningMap = new Map(positionings.map((p) => [p.id, p]))
const stageMap = new Map(stages.map((s) => [s.id, s]))

const cells: ConversionCellType[] = rows.map((row) => {
  const total = Number(row.total)
  const successes = Number(row.successes)
  const { rate, confidenceLevel } = BayesianService.calculateConversionRate(successes, total)
  return {
    positioningId: row.positioning_id,
    positioningName: positioningMap.get(row.positioning_id)?.name ?? 'Positioning supprimé',
    funnelStageId: row.funnel_stage_id,
    funnelStageName: stageMap.get(row.funnel_stage_id)?.name ?? 'Stage supprimé',
    rate,
    numerator: successes,
    denominator: total,
    confidenceLevel,
  }
})

return response.ok({ cells })
```

**Note:** `COUNT()` in PostgreSQL returns `bigint` serialized as a string by `pg`. Always wrap with `Number()`.

### Route registration

```typescript
// apps/backend/start/routes.ts — add at top with other controller imports:
const BattlesController = () => import('#controllers/battles_controller')

// Add alongside existing route groups (before the .prefix('/api') close):
router
  .group(() => {
    router.get('/performance_matrix', [BattlesController, 'performanceMatrix'])
  })
  .prefix('/analytics')
  .use(middleware.auth())
```

### Test pattern — setup helper

The performance matrix spec needs prospect_positionings with specific outcomes. Use direct model creation (no HTTP for setup):

```typescript
// Setup: register user → get default stage → create positionings → create prospect_positionings
const res = await client.post('/api/auth/register').json({ email, password })
const userId = res.body().user.id
const stage = await FunnelStage.query().withScopes((s) => s.forUser(userId)).firstOrFail()
const positioning = await Positioning.create({ userId, funnelStageId: stage.id, name: 'Test' })
const prospect = await Prospect.create({ userId, funnelStageId: stage.id, name: 'Alice' })

// Create prospect_positioning with known outcome
await ProspectPositioning.create({
  userId,
  prospectId: prospect.id,
  positioningId: positioning.id,
  funnelStageId: stage.id,
  outcome: 'success',
})

// Call endpoint as authenticated user
const matrixRes = await client.get('/api/analytics/performance_matrix').loginAs(user)
matrixRes.assertStatus(200)
matrixRes.assertBodyContains({ cells: [...] })
```

### Run commands

```bash
# From apps/backend/
ENV_PATH=../../ node ace test functional

# From repo root
pnpm type-check
pnpm lint
```

### Project Structure Notes

Files to create:
- `packages/shared/src/types/performance-matrix.ts` — `ConfidenceLevel`, `ConversionCellType`, `PerformanceMatrixType`
- `apps/backend/app/serializers/battle.ts` — `serializeBattle()`
- `apps/backend/app/services/bayesian_service.ts` — `BayesianService` (pure static methods)
- `apps/backend/app/controllers/battles_controller.ts` — `performanceMatrix()`
- `apps/backend/tests/functional/battles/performance_matrix.spec.ts`

Files to modify:
- `packages/shared/src/index.ts` — add `export type * from './types/performance-matrix.js'`
- `apps/backend/start/routes.ts` — add `BattlesController` import + `/analytics` group

### References

- Epic 6 Story 6.2 definition: [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2 line 1576]
- Conversion signal (outcome = 'success'): [Source: _bmad-output/planning-artifacts/epics.md#line 1588]
- `prospect_positionings.funnel_stage_id` denormalization: [Source: _bmad-output/planning-artifacts/architecture.md#Impact sur les analytics (Epic 6)]
- BayesianService + BattlesController file locations: [Source: _bmad-output/planning-artifacts/architecture.md#line 703]
- Shared Package Pattern (mandatory workflow): [Source: _bmad-output/planning-artifacts/architecture.md#Shared Package Pattern]
- Serializer reference: [Source: apps/backend/app/serializers/positioning.ts]
- Service reference pattern: [Source: apps/backend/app/services/funnel_stage_service.ts]
- Battle model (Story 6.1): [Source: apps/backend/app/models/battle.ts]
- ProspectPositioning model (conversion signal source): [Source: apps/backend/app/models/prospect_positioning.ts]
- Story 6.1 (predecessor): [Source: _bmad-output/implementation-artifacts/6-1-create-battles-database-schema.md]
- `db.rawQuery` pattern: [Source: apps/backend/database/migrations/0013_create_battles_table.ts]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
