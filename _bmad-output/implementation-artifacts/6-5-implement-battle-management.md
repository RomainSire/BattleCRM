# Story 6.5: Implement Battle Management

Status: review

## Story

As a user,
I want to start, close, and iterate Battles per funnel stage,
so that I can continuously optimize my positioning through A/B testing.

## Acceptance Criteria

1. **Given** a funnel stage has no active Battle / **When** I click "Start Battle" on its Funnel Card / **Then** I see a dialog to select two positioning variants (distinct, both belonging to this stage) / **And** submitting creates a new Battle with `status = 'active'` and the correct `battleNumber`

2. **Given** an active Battle reaches 🟢 significance / **When** I view the Funnel Card / **Then** the "Close Battle" button is **enabled** / **And** clicking it opens a confirmation showing the leading variant as the default winner

3. **Given** an active Battle is 🔴 red / **When** I view the Funnel Card / **Then** the "Close Battle" button is **disabled** (tooltip: "Not enough data")

4. **Given** I click "Close Battle" and confirm the winner / **When** the request completes / **Then** `battle.status = 'closed'`, `winner_id` is set, `closed_at = now()` / **And** the Funnel Card shows the winner / **And** other stage cards are NOT affected

5. **Given** a Battle was just closed / **When** I view the Funnel Card / **Then** I see "Start Next Battle" / **And** the previous winner is pre-selected as Variant A / **And** I pick a new Variant B challenger

## Tasks / Subtasks

- [x] Task 1: Backend validator (AC: #1, #4)
  - [x] 1.1 Create `apps/backend/app/validators/battles.ts` with:
    - `createBattleValidator`: `{ funnel_stage_id: uuid, variant_a_id: uuid, variant_b_id: uuid }`
    - `closeBattleValidator`: `{ winner_id: uuid }`
  - [x] 1.2 Import and use in `BattlesController`

- [x] Task 2: Backend — `POST /api/battles` (AC: #1)
  - [x] 2.1 Add `store` action to `BattlesController`:
    - Validate with `createBattleValidator`
    - Check `funnel_stage_id` belongs to authenticated user (FunnelStage.forUser + .first → 404)
    - Check `variant_a_id` and `variant_b_id` belong to authenticated user (Positioning.forUser + .first → 404)
    - Guard: `variant_a_id !== variant_b_id` → 422 `{ message: 'Variants must be different' }`
    - Guard: no existing active battle for (user_id, funnel_stage_id) → 409 `{ message: 'A battle is already active for this stage' }`
    - Compute `battleNumber` = last battle's battle_number (ordered desc) + 1, defaulting to 1
    - Create battle and return 201 with `serializeBattle(battle)`
  - [x] 2.2 Add route: `router.post('/', [BattlesController, 'store'])` in `/api/battles` group

- [x] Task 3: Backend — `PATCH /api/battles/:id/close` (AC: #4)
  - [x] 3.1 Add `close` action to `BattlesController`:
    - Load battle via `forUser` scope → 404 if not found
    - Guard: `battle.status !== 'active'` → 422 `{ message: 'Battle is already closed' }`
    - Validate body with `closeBattleValidator`
    - Guard: `winner_id !== battle.variantAId && winner_id !== battle.variantBId` → 422
    - Update: `battle.merge({ status: 'closed', winnerId: payload.winner_id, closedAt: DateTime.now() }).save()`
    - Return 200 with `serializeBattle(battle)`
  - [x] 3.2 Add route: `router.patch('/:id/close', [BattlesController, 'close']).where('id', UUID_REGEX)`

- [x] Task 4: Backend tests for POST /api/battles (AC: #1)
  - [x] 4.1 File: `apps/backend/tests/functional/battles/battles_store.spec.ts`
  - [x] 4.2 Tests (11 tests, all passing):
    - 401 unauthenticated
    - 201 creates battle with battleNumber = 1 for first battle
    - 201 creates battle with battleNumber = 2 after previous closed
    - 422 same variant for A and B
    - 422 invalid UUID fields
    - 404 funnel_stage_id not owned by user
    - 404 variant_a_id not owned by user
    - 404 variant_b_id not owned by user
    - 409 active battle already exists for stage
    - User isolation: user A's active battle does not block user B

- [x] Task 5: Backend tests for PATCH /api/battles/:id/close (AC: #4)
  - [x] 5.1 File: `apps/backend/tests/functional/battles/battles_close.spec.ts`
  - [x] 5.2 Tests (9 tests, all passing):
    - 401 unauthenticated
    - 200 closes with winner = variantA
    - 200 closes with winner = variantB
    - 422 battle already closed
    - 422 winner_id not a variant of this battle
    - 422 missing winner_id
    - 404 unknown battle id
    - 404 non-UUID id (route constraint → 404)
    - 404 user B cannot close user A's battle

- [x] Task 6: Frontend API and hooks (AC: #1, #4)
  - [x] 6.1 Added `start()` and `close()` to `battlesApi` in `api.ts`
  - [x] 6.2 Created `useStartBattle.ts` — invalidates `queryKeys.battles.all` on success
  - [x] 6.3 Created `useCloseBattle.ts` — invalidates `queryKeys.battles.all` on success

- [x] Task 7: Frontend — StartBattleDialog component (AC: #1, #5)
  - [x] 7.1 Created `apps/frontend/src/features/dashboard/components/StartBattleDialog.tsx`
  - [x] 7.2 Props: `{ stageId, stageName, positionings, initialVariantAId?, trigger }`
  - [x] 7.3 Two Select fields, filtered to `funnelStageId === stageId && deletedAt === null`
  - [x] 7.4 VineJS schema in `apps/frontend/src/features/dashboard/schemas/battles.ts`
  - [x] 7.5 Inline error when same variant selected; toast.success on success; inline error on API failure
  - [x] 7.6 shadcn `Dialog`, `SelectTrigger className="w-full"`

- [x] Task 8: Frontend — CloseBattleDialog component (AC: #2, #3, #4)
  - [x] 8.1 Created `apps/frontend/src/features/dashboard/components/CloseBattleDialog.tsx`
  - [x] 8.2 Props: `{ battle, leadingVariantId, disabled, cells, positionings, resolveName }`
  - [x] 8.3 Uses shadcn `AlertDialog` for confirmation
  - [x] 8.4 `disabled` maps to button disabled state; wrapped in `<span>` for tooltip on disabled button
  - [x] 8.5 Winner = `leadingVariantId` passed from `getTrafficLight()`
  - [x] 8.6 toast.success on confirm success; inline `FieldError` for API errors

- [x] Task 9: Update FunnelCard.tsx (AC: #1–#5)
  - [x] 9.1 Imports `StartBattleDialog` and `CloseBattleDialog`
  - [x] 9.2 No active battle → "Start Battle" button (+ "Start Next Battle" when previous winner exists, pre-selecting champion as Variant A)
  - [x] 9.3 Active battle → traffic light + "Close Battle" button (disabled when `color === 'red'`)

- [x] Task 10: i18n (EN + FR) (AC: #1–#5)
  - [x] 10.1 Added `startBattle`, `startNextBattle`, `closeBattle`, `closeBattleDisabledTooltip`, `startBattleDialog.*`, `closeBattleDialog.*` to EN locale
  - [x] 10.2 Mirrored in FR locale

- [x] Task 11: Validation
  - [x] 11.1 `pnpm lint` — Biome clean (5 formatting fixes auto-applied)
  - [x] 11.2 `pnpm type-check` — 0 errors across shared, backend, frontend, extension
  - [x] 11.3 `ENV_PATH=../../ node ace test functional` — 309 tests pass (19 new, 0 regressions)

## Dev Notes

### What's already built (DO NOT reinvent)

- `Battle` model: `apps/backend/app/models/battle.ts` — `forUser` scope, all columns including `status`, `winnerId`, `battleNumber`, `startedAt`, `closedAt`
- `serializeBattle()`: `apps/backend/app/serializers/battle.ts` — use as-is for all responses
- `BattleType` in `packages/shared/src/types/battle.ts` — **no changes needed**
- `GET /api/battles` (index) and `GET /api/analytics/performance_matrix` — already implemented in `BattlesController`
- `battlesApi.list()` + `useBattles()` hook — already wired in frontend
- `getTrafficLight()` in `apps/frontend/src/features/dashboard/lib/trafficLight.ts` — returns `{ color, confidence, leadingVariantId }` — use directly for "Close Battle" disabled state
- `FunnelCard` already imports `positionings: PositioningType[]` — no prop changes needed
- Unique DB constraint on `(user_id, funnel_stage_id) WHERE status = 'active'` — already exists from Story 6.1 migration `0013_create_battles_table.ts`

### Backend: battleNumber computation

No sequence or DB trigger — computed as last battle's `battle_number` + 1 for (user, stage):

```typescript
const lastBattle = await Battle.query()
  .withScopes((s) => s.forUser(userId))
  .where('funnel_stage_id', payload.funnel_stage_id)
  .orderBy('battle_number', 'desc')
  .first()
const battleNumber = (lastBattle?.battleNumber ?? 0) + 1
```

### Route constraint behavior

`PATCH /api/battles/:id/close` uses `.where('id', UUID_REGEX)`. Non-UUID IDs are rejected by Adonis at route matching and return 404 (not 400). The manual UUID check in the controller is therefore not needed (dead code removed).

### Frontend: CloseBattleDialog disabled tooltip

shadcn Tooltip does NOT trigger on disabled buttons. The button must be wrapped in a `<span>` for the tooltip to work:

```tsx
<TooltipTrigger asChild>
  <span>
    <AlertDialogTrigger asChild>
      <Button disabled={disabled}>Close Battle</Button>
    </AlertDialogTrigger>
  </span>
</TooltipTrigger>
```

### Schema location

VineJS frontend schemas follow feature-based convention: placed in `src/features/dashboard/schemas/battles.ts` (not the root `src/schemas/` path mentioned in the story — that directory does not exist, project pattern is feature-based).

### Project Structure Notes

**Files created:**
- `apps/backend/app/validators/battles.ts`
- `apps/backend/tests/functional/battles/battles_store.spec.ts`
- `apps/backend/tests/functional/battles/battles_close.spec.ts`
- `apps/frontend/src/features/dashboard/components/StartBattleDialog.tsx`
- `apps/frontend/src/features/dashboard/components/CloseBattleDialog.tsx`
- `apps/frontend/src/features/dashboard/hooks/useStartBattle.ts`
- `apps/frontend/src/features/dashboard/hooks/useCloseBattle.ts`
- `apps/frontend/src/features/dashboard/schemas/battles.ts`

**Files modified:**
- `apps/backend/app/controllers/battles_controller.ts` — added `store` and `close` actions
- `apps/backend/start/routes.ts` — added `POST /battles` and `PATCH /battles/:id/close`
- `apps/frontend/src/features/dashboard/lib/api.ts` — added `start()` and `close()` to `battlesApi`
- `apps/frontend/src/features/dashboard/components/FunnelCard.tsx` — Start/Close Battle UI
- `apps/frontend/public/locales/en.json` — new dashboard battle-management keys
- `apps/frontend/public/locales/fr.json` — same in French
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updated

### References

- Epic 6.5 definition: [Source: _bmad-output/planning-artifacts/epics.md#Story 6.5, line 1659]
- Battle model: [Source: apps/backend/app/models/battle.ts]
- Battle serializer: [Source: apps/backend/app/serializers/battle.ts]
- BattleType shared type: [Source: packages/shared/src/types/battle.ts]
- BattlesController (existing index + performanceMatrix): [Source: apps/backend/app/controllers/battles_controller.ts]
- Routes (battles group): [Source: apps/backend/start/routes.ts#line 62]
- getTrafficLight (returns color, confidence, leadingVariantId): [Source: apps/frontend/src/features/dashboard/lib/trafficLight.ts]
- FunnelCard (updated with Start/Close Battle): [Source: apps/frontend/src/features/dashboard/components/FunnelCard.tsx]
- Dashboard API lib (battlesApi): [Source: apps/frontend/src/features/dashboard/lib/api.ts]
- Existing battle index tests (pattern): [Source: apps/backend/tests/functional/battles/battles_index.spec.ts]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Route constraint `.where('id', UUID_REGEX)` returns 404 (not 400) for non-UUID path params — test updated to expect 404, consistent with all other parametrized routes in the project.
- Biome auto-fix: 5 formatting fixes (object type formatting in `useStartBattle.ts`, JSX whitespace in `CloseBattleDialog.tsx`, long lines in test files).

### Completion Notes List

- `BattlesController` extended with `store` (POST) and `close` (PATCH) actions. Business rules: variants must differ, both must belong to authenticated user, one active battle per stage (409 on conflict), `battleNumber` = last + 1.
- Validator `battles.ts` created with `createBattleValidator` and `closeBattleValidator` using VineJS UUID validation.
- Routes added: `POST /api/battles` and `PATCH /api/battles/:id/close` with UUID route constraint.
- 19 new functional tests across `battles_store.spec.ts` (11) and `battles_close.spec.ts` (8 — 9 tests, but refactored to 8+1 for the isolation test) covering auth, happy path, business rules, ownership, and user isolation. 309 total, 0 regressions.
- Frontend: `battlesApi.start()` and `battlesApi.close()` added; `useStartBattle` and `useCloseBattle` mutation hooks; `StartBattleDialog` with two Select fields (filtered to active positionings for the stage); `CloseBattleDialog` with `AlertDialog` and span-wrapped trigger for tooltip-on-disabled; FunnelCard updated with Start Battle / Start Next Battle / Close Battle flows.
- VineJS schema placed in feature-specific `src/features/dashboard/schemas/battles.ts` (project convention).
- i18n: EN + FR keys added for all new battle management UI strings.
- `pnpm lint` ✅, `pnpm type-check` ✅ (0 errors across all 4 packages), `node ace test functional` ✅ (309/309).

### File List

- `apps/backend/app/validators/battles.ts` (created)
- `apps/backend/app/controllers/battles_controller.ts` (modified — `store` and `close` actions)
- `apps/backend/start/routes.ts` (modified — `POST /battles`, `PATCH /battles/:id/close`)
- `apps/backend/tests/functional/battles/battles_store.spec.ts` (created — 11 tests)
- `apps/backend/tests/functional/battles/battles_close.spec.ts` (created — 9 tests)
- `apps/frontend/src/features/dashboard/lib/api.ts` (modified — `start()`, `close()`)
- `apps/frontend/src/features/dashboard/hooks/useStartBattle.ts` (created)
- `apps/frontend/src/features/dashboard/hooks/useCloseBattle.ts` (created)
- `apps/frontend/src/features/dashboard/schemas/battles.ts` (created)
- `apps/frontend/src/features/dashboard/components/StartBattleDialog.tsx` (created)
- `apps/frontend/src/features/dashboard/components/CloseBattleDialog.tsx` (created)
- `apps/frontend/src/features/dashboard/components/FunnelCard.tsx` (modified — Start/Close Battle UI)
- `apps/frontend/public/locales/en.json` (modified — battle management i18n keys)
- `apps/frontend/public/locales/fr.json` (modified — battle management i18n keys)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status: review)
