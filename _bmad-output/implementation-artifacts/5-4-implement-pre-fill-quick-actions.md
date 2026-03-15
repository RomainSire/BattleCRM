# Story 5.4: Implement Pre-fill & Quick Actions

Status: done

## Story

As a user,
I want forms to pre-fill intelligently,
So that I can log interactions with minimal typing.

## Acceptance Criteria

1. **AC1 (Last prospect pre-fill):** When opening `AddInteractionDialog` without an `initialProspectId` (generic Log Interaction trigger, not from a specific prospect context), the last prospect used in a successful interaction is pre-selected. The pre-fill comes from localStorage and is validated against the loaded prospects list. (FR27, NFR43)

2. **AC2 (Last positioning pre-fill):** When a prospect is pre-selected and its funnel stage has positionings, the positioning field defaults to the last positioning used for that funnel stage — retrieved from a per-stage localStorage map. If the stored positioning no longer exists in the list, the field falls back to "No positioning". (FR27, NFR43)

3. **AC3 (Save pre-fill context):** On every successful interaction creation, `lastProspectId` and `{ [funnelStageId]: positioningId }` are written to localStorage, so the next form open starts pre-filled. Only a truthy positioningId (not `'none'`) is stored per stage.

4. **AC4 (Quick-action "Log Interaction" button on ProspectRow):** Each active prospect row in the list view shows a "Log Interaction" icon button directly in the row header (not inside the accordion content). Clicking it opens `AddInteractionDialog` pre-filled with that prospect. This button does NOT expand the accordion. Archived prospects do NOT show this quick-action button.

5. **AC5 (3 clicks max from Prospects list):** From the Prospects list view, a user can log an interaction in 3 clicks: (1) click the quick-action button on a row → prospect pre-filled, (2) click a status toggle (Positive/Pending/Negative), (3) click Save.

6. **AC6 (ProspectRow valid HTML structure):** The quick-action button must not be nested inside the expand trigger. Implementation: ProspectRow was refactored from Accordion to shadcn Table (`Table/TableRow/TableCell`). The expand toggle is a `<tr aria-expanded>` with `onClick`, the quick-action `<Button>` is a sibling `<TableCell onClick={e.stopPropagation()}>`. No nested interactive elements. PositioningRow and PositioningsList were also migrated to Table (bonus, out of scope).

7. **AC7 (No regressions):** ProspectRow accordion expand/collapse, ProspectDetail "Log Interaction" button, and all existing interaction logging behavior from Story 5.3 continue to work unchanged.

8. **AC8 (Lint + type-check):** `pnpm biome check --write .` from root — 0 errors. `pnpm --filter @battlecrm/frontend type-check` — 0 errors.

## Tasks / Subtasks

- [x] **Task 1: localStorage pre-fill hook** (AC1, AC2, AC3)
  - [x] 1.1 Create `apps/frontend/src/features/interactions/hooks/useLastInteractionContext.ts` — hook exposing `lastProspectId`, `getLastPositioningForStage(stageId)`, `saveContext(prospectId, funnelStageId?, positioningId?)`
  - [x] 1.2 Define localStorage keys as module-level constants: `LAST_PROSPECT_KEY = 'battlecrm_last_prospect_id'`, `LAST_POSITIONING_KEY = 'battlecrm_last_positioning_by_stage'`

- [x] **Task 2: Update AddInteractionDialog for pre-fill** (AC1, AC2, AC3)
  - [x] 2.1 Import `useLastInteractionContext` and call it at the top of the component
  - [x] 2.2 Change initial `selectedProspectId` state: `useState(initialProspectId ?? lastProspectId ?? '')`
  - [x] 2.3 After positionings load: if `selectedPositioningId === 'none'` AND `getLastPositioningForStage(funnelStageId)` matches a loaded positioning → set it (via `useEffect` with dependencies `[positioningsLoading, positionings]`)
  - [x] 2.4 In `onSuccess` callback: call `saveContext(selectedProspectId, selectedProspect?.funnelStageId, selectedPositioningId)` BEFORE calling `resetAll()`
  - [x] 2.5 Reset must NOT save to localStorage — `resetAll()` remains as-is (no localStorage write on reset)

- [x] **Task 3: Add quick-action button + Table refactor** (AC4, AC5, AC6, AC7)
  - [x] 3.1 ProspectsList + ProspectRow migrated from `Accordion` to shadcn `Table` (avoids nested-button HTML issue entirely, better responsive layout)
  - [x] 3.2 `ProspectRow` returns a React fragment of two `<TableRow>`: main row with `aria-expanded` + `onClick={onToggle}`, and a conditional expanded row with `colSpan={6}`
  - [x] 3.3 Quick-action `AddInteractionDialog` is in a dedicated last `<TableCell onClick={e.stopPropagation()}>` — valid HTML, no nesting inside trigger
  - [x] 3.4 `ProspectsList` manages `expandedId` state, passes `isExpanded/onToggle` to each `ProspectRow` — expand/collapse works, only one row open at a time
  - [x] 3.5 **Bonus (hors scope, demande utilisateur):** PositioningsList + PositioningRow migrated to same Table pattern; KanbanCard quick-action button added with Tooltip; AppNavbar logo added; AddInteractionDialog `DialogContent onClick stopPropagation` bug fixed; 6 E2E test files updated (accordion → table selectors)

- [x] **Task 4: Lint + type-check** (AC8)
  - [x] 4.1 `pnpm biome check --write .` from monorepo root — 0 errors (170 files checked)
  - [x] 4.2 `pnpm --filter @battlecrm/frontend type-check` — 0 errors

## Dev Notes

### CRITICAL: Valid HTML — No Nested Buttons (resolved via Table refactor)

The original plan was to use `AccordionPrimitive.Header/Trigger` to place the quick-action button as a sibling. **The implemented solution is better:** ProspectRow/ProspectsList were fully migrated to shadcn `Table`, eliminating the Accordion entirely. This avoids the nested-button problem at the HTML structure level.

**Final ProspectRow structure:**

```tsx
// Two <TableRow> fragments per prospect
<>
  <TableRow onClick={onToggle} aria-expanded={isExpanded} className="cursor-pointer">
    <TableCell className="w-8 pr-0"><ChevronDown className={cn('...', isExpanded && 'rotate-180')} /></TableCell>
    <TableCell className="font-medium">{prospect.name}</TableCell>
    <TableCell>{prospect.company ?? '—'}</TableCell>
    <TableCell>{stageName ?? '—'}</TableCell>
    <TableCell>{prospect.email ?? '—'}</TableCell>
    <TableCell onClick={(e) => e.stopPropagation()}>
      {!isArchived && <AddInteractionDialog initialProspectId={prospect.id} trigger={<Button ...><Plus /></Button>} />}
    </TableCell>
  </TableRow>
  {isExpanded && (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={6} className="p-0">
        <div className="bg-muted/30"><ProspectDetail prospect={prospect} /></div>
      </TableCell>
    </TableRow>
  )}
</>
```

**`expandedId` managed in ProspectsList** — `toggleExpanded(id)` sets `expandedId` to `id` or `null` (only one row open at a time). Passed as `isExpanded/onToggle` props to ProspectRow.

**E2E test selectors updated:** `button[aria-expanded]` → `tr[aria-expanded]` across 6 test files (accordion → table migration).

---

### Task 1: useLastInteractionContext Hook

**`apps/frontend/src/features/interactions/hooks/useLastInteractionContext.ts`** (NEW):

```typescript
const LAST_PROSPECT_KEY = 'battlecrm_last_prospect_id'
const LAST_POSITIONING_KEY = 'battlecrm_last_positioning_by_stage'

export function useLastInteractionContext() {
  const lastProspectId = localStorage.getItem(LAST_PROSPECT_KEY) ?? undefined

  function getLastPositioningForStage(stageId: string): string | undefined {
    try {
      const stored = localStorage.getItem(LAST_POSITIONING_KEY)
      if (!stored) return undefined
      const map = JSON.parse(stored) as Record<string, string>
      return map[stageId]
    } catch {
      return undefined
    }
  }

  function saveContext(prospectId: string, funnelStageId?: string, positioningId?: string) {
    localStorage.setItem(LAST_PROSPECT_KEY, prospectId)
    if (funnelStageId) {
      try {
        const stored = localStorage.getItem(LAST_POSITIONING_KEY)
        const map: Record<string, string> = stored ? (JSON.parse(stored) as Record<string, string>) : {}
        if (positioningId && positioningId !== 'none') {
          map[funnelStageId] = positioningId
        } else {
          delete map[funnelStageId]
        }
        localStorage.setItem(LAST_POSITIONING_KEY, JSON.stringify(map))
      } catch {
        // ignore write failures silently
      }
    }
  }

  return { lastProspectId, getLastPositioningForStage, saveContext }
}
```

**No re-renders needed** — `localStorage` reads are synchronous and happen at hook call time (component mount). No state or effect needed for reading.

---

### Task 2: AddInteractionDialog Updates

**Key changes to `apps/frontend/src/features/interactions/components/AddInteractionDialog.tsx`:**

**1. Import and call the hook:**
```tsx
import { useLastInteractionContext } from '../hooks/useLastInteractionContext'

// Inside component:
const { lastProspectId, getLastPositioningForStage, saveContext } = useLastInteractionContext()
```

**2. Pre-fill last prospect (initial state change):**
```tsx
// BEFORE:
const [selectedProspectId, setSelectedProspectId] = useState(initialProspectId ?? '')

// AFTER — falls back to lastProspectId from localStorage when no initialProspectId:
const [selectedProspectId, setSelectedProspectId] = useState(initialProspectId ?? lastProspectId ?? '')
```

**IMPORTANT:** `lastProspectId` is read from localStorage at hook call time. When `AddInteractionDialog` renders (not yet open), `lastProspectId` is already available. When the dialog opens, `selectedProspectId` is already set. When prospects load, we validate — if the stored ID doesn't exist in the list, `selectedProspect` stays `undefined` and no stage context is shown (graceful degradation — no error needed).

**3. Pre-fill last positioning (useEffect after positionings load):**
```tsx
// After positionings load, auto-select last used positioning for this stage if not already set:
useEffect(() => {
  if (positioningsLoading || selectedPositioningId !== 'none' || !selectedProspect?.funnelStageId) return
  const lastId = getLastPositioningForStage(selectedProspect.funnelStageId)
  if (!lastId) return
  const found = positionings.find((p) => p.id === lastId)
  if (found) {
    setSelectedPositioningId(lastId)
  }
}, [positioningsLoading, positionings, selectedProspect?.funnelStageId])
// Intentionally not including selectedPositioningId or getLastPositioningForStage in deps
// to avoid re-running when user manually changes positioning
```

**4. Save context on success:**
```tsx
// In onSubmit, inside create.mutate onSuccess callback, BEFORE resetAll():
onSuccess: () => {
  // Save pre-fill context for next interaction
  saveContext(
    selectedProspectId,
    selectedProspect?.funnelStageId,
    selectedPositioningId,
  )
  resetAll()
  setOpen(false)
  toast.success(t('interactions.toast.created'))
},
```

**`resetAll()` must NOT save to localStorage** — it already restores to `initialProspectId ?? ''` (initial state). No change to `resetAll()`.

---

### Task 3: ProspectRow + ProspectsList Table Refactor

**`apps/frontend/src/features/prospects/components/ProspectRow.tsx`** (MODIFIED):

Imports:
```typescript
import type { ProspectType } from '@battlecrm/shared'
import { ChevronDown, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AddInteractionDialog } from '@/features/interactions/components/AddInteractionDialog'
import { cn } from '@/lib/utils'
import { ProspectDetail } from './ProspectDetail'
```

Props interface: `{ prospect, stageName, isExpanded: boolean, onToggle: () => void }`

**`apps/frontend/src/features/prospects/components/ProspectsList.tsx`** (MODIFIED):

Uses `Table/TableHeader/TableBody/TableRow/TableHead` from shadcn. Manages `expandedId` state with `toggleExpanded(id)` function.

---

### Known Gotchas and Traps

1. **`selectedProspectId` initial value from localStorage:** The stored ID may reference a prospect that was archived or deleted. `prospects.find((p) => p.id === selectedProspectId)` returning `undefined` is the correct graceful degradation — the dropdown shows nothing selected, the user must pick manually.

2. **useEffect dependency warning:** The linter/Biome may warn about missing dependencies in the positioning pre-fill `useEffect`. The intentional omission of `selectedPositioningId` and `getLastPositioningForStage` from deps prevents re-running when the user manually changes the positioning (which would reset it). `biome-ignore lint/correctness/useExhaustiveDependencies` comment added.

3. **`'none'` sentinel value in positioning Select:** Uses `'none'` as the shadcn Select value for "No positioning" (not `''`). The `useEffect` guards on `selectedPositioningId !== 'none'` correctly.

4. **React portal event bubbling (Dialog inside Card):** Radix Dialog content is rendered in a portal but React synthetic events bubble through the React tree, not the DOM tree. When `AddInteractionDialog` is used inside a clickable container (KanbanCard, ProspectRow), clicks inside the dialog (Cancel, Save, etc.) bubble up to the parent's `onClick`. Fix: `<DialogContent onClick={(e) => e.stopPropagation()}>`.

5. **Tooltip + Dialog nested Radix `asChild`:** `TooltipTrigger asChild` wrapping a button that is itself the `DialogTrigger asChild` child works correctly — Radix Slot merges props (dialog onClick + tooltip mouse events) onto the final button element.

6. **shadcn Table cannot combine with Accordion** — incompatible HTML structures (`<table><tr><td>` vs `<div>`). The Table approach eliminates Accordion entirely.

7. **`useLastInteractionContext` is a real React hook** — uses `useCallback` for stable function references. Don't call it conditionally or outside component render.

---

### Project Structure Notes

**New file:**
```
apps/frontend/src/features/interactions/hooks/useLastInteractionContext.ts  (new)
```

**Modified files:**
```
apps/frontend/src/features/interactions/components/AddInteractionDialog.tsx  (pre-fill logic)
apps/frontend/src/features/prospects/components/ProspectRow.tsx              (quick-action button)
```

**No new routes, no new pages, no backend changes.** This is a pure frontend story.

**No new translations needed** — `t('interactions.addInteraction')` already exists (added in Story 5.3, value: "Log Interaction" / "Journaliser une interaction").

**No new shared types** — `InteractionType`, `CreateInteractionPayload` from Story 5.1 covers all needs.

**No new backend endpoints** — `POST /api/interactions` from Story 5.2 is used as-is.

---

### Previous Story Intelligence (Story 5.3)

Key learnings from Story 5.3:

- `AddInteractionDialog` uses `'none'` (NOT `''`) as the sentinel value for "No positioning" in the shadcn Select (avoids controlled/uncontrolled issues)
- `useFunnelStages()` is imported and used to display the current stage name below the prospect select — `const currentStage = stages.find((s) => s.id === selectedProspect?.funnelStageId)`
- `usePositionings` is called with `{ enabled: !!selectedProspect?.funnelStageId }` to skip the query when no prospect is selected
- `ToggleGroup onValueChange` guards: `if (value) setSelectedStatus(value)` — prevents deselection
- Completion note: "ProspectType does not include `funnelStageName` — stage name resolved via `useFunnelStages()` by matching `selectedProspect.funnelStageId`"
- The existing `AddInteractionDialog` uses `initialProspectId` to pre-select the prospect. This continues to work — `useState(initialProspectId ?? lastProspectId ?? '')` is backward compatible.
- Story 5.3 completion note confirms `selectedPositioningId` uses `'none'` (not `''`)

---

### Git Intelligence Summary

Relevant recent commits:
- `51d0bec` — feat(interactions): add loading state to prospect selection and improve interaction creation logic — the `useFunnelStages()` dependency was added here (not in the original story plan), and `{ enabled: !!selectedProspect?.funnelStageId }` option added to `usePositionings`
- `fc8a2e3` — feat(interactions): implement interaction logging form — original `AddInteractionDialog` implementation

**Pattern confirmed:** localStorage already used in `ProspectsPage.tsx` for view mode persistence (key: `PROSPECTS_VIEW_KEY`). No abstraction layer — direct `localStorage.getItem/setItem` calls.

---

### References

- [Source: apps/frontend/src/features/interactions/components/AddInteractionDialog.tsx] — Current implementation to modify (pre-fill logic)
- [Source: apps/frontend/src/features/prospects/components/ProspectRow.tsx] — Current accordion structure to refactor
- [Source: apps/frontend/src/features/prospects/ProspectsPage.tsx#localStorage] — Existing localStorage pattern (view mode)
- [Source: apps/frontend/src/lib/queryKeys.ts] — `queryKeys.interactions.all` already exists (no changes needed)
- [Source: packages/shared/src/types/interaction.ts] — `InteractionType.prospectFunnelStageId` (camelCase, Lucid serialization)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4] — ACs and FRs (FR27, NFR43)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Effortless Interactions] — "Dernier prospect pré-rempli", "3 clics max" UX rules
- [Source: _bmad-output/project-context.md] — Error handling rules, tech stack, feature-based structure

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Import fix: `@radix-ui/react-accordion` not directly installed in frontend — project uses unified `radix-ui` package. Fixed import to `import { Accordion as AccordionPrimitive } from 'radix-ui'`, matching the pattern in `apps/frontend/src/components/ui/accordion.tsx`.

### Completion Notes List

- `useLastInteractionContext` is a proper React hook using `useCallback` for stable function references. Reads localStorage synchronously at call-time. `saveContext` wraps ALL localStorage writes in a single try-catch (including `LAST_PROSPECT_KEY`) to prevent QuotaExceededError from breaking the `onSuccess` handler.
- `AddInteractionDialog`: `useState(initialProspectId ?? lastProspectId ?? '')` — `initialProspectId` takes priority. `lastProspectId` is the fallback. If the stored ID doesn't exist in prospects list, graceful degradation (user must select manually).
- Positioning pre-fill via `useEffect` with intentional dep omission (`biome-ignore` comment added) — only fires when positionings load and positioning is still at default `'none'`. Does NOT re-fire when user manually changes positioning.
- `saveContext` called BEFORE `resetAll()` in onSuccess — captures the values before they're cleared.
- **ProspectRow/ProspectsList fully migrated to shadcn Table** (Accordion removed). `ProspectRow` is a React fragment of two `<TableRow>`. `isExpanded/onToggle` props replace accordion's `value/onValueChange`. Expand state managed by `expandedId` in `ProspectsList`.
- **PositioningRow/PositioningsList also migrated to Table** (hors scope, demande utilisateur). Same pattern: `isExpanded/onToggle` props, two-row fragment.
- **`AddInteractionDialog` `DialogContent` bug fixed:** `onClick={(e) => e.stopPropagation()}` added to prevent React portal event bubbling from triggering parent card/row `onClick` (notably KanbanCard drawer).
- **KanbanCard** quick-action button added with Tooltip (hors scope). `!overlay` guard prevents dialog appearing during drag.
- **AppNavbar** logo SVG added (hors scope).
- 6 E2E test files updated: `button[aria-expanded]` → `tr[aria-expanded]`, accordion slot selectors removed.
- 106/106 E2E tests pass. Biome 0 errors, TypeScript 0 errors.

### File List

**In-scope (Story 5.4):**
- `apps/frontend/src/features/interactions/hooks/useLastInteractionContext.ts` (created — `useCallback`, unified try-catch for all localStorage writes)
- `apps/frontend/src/features/interactions/components/AddInteractionDialog.tsx` (modified — pre-fill logic, useEffect for positioning, saveContext on success, `DialogContent onClick stopPropagation` bug fix)
- `apps/frontend/src/features/prospects/components/ProspectsList.tsx` (modified — Accordion removed, shadcn Table, `expandedId` state, passes `isExpanded/onToggle` to rows)
- `apps/frontend/src/features/prospects/components/ProspectRow.tsx` (modified — Accordion removed, two-`TableRow` fragment, quick-action button in dedicated `TableCell`, Tooltip added)

**Bonus / hors scope (demande utilisateur):**
- `apps/frontend/src/features/positionings/components/PositioningsList.tsx` (modified — same Table migration as ProspectsList)
- `apps/frontend/src/features/positionings/components/PositioningRow.tsx` (modified — same Table migration as ProspectRow, Accordion removed)
- `apps/frontend/src/features/prospects/components/KanbanCard.tsx` (modified — quick-action "Log Interaction" button with Tooltip, `!overlay` guard)
- `apps/frontend/src/components/common/AppNavbar.tsx` (modified — BattleCRM_logo.svg added before app name)
- `tests/e2e/interactions-prefill.spec.ts` (created — AC2/AC3/AC4/AC5 E2E coverage)
- `tests/e2e/prospects-list.spec.ts` (modified — `button[aria-expanded]` → `tr[aria-expanded]`)
- `tests/e2e/prospects-archive.spec.ts` (modified — `button[aria-expanded]` → `tr[aria-expanded]`)
- `tests/e2e/prospects-crud.spec.ts` (modified — `button[aria-expanded]` → `tr[aria-expanded]`)
- `tests/e2e/positionings-list.spec.ts` (modified — `button[aria-expanded]` → `tr[aria-expanded]`, accordion slot selectors → `td[colspan]`)
- `tests/e2e/positionings-archive.spec.ts` (modified — `button[aria-expanded]` → `tr[aria-expanded]`)
- `tests/e2e/positionings-crud.spec.ts` (modified — `button[aria-expanded]` → `tr[aria-expanded]`)
