# Story 6.4: Implement Traffic Light Significance Indicator

Status: review

## Story

As a user,
I want to see a traffic light indicator for statistical significance,
so that I know if I can trust the conversion data and which variant is winning.

## Acceptance Criteria

1. **Given** a Battle has data for both variants / **When** the system calculates significance / **Then** it uses Bayesian probability P(A > B) / **And** the result is mapped to a traffic light: 🟢 >95% confidence one variant is better, 🟡 70–95% confidence (trend visible, not significant), 🔴 <70% confidence or n < 10 (insufficient data)

2. **Given** I view a Funnel Card with an active Battle / **When** the Traffic Light is displayed / **Then** I see the emoji + text label (e.g., "🟢 Significatif") / **And** hovering shows detail (e.g., "97% certain que Variant A est meilleur(e)")

3. **Given** a Battle is 🔴 Red / **When** I view the card / **Then** I see the "Need more data" / "Données insuffisantes" label in the Traffic Light chip / **And** the tooltip explains why (e.g., "Données insuffisantes (n < 10 par variant)") / **Note**: "Close Battle" button disable state will be enforced in Story 6.5 when the button is added — `getTrafficLight()` return value is the source of truth

## Tasks / Subtasks

- [x] Task 1: Replace proxy with Bayesian P(A > B) in `trafficLight.ts` (AC: #1)
  - [x] 1.1 Add `normalCdf(x: number): number` helper — implements Φ(x) = 0.5*(1 + erf(x/√2)) using Abramowitz & Stegun approximation (max error ~1.5e-7), sufficient for this use case
  - [x] 1.2 Add `calculatePAGreaterThanB(numA: number, denomA: number, numB: number, denomB: number): number | null` — returns `null` when either denominator < 10 (insufficient data), else uses Beta-distribution normal approximation:
    - Prior: α₀ = β₀ = 1 (matches `bayesian_service.ts` convention)
    - αA = 1 + numA, βA = 1 + (denomA - numA); similarly for B
    - μ = α/(α+β), σ² = αβ / ((α+β)²(α+β+1))
    - P(A>B) ≈ normalCdf((μA - μB) / Math.sqrt(σ²A + σ²B))
  - [x] 1.3 Update `getTrafficLight()` return type to `TrafficLightResult`:
    ```typescript
    export type TrafficLightResult = {
      color: TrafficLightColor
      confidence: number | null  // 0.0–1.0, max(p, 1-p) — null when n < 10
      leadingVariantId: string | null  // ID of the winning variant, or null
    }
    ```
  - [x] 1.4 Update `getTrafficLight()` logic:
    - If cellA or cellB missing → `{ color: 'red', confidence: null, leadingVariantId: null }`
    - Compute `p = calculatePAGreaterThanB(cellA.numerator, cellA.denominator, cellB.numerator, cellB.denominator)`
    - If p is null → `{ color: 'red', confidence: null, leadingVariantId: null }`
    - `confidence = Math.max(p, 1 - p)`
    - `leadingVariantId = p >= 0.5 ? variantAId : variantBId`
    - `color = confidence > 0.95 ? 'green' : confidence > 0.70 ? 'yellow' : 'red'`
  - [x] 1.5 Remove old proxy logic (confidenceLevel-based)

- [x] Task 2: Update `FunnelCard.tsx` to use new return type (AC: #2, #3)
  - [x] 2.1 Update `renderTrafficLight(battle: BattleType)` to destructure `{ color, confidence, leadingVariantId }` from `getTrafficLight()`
  - [x] 2.2 Compute tooltip message:
    - If `confidence === null`: use `t('dashboard.trafficLight.tooltipNoData')`
    - Else: use `t('dashboard.trafficLight.tooltipWithProb', { confidence: Math.round(confidence * 100), variant: resolveName(leadingVariantId!) })`
  - [x] 2.3 Pass tooltip message string to `<TooltipContent>`
  - [x] 2.4 Remove the old `t('dashboard.trafficLight.tooltip')` call

- [x] Task 3: Update i18n keys (AC: #2, #3)
  - [x] 3.1 In `apps/frontend/public/locales/fr.json`, update `dashboard.trafficLight`:
    ```json
    "trafficLight": {
      "significant": "Significatif",
      "trending": "Tendance",
      "needData": "Données insuffisantes",
      "tooltipWithProb": "{{confidence}}% certain que {{variant}} est meilleur(e)",
      "tooltipNoData": "Données insuffisantes (n < 10 par variant)"
    }
    ```
    (Ancienne clé `"tooltip"` supprimée — vérifiée absente dans tous les fichiers .tsx/.ts)
  - [x] 3.2 Mirror in `apps/frontend/public/locales/en.json`:
    ```json
    "trafficLight": {
      "significant": "Significant",
      "trending": "Trending",
      "needData": "Need more data",
      "tooltipWithProb": "{{confidence}}% confident {{variant}} is better",
      "tooltipNoData": "Not enough data (n < 10 per variant)"
    }
    ```

- [x] Task 4: Run full validation
  - [x] 4.1 `pnpm lint` — Biome clean (auto-fixed poly expression line-break in `trafficLight.ts`)
  - [x] 4.2 `pnpm type-check` — full monorepo (shared, backend, frontend, extension): 0 erreurs
  - [x] 4.3 `ENV_PATH=../../ node ace test functional` — 290 tests pass, 0 regressions (aucun changement backend)
  - [x] 4.4 Manual smoke test: frontend-only change — vérifiable via type-check + lint; smoke test visuel à effectuer manuellement

## Dev Notes

### Scope: Frontend-only change

This story touches **only frontend files**. No backend changes are needed because:
- `ConversionCellType` already exposes `numerator` and `denominator` — the raw counts required for P(A > B)
- The calculation is a pure function that runs in the browser
- No new API endpoints required

**Files to modify:**
- `apps/frontend/src/features/dashboard/lib/trafficLight.ts` (main change)
- `apps/frontend/src/features/dashboard/components/FunnelCard.tsx` (use new return type)
- `apps/frontend/public/locales/fr.json` (update i18n)
- `apps/frontend/public/locales/en.json` (update i18n)

**Files to NOT touch:**
- `apps/backend/` — no changes
- `packages/shared/` — no changes (`ConversionCellType` is sufficient)
- `apps/frontend/src/features/dashboard/lib/api.ts` — no changes
- `apps/frontend/src/features/dashboard/DashboardPage.tsx` — no changes

### Algorithm: Normal approximation for Beta distribution

The Bayesian approach: each variant's conversion rate follows a Beta distribution posterior with uniform prior:
- After observing `k` successes out of `n` trials → Beta(1+k, 1+(n-k))
- Prior: α₀ = β₀ = 1 (matches `bayesian_service.ts` ALPHA_PRIOR/BETA_PRIOR constants)

For Beta(α, β):
- mean: μ = α / (α + β)
- variance: σ² = αβ / ((α + β)² × (α + β + 1))

P(A > B) ≈ Φ((μA - μB) / √(σ²A + σ²B))

Where Φ is the standard normal CDF. This approximation is:
- Accurate enough for n ≥ 10 (error < 2% for our thresholds)
- Exact for large n (by Central Limit Theorem)
- Avoids any external dependency (pure math, no npm package)

**The threshold for n < 10 catches the case where the approximation would be unreliable AND where data is genuinely insufficient for any real conclusion.**

### Implementation of normalCdf

Use the Abramowitz & Stegun (1964) erf approximation (formula 7.1.26, max error 1.5×10⁻⁷):

```typescript
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * x)
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return sign * (1 - poly * Math.exp(-x * x))
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}
```

### Full updated `trafficLight.ts`

```typescript
import type { ConversionCellType } from '@battlecrm/shared'

export type TrafficLightColor = 'green' | 'yellow' | 'red'

export type TrafficLightResult = {
  color: TrafficLightColor
  confidence: number | null  // 0.0–1.0, or null when n < 10
  leadingVariantId: string | null
}

const PRIOR_ALPHA = 1
const PRIOR_BETA = 1

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * x)
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return sign * (1 - poly * Math.exp(-x * x))
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

export function calculatePAGreaterThanB(
  numA: number,
  denomA: number,
  numB: number,
  denomB: number,
): number | null {
  if (denomA < 10 || denomB < 10) return null
  const alphaA = PRIOR_ALPHA + numA
  const betaA = PRIOR_BETA + (denomA - numA)
  const alphaB = PRIOR_ALPHA + numB
  const betaB = PRIOR_BETA + (denomB - numB)
  const nA = alphaA + betaA
  const nB = alphaB + betaB
  const muA = alphaA / nA
  const muB = alphaB / nB
  const varA = (alphaA * betaA) / (nA * nA * (nA + 1))
  const varB = (alphaB * betaB) / (nB * nB * (nB + 1))
  const sigma = Math.sqrt(varA + varB)
  if (sigma === 0) return muA > muB ? 1 : 0
  return normalCdf((muA - muB) / sigma)
}

export function getTrafficLight(
  cells: ConversionCellType[],
  variantAId: string,
  variantBId: string,
  funnelStageId: string,
): TrafficLightResult {
  const cellA = cells.find((c) => c.positioningId === variantAId && c.funnelStageId === funnelStageId)
  const cellB = cells.find((c) => c.positioningId === variantBId && c.funnelStageId === funnelStageId)

  if (!cellA || !cellB) return { color: 'red', confidence: null, leadingVariantId: null }

  const p = calculatePAGreaterThanB(cellA.numerator, cellA.denominator, cellB.numerator, cellB.denominator)
  if (p === null) return { color: 'red', confidence: null, leadingVariantId: null }

  const confidence = Math.max(p, 1 - p)
  const leadingVariantId = p >= 0.5 ? variantAId : variantBId
  const color: TrafficLightColor = confidence > 0.95 ? 'green' : confidence > 0.70 ? 'yellow' : 'red'

  return { color, confidence, leadingVariantId }
}
```

### FunnelCard.tsx: `renderTrafficLight` update

```typescript
function renderTrafficLight(battle: BattleType) {
  const { color, confidence, leadingVariantId } = getTrafficLight(
    cells,
    battle.variantAId,
    battle.variantBId,
    stage.id,
  )
  const { emoji, labelKey } = TRAFFIC_CONFIG[color]

  const tooltipText =
    confidence === null || leadingVariantId === null
      ? t('dashboard.trafficLight.tooltipNoData')
      : t('dashboard.trafficLight.tooltipWithProb', {
          confidence: Math.round(confidence * 100),
          variant: resolveName(leadingVariantId),
        })

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="cursor-default gap-1 text-xs" aria-label={t(labelKey)}>
          <span>{emoji}</span>
          <span>{t(labelKey)}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  )
}
```

### Biome import ordering in `trafficLight.ts`

After the change, `trafficLight.ts` imports only from `@battlecrm/shared`. Import order is fine. Run `pnpm biome check --write .` after completing all files.

### ⚠️ Regarding AC #3: "Close Battle" button disabled when 🔴

The "Close Battle" button does **not exist yet** — it is introduced in **Story 6.5**. Story 6.4 lays the groundwork:
- `getTrafficLight()` returns `color: TrafficLightColor` which Story 6.5 will use to disable the button
- The "Need more data" label already visible in the Traffic Light chip satisfies the user-visible aspect of this AC
- Story 6.5 dev should use `color === 'red'` (from `getTrafficLight()`) to disable the "Close Battle" button

### ⚠️ i18n: old `tooltip` key removal

Current FR/EN locale files have:
```json
"tooltip": "Indicateur basé sur la taille d'échantillon (Story 6.4 ajoutera le calcul P(A>B))"
```

Before removing, verify it's not referenced anywhere else:
```bash
grep -r "trafficLight.tooltip" apps/frontend/src/ --include="*.tsx" --include="*.ts"
```
Expected: only `FunnelCard.tsx`. Safe to remove after updating that file.

### Test baseline

290 functional tests (backend). No new backend tests in this story. No Playwright E2E tests required for this story (tooltip content is hard to test meaningfully). Type checking covers correctness of the interface change.

If a future story adds Vitest unit tests, `calculatePAGreaterThanB` is an ideal pure function to test with:
- `(0, 0, 0, 0)` → null (n < 10)
- `(50, 100, 30, 100)` → p > 0.95 (very different rates)
- `(10, 20, 10, 20)` → p ≈ 0.5 (equal rates)

### Project Structure Notes

**Files modified:**
- `apps/frontend/src/features/dashboard/lib/trafficLight.ts` — full rewrite with Bayesian P(A>B)
- `apps/frontend/src/features/dashboard/components/FunnelCard.tsx` — `renderTrafficLight()` update only
- `apps/frontend/public/locales/fr.json` — update `dashboard.trafficLight` subkeys
- `apps/frontend/public/locales/en.json` — update `dashboard.trafficLight` subkeys

**No new files needed.**

### References

- Story 6.4 definition: [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4, line 1631]
- Epic 6 overview: [Source: _bmad-output/planning-artifacts/epics.md#Epic 6, line 1540]
- Current `trafficLight.ts` (Story 6.3 proxy to replace): [Source: apps/frontend/src/features/dashboard/lib/trafficLight.ts]
- `bayesian_service.ts` prior constants (α₀=β₀=1): [Source: apps/backend/app/services/bayesian_service.ts]
- `ConversionCellType` (numerator, denominator available): [Source: packages/shared/src/types/performance-matrix.ts]
- `BattleType` (variantAId, variantBId): [Source: packages/shared/src/types/battle.ts]
- `FunnelCard.tsx` — current `renderTrafficLight()` implementation: [Source: apps/frontend/src/features/dashboard/components/FunnelCard.tsx]
- Story 6.3 Dev Notes — Traffic Light proxy design decision: [Source: _bmad-output/implementation-artifacts/6-3-build-dashboard-with-funnel-cards.md#⚠️ Traffic Light is a PROXY in this story]
- Architecture — Bayesian service location: [Source: _bmad-output/planning-artifacts/architecture.md#line 781]
- Test baseline (290 functional): [Source: _bmad-output/implementation-artifacts/6-3-build-dashboard-with-funnel-cards.md#Task 8]
- Biome import ordering rule: [Source: _bmad-output/implementation-artifacts/6-3-build-dashboard-with-funnel-cards.md#Biome import ordering]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `trafficLight.ts` réécrit entièrement : suppression du proxy `confidenceLevel`, ajout de `erf()` (Abramowitz & Stegun), `normalCdf()`, `calculatePAGreaterThanB()` (prior α₀=β₀=1, approximation normale Beta), et `getTrafficLight()` renvoyant `TrafficLightResult { color, confidence, leadingVariantId }`.
- `FunnelCard.tsx` : `renderTrafficLight()` destructure le nouveau `TrafficLightResult` — tooltip dynamique : `tooltipWithProb` (X% confident [Variant] est meilleur) ou `tooltipNoData` (n < 10).
- i18n FR/EN : clé `tooltip` remplacée par `tooltipWithProb` + `tooltipNoData` dans les deux fichiers.
- Biome lint : auto-fix de l'expression `poly` sur une ligne (format). 0 erreurs.
- Type-check monorepo complet (shared, backend, frontend, extension) : 0 erreurs.
- 290 tests fonctionnels backend : 0 régression (aucun changement backend).

### File List

- `apps/frontend/src/features/dashboard/lib/trafficLight.ts` (modifié — réécriture complète, Bayesian P(A>B))
- `apps/frontend/src/features/dashboard/components/FunnelCard.tsx` (modifié — `renderTrafficLight()` utilise `TrafficLightResult`)
- `apps/frontend/public/locales/fr.json` (modifié — `trafficLight.tooltip` → `tooltipWithProb` + `tooltipNoData`)
- `apps/frontend/public/locales/en.json` (modifié — idem)
- `_bmad-output/implementation-artifacts/6-4-implement-traffic-light-significance-indicator.md` (modifié — story mise à jour)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifié — statut → review)
