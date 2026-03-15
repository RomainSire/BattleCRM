# Story 5.4: Implement Pre-fill & Quick Actions

Status: review

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

6. **AC6 (ProspectRow valid HTML structure):** The quick-action button must be a sibling to the `AccordionTrigger` button, NOT nested inside it. Use `@radix-ui/react-accordion` primitives (`AccordionPrimitive.Header`, `AccordionPrimitive.Trigger`) directly to control the layout. The accordion expand/collapse animation (ChevronDown rotate) must be preserved.

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

- [x] **Task 3: Restructure ProspectRow for quick-action button** (AC4, AC5, AC6, AC7)
  - [x] 3.1 Import `{ Accordion as AccordionPrimitive } from 'radix-ui'` (unified package used by this project) and `ChevronDown, Plus from 'lucide-react'`
  - [x] 3.2 Import `AddInteractionDialog` from `@/features/interactions/components/AddInteractionDialog`
  - [x] 3.3 Replaced `<AccordionTrigger>` with `<AccordionPrimitive.Header className="flex items-center">` containing:
    - `<AccordionPrimitive.Trigger className="group ...">` with the same row content + ChevronDown (`group-data-[state=open]:rotate-180`)
    - `<div className="flex items-center pr-4">` sibling with `AddInteractionDialog` quick-action button (only for non-archived prospects)
  - [x] 3.4 Accordion expand/collapse works — Radix manages state via AccordionItem value, no regression

- [x] **Task 4: Lint + type-check** (AC8)
  - [x] 4.1 `pnpm biome check --write .` from monorepo root — 0 errors (170 files checked)
  - [x] 4.2 `pnpm --filter @battlecrm/frontend type-check` — 0 errors

## Dev Notes

### CRITICAL: Valid HTML — No Nested Buttons

`AccordionTrigger` from shadcn renders as a `<button>`. You CANNOT nest another `<button>` inside it. The quick-action "Log Interaction" button MUST be a **sibling** to the trigger, not a child.

**Use `@radix-ui/react-accordion` primitives directly in ProspectRow:**

```tsx
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { AddInteractionDialog } from '@/features/interactions/components/AddInteractionDialog'

export function ProspectRow({ prospect, stageName }: ProspectRowProps) {
  const { t } = useTranslation()
  const isArchived = prospect.deletedAt !== null

  return (
    <AccordionItem value={prospect.id}>
      <AccordionPrimitive.Header className="flex items-center">
        {/* Expand trigger — full row width minus quick-action area */}
        <AccordionPrimitive.Trigger
          className={cn(
            'group flex flex-1 items-center px-4 py-3 hover:bg-accent',
            isArchived && 'opacity-60',
          )}
        >
          <span className={cn('min-w-0 flex-1 truncate font-medium', isArchived && 'line-through text-muted-foreground')}>
            {prospect.name}
          </span>
          <span className="w-40 shrink-0 truncate text-sm text-muted-foreground">
            {prospect.company ?? '—'}
          </span>
          <span className="w-40 shrink-0 truncate text-sm">
            {isArchived ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {t('prospects.archived')}
              </span>
            ) : (
              stageName ?? '—'
            )}
          </span>
          <span className="w-48 shrink-0 truncate text-sm text-muted-foreground">
            {prospect.email ?? '—'}
          </span>
          <ChevronDown className="ml-2 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </AccordionPrimitive.Trigger>

        {/* Quick-action: sibling button outside trigger (valid HTML) */}
        {!isArchived && (
          <div className="flex items-center pr-4">
            <AddInteractionDialog
              initialProspectId={prospect.id}
              trigger={
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={t('interactions.addInteraction')}
                >
                  <Plus className="size-4" />
                </Button>
              }
            />
          </div>
        )}
      </AccordionPrimitive.Header>

      <AccordionContent className="p-0">
        <div className="border-t bg-muted/30">
          <ProspectDetail prospect={prospect} />
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
```

**ChevronDown animation replication:** The original `AccordionTrigger` from shadcn uses `data-[state=open]:rotate-180`. When using `AccordionPrimitive.Trigger` directly, add `className="group"` on the trigger and `group-data-[state=open]:rotate-180` on the ChevronDown. Radix automatically sets `data-state="open"` on the trigger when the item is expanded.

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

### Task 3: ProspectRow Refactor

**`apps/frontend/src/features/prospects/components/ProspectRow.tsx`** (MODIFIED):

Import additions needed:
```typescript
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddInteractionDialog } from '@/features/interactions/components/AddInteractionDialog'
```

Remove import of `AccordionTrigger` (replaced by `AccordionPrimitive.Trigger`). Keep `AccordionContent`, `AccordionItem` from `@/components/ui/accordion`.

**Biome import order for ProspectRow:**
1. `@battlecrm/shared` (scoped `@` packages)
2. External packages (`@radix-ui/react-accordion`, `lucide-react`, `react-i18next`)
3. `@/components/ui/*` (alphabetical: `accordion`, `button`)
4. `@/features/*` (alphabetical: `interactions/...`)
5. `@/lib/*`
6. Relative `./ProspectDetail`

---

### Known Gotchas and Traps

1. **`@radix-ui/react-accordion` is already installed** — shadcn accordion uses it as a peer dependency. No `pnpm add` needed. Import directly: `import * as AccordionPrimitive from '@radix-ui/react-accordion'`

2. **ChevronDown animation with raw primitive:** The shadcn `AccordionTrigger` adds `data-[state=open]:rotate-180` on the SVG. When using `AccordionPrimitive.Trigger`, add `className="group"` to the trigger and `group-data-[state=open]:rotate-180` to the ChevronDown. The `data-state` attribute is automatically set by Radix on the trigger element.

3. **`selectedProspectId` initial value from localStorage:** The stored ID may reference a prospect that was archived or deleted. `prospects.find((p) => p.id === selectedProspectId)` returning `undefined` is the correct graceful degradation — the dropdown shows nothing selected, the user must pick manually.

4. **useEffect dependency warning:** The linter/Biome may warn about missing dependencies in the positioning pre-fill `useEffect`. The intentional omission of `selectedPositioningId` and `getLastPositioningForStage` from deps prevents re-running when the user manually changes the positioning (which would reset it). Add a biome-ignore comment if needed: `// biome-ignore lint/correctness/useExhaustiveDependencies: intentional`

5. **`'none'` sentinel value in positioning Select:** The current code uses `'none'` as the shadcn Select value for "No positioning" (changed from `''` in Story 5.3 to avoid shadcn Select issues with empty string). The `useEffect` guards on `selectedPositioningId !== 'none'` correctly.

6. **Quick-action button click does NOT expand accordion:** Since the `<div>` containing the quick-action is a sibling to `AccordionPrimitive.Trigger` (not inside it), clicking the quick-action button does NOT trigger the accordion expand. This is the desired behavior.

7. **Archived prospects:** Quick-action button is hidden for archived prospects (`{!isArchived && ...}`). This mirrors the behavior in `ProspectDetail` where the interactions section is hidden for archived prospects.

8. **ProspectDetail "Log Interaction" button unchanged:** The existing `AddInteractionDialog` in `ProspectDetail.tsx` passes `initialProspectId={prospect.id}` which takes priority over `lastProspectId`. No change needed there.

9. **Biome will auto-fix import ordering** — run `pnpm biome check --write .` after all changes. Known order issues to watch: `@radix-ui` starts with `@` (same group as `@battlecrm/shared`, sorted alphabetically, `@battlecrm` before `@radix-ui` and `@hookform`).

10. **No new shadcn components** — `Plus`, `ChevronDown` from `lucide-react` (already used). No new packages.

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

- `useLastInteractionContext` hook reads localStorage synchronously at call-time (no state/effect needed for reads). `saveContext` writes both `lastProspectId` and a per-stage positioning map. Parse errors on the positioning map JSON are caught silently.
- `AddInteractionDialog`: `useState(initialProspectId ?? lastProspectId ?? '')` — `initialProspectId` takes priority (opens from ProspectDetail). `lastProspectId` is the fallback for generic "Log Interaction" triggers. If the stored ID doesn't exist in prospects list, `selectedProspect` stays `undefined` and graceful degradation applies (user must select manually).
- Positioning pre-fill via `useEffect` with intentional dep omission (`biome-ignore` comment added) — only fires when positionings load and positioning is still at default `'none'`. Does NOT re-fire when user manually changes positioning.
- `saveContext` called BEFORE `resetAll()` in onSuccess — captures the values before they're cleared.
- `ProspectRow` uses `{ Accordion as AccordionPrimitive } from 'radix-ui'` (not `@radix-ui/react-accordion`). `AccordionPrimitive.Header` is a div — sibling buttons are valid HTML. ChevronDown animation replicated via `className="group"` on trigger + `group-data-[state=open]:rotate-180` on the icon.
- 209/209 backend tests pass — 0 regressions. Biome 0 errors, TypeScript 0 errors.

### File List

- `apps/frontend/src/features/interactions/hooks/useLastInteractionContext.ts` (created)
- `apps/frontend/src/features/interactions/components/AddInteractionDialog.tsx` (modified — pre-fill logic, useEffect, saveContext on success)
- `apps/frontend/src/features/prospects/components/ProspectRow.tsx` (modified — quick-action button via AccordionPrimitive restructure)
