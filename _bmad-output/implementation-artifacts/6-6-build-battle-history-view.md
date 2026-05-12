# Story 6.6: Build Battle History View

Status: review

## Story

As a user,
I want to see the history of Battles per funnel stage with conversion rates and a detail view,
so that I can track my optimization progress over time.

## Acceptance Criteria

1. **Given** I expand a Funnel Card / **When** past Battles exist for this stage / **Then** I see a list of historical Battles showing variant names and their current conversion rates:
   - Format: "Battle #3: Variant C beat Variant B (52% vs 41%)" — winner first
   - If a variant has no cell data: show "—" in place of the percentage
   - Battles are sorted by `battleNumber` descending (most recent first — already the case)

2. **Given** I view Battle history / **When** I click on a past Battle / **Then** a dialog opens showing:
   - Battle title: "Battle #N"
   - Start date and close date
   - Winner badge / indicator
   - Variant A: name + conversion rate (rate%, n/total)
   - Variant B: name + conversion rate (rate%, n/total)
   - If no cell data for a variant: show "No data"

3. **Given** a funnel stage has closed Battles but no active Battle / **When** I view the Funnel Card header / **Then** the status line reads "Battle #N closed — winner: [winner]" (includes battle number so iteration depth is visible at a glance)

## Tasks / Subtasks

- [x] Task 1: Update FunnelCard battle history section (AC: #1, #3)
  - [x] 1.1 Add a `resolveCellRate(positioningId: string): string` helper inside `FunnelCard` that looks up `stageCells.find(c => c.positioningId === id)` and returns `"${(rate * 100).toFixed(0)}%"` or `"—"` when not found
  - [x] 1.2 Update the history list items to call `BattleDetailDialog` as a wrapper — each `<li>` becomes a clickable trigger
  - [x] 1.3 Update `renderBattleStatus()` closed-battle branch: change `t('dashboard.battleClosed', { winner })` to also pass `n: lastClosed.battleNumber` (update i18n key in Task 3)
  - [x] 1.4 No changes to `FunnelCardProps` — all data already available

- [x] Task 2: Create BattleDetailDialog component (AC: #2)
  - [x] 2.1 Create `apps/frontend/src/features/dashboard/components/BattleDetailDialog.tsx`
  - [x] 2.2 Props:
    ```ts
    interface BattleDetailDialogProps {
      battle: BattleType
      cells: ConversionCellType[]
      resolveName: (id: string) => string
      children: React.ReactNode  // trigger element
    }
    ```
  - [x] 2.3 Use shadcn `Dialog` (not `AlertDialog` — no destructive action)
  - [x] 2.4 Rate lookup inside component: `cells.find(c => c.positioningId === id && c.funnelStageId === battle.funnelStageId)` — returns `undefined` when no data
  - [x] 2.5 Display layout (inside `DialogContent`):
    - `DialogHeader` → `DialogTitle`: "Battle #{{n}}"
    - Dates row: `t('dashboard.battleDetailDialog.started', { date: ... })` + `t('dashboard.battleDetailDialog.closed', { date: ... })` — use `new Date(date).toLocaleDateString()`; `closedAt` may be null for active battles (guard with `battle.closedAt ?`)
    - Winner row (if `battle.winnerId`): badge/indicator showing winner name
    - Two variant rows: name + rate string `"${(rate*100).toFixed(0)}% (${n}/${total})"` or `t('dashboard.battleDetailDialog.noData')`
    - Winner variant highlighted (e.g., `font-semibold` or winner badge next to name)
  - [x] 2.6 `DialogTrigger asChild` wrapping `children`

- [x] Task 3: i18n updates — EN + FR (AC: #1, #2, #3)
  - [x] 3.1 Update `dashboard.battleHistoryItem`:
    - EN: `"Battle #{{n}}: {{a}} vs {{b}} → {{winner}} ({{rateA}} vs {{rateB}})"`
    - FR: `"Battle #{{n}} : {{a}} vs {{b}} → {{winner}} ({{rateA}} vs {{rateB}})"`
    - Pass `rateA` and `rateB` as the percentage strings (e.g. `"52%"` or `"—"`)
  - [x] 3.2 Update `dashboard.battleClosed` to include battle number:
    - EN: `"Battle #{{n}} closed — winner: {{winner}}"`
    - FR: `"Battle #{{n}} clôturée — gagnant : {{winner}}"`
  - [x] 3.3 Add `dashboard.battleDetailDialog.*` keys:
    - EN: `title: "Battle #{{n}}"`, `started: "Started: {{date}}"`, `closed: "Closed: {{date}}"`, `winner: "Winner"`, `noData: "No data"`
    - FR: `title: "Battle #{{n}}"`, `started: "Démarrée le : {{date}}"`, `closed: "Clôturée le : {{date}}"`, `winner: "Gagnant"`, `noData: "Aucune donnée"`

- [x] Task 4: Validation
  - [x] 4.1 `pnpm lint` — Biome clean (0 fixes, 271 files)
  - [x] 4.2 `pnpm type-check` — 0 errors across all workspaces (shared, backend, frontend, extension)
  - [x] 4.3 Manual UI verification: pending — no E2E tests for this story per project pattern (Playwright E2E scaffolded but deferred)

## Dev Notes

### What's already built — DO NOT reinvent

- **FunnelCard.tsx** (`apps/frontend/src/features/dashboard/components/FunnelCard.tsx`):
  - Already has `closedBattles` (battles filtered for this stage, sorted by `battleNumber` desc)
  - Already has `stageCells` (cells filtered for this stage)
  - Already has `resolveName(id)` helper using `getPositioningName()`
  - History section at lines 231–249 renders a `<ul>` of closed battles — just needs rate injection + click handler
  - `renderBattleStatus()` already handles active/closed/none states

- **DashboardPage.tsx** already passes `cells`, `battles`, and `positionings` (with `include_archived: true`) to each FunnelCard — no new queries or props needed

- **BattleType** (`packages/shared/src/types/battle.ts`): `id, userId, funnelStageId, variantAId, variantBId, battleNumber, status, winnerId, startedAt, closedAt, createdAt, updatedAt` — no changes needed

- **ConversionCellType** (from `@battlecrm/shared`): `positioningId, positioningName, funnelStageId, funnelStageName, rate, numerator, denominator, confidenceLevel` — use `rate`, `numerator`, `denominator` for rate display

- **Existing shadcn components installed**: `dialog`, `badge`, `button`, `card`, `tooltip` — all usable for `BattleDetailDialog`

- **Date formatting pattern**: `new Date(isoString).toLocaleDateString()` — consistent with `TimelineItem.tsx` and `InteractionRow.tsx`

### Rate display in history — important data model note

The `cells` from `GET /api/analytics/performance_matrix` return **current aggregate rates** (all time), NOT rates frozen at battle close time. This is intentional for Story 6.6 — there is no "snapshot at close" mechanism in the DB (no extra columns on the battles table). The displayed rates represent the CUMULATIVE performance of a variant at that stage across all battles.

Lookup pattern in FunnelCard:
```tsx
function resolveCellRate(positioningId: string): string {
  const cell = stageCells.find((c) => c.positioningId === positioningId)
  if (!cell) return '—'
  return `${(cell.rate * 100).toFixed(0)}%`
}
```

In `BattleDetailDialog`, the lookup must also filter by `funnelStageId` (since `cells` prop is the FULL matrix, not stage-filtered):
```tsx
const cell = cells.find(
  (c) => c.positioningId === positioningId && c.funnelStageId === battle.funnelStageId
)
```

### i18n interpolation for history items

The updated `battleHistoryItem` key uses `rateA` and `rateB` interpolation values. Compute them in FunnelCard before calling `t()`:

```tsx
{closedBattles.map((battle) => (
  <BattleDetailDialog key={battle.id} battle={battle} cells={cells} resolveName={resolveName}>
    <li className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
      {t('dashboard.battleHistoryItem', {
        n: battle.battleNumber,
        a: resolveName(battle.variantAId),
        b: resolveName(battle.variantBId),
        winner: battle.winnerId ? resolveName(battle.winnerId) : '—',
        rateA: resolveCellRate(battle.variantAId),
        rateB: resolveCellRate(battle.variantBId),
      })}
    </li>
  </BattleDetailDialog>
))}
```

### BattleDetailDialog structure

No mutation, no form — pure read display. Use `Dialog` (not `AlertDialog`). The trigger is `children` (list item). No `onConfirm` callback needed.

```tsx
<Dialog>
  <DialogTrigger asChild>{children}</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{t('dashboard.battleDetailDialog.title', { n: battle.battleNumber })}</DialogTitle>
    </DialogHeader>
    {/* dates, winner, variant rows */}
  </DialogContent>
</Dialog>
```

### renderBattleStatus() update for AC3

Change the closed-battle branch:
```tsx
// Before:
{t('dashboard.battleClosed', { winner: resolveName(lastClosed.winnerId) })}

// After:
{t('dashboard.battleClosed', { n: lastClosed.battleNumber, winner: resolveName(lastClosed.winnerId) })}
```

### Project Structure Notes

- New file: `apps/frontend/src/features/dashboard/components/BattleDetailDialog.tsx` — follows the existing `CloseBattleDialog.tsx` / `StartBattleDialog.tsx` co-location pattern
- No new hooks, no new API calls, no backend changes
- Imports in new component: `BattleType`, `ConversionCellType` from `@battlecrm/shared`; shadcn `Dialog*` from `@/components/ui/dialog`; `useTranslation` from `react-i18next`

### References

- FunnelCard (history section, renderBattleStatus): [Source: apps/frontend/src/features/dashboard/components/FunnelCard.tsx]
- BattleType: [Source: packages/shared/src/types/battle.ts]
- ConversionCellType: [Source: packages/shared/src/types/analytics.ts] (check exact path)
- DashboardPage (data flow): [Source: apps/frontend/src/features/dashboard/DashboardPage.tsx]
- EN locale (existing battle keys at lines ~64–95): [Source: apps/frontend/public/locales/en.json]
- FR locale: [Source: apps/frontend/public/locales/fr.json]
- Date formatting pattern: [Source: apps/frontend/src/features/interactions/components/TimelineItem.tsx:75]
- CloseBattleDialog (Dialog usage reference): [Source: apps/frontend/src/features/dashboard/components/CloseBattleDialog.tsx]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- No backend changes required — all data (battles + cells + positionings) already loaded in DashboardPage and passed as props to FunnelCard.
- `resolveCellRate` in FunnelCard uses `stageCells` (already stage-filtered), while `BattleDetailDialog.getCell()` must filter by both `positioningId` AND `funnelStageId` (receives unfiltered `cells` prop).
- `battleClosed` i18n key updated to include `{{n}}` — all callers of this key in FunnelCard updated accordingly.

### Completion Notes List

- `BattleDetailDialog.tsx` created: pure-display Dialog component showing battle number, start/close dates, winner badge, and both variant rates from current `cells` data. `DialogTrigger asChild` wraps the `children` prop (list item).
- `FunnelCard.tsx` updated: added `resolveCellRate()` helper; history items wrapped with `BattleDetailDialog`; `rateA`/`rateB` interpolated in `battleHistoryItem` translation; `renderBattleStatus()` closed-battle branch now passes `n: lastClosed.battleNumber` for AC3.
- i18n: `battleHistoryItem` and `battleClosed` updated in EN + FR; `battleDetailDialog.*` section added to both locales.
- `pnpm lint` ✅ (Biome, 0 fixes), `pnpm type-check` ✅ (0 errors across 4 workspaces).

### File List

- `apps/frontend/src/features/dashboard/components/BattleDetailDialog.tsx` (created)
- `apps/frontend/src/features/dashboard/components/FunnelCard.tsx` (modified — resolveCellRate helper, BattleDetailDialog integration, renderBattleStatus n param)
- `apps/frontend/public/locales/en.json` (modified — battleHistoryItem, battleClosed, battleDetailDialog keys)
- `apps/frontend/public/locales/fr.json` (modified — battleHistoryItem, battleClosed, battleDetailDialog keys)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status: review)
