# Story 3.7: Implement Prospect Detail View

Status: review

<!-- Ultimate Context Engine Analysis: 2026-03-02 -->
<!-- Epic 3: Prospect Management — frontend-only story (no new backend) -->

## Story

As a user,
I want to see full prospect details with interaction history,
so that I have complete context when engaging with a prospect.

## Acceptance Criteria

1. **AC1 (Complete detail panel):** Expanding a prospect row displays a comprehensive detail view: all prospect fields (including positioning variant status), current funnel stage with position indicator (from Story 3.6), stage history, and an interactions section. The detail DL is always visible (not hidden when optional fields are empty).

2. **AC2 (Positioning variant display):** The expanded panel shows a "Positioning" row in the DL. When `positioningId` is null (current state — positionings are Epic 4): shows "Not assigned" in muted italic text. When `positioningId` is set: shows "Linked" (Epic 4 will replace with actual positioning name via a dedicated hook).

3. **AC3 (Interactions section):** The "interactions coming soon" text placeholder is replaced with a proper Interactions section containing:
   - "Interactions" section header with a disabled "Log Interaction" button (placeholder for Epic 5)
   - Empty state text "No interactions logged yet." (always shown, as no interactions exist yet)
   - The button renders visually but is `disabled` — Epic 5 implements the actual form

4. **AC4 (Backend detail hook):** `prospectsApi.get(id: string)` method and `useProspect(id)` hook exist for use by Epic 5's interaction timeline implementation.

5. **AC5 (Lint + type-check):** `pnpm biome check --write .` from root passes with 0 errors. `pnpm --filter @battlecrm/frontend type-check` passes with 0 errors.

## Tasks / Subtasks

- [x] **Task 1: Frontend — API layer** (AC4)
  - [x] 1.1 Add `prospectsApi.get(id)` method to `apps/frontend/src/features/prospects/lib/api.ts`

- [x] **Task 2: Frontend — useProspect hook** (AC4)
  - [x] 2.1 Create `apps/frontend/src/features/prospects/hooks/useProspect.ts`

- [x] **Task 3: Frontend — ProspectRow UI** (AC1, AC2, AC3)
  - [x] 3.1 Remove `hasDetails` variable and its conditional wrapper — DL always rendered
  - [x] 3.2 Add positioning row to the DL (always shown, positioned after `notes`)
  - [x] 3.3 Import `Plus` icon from `lucide-react` (for Log Interaction button)
  - [x] 3.4 Replace the "interactions coming soon" `<p>` with proper Interactions section

- [x] **Task 4: i18n translations** (AC1, AC2, AC3)
  - [x] 4.1 Update `apps/frontend/public/locales/en.json` — add new keys, remove `interactionsComingSoon`
  - [x] 4.2 Update `apps/frontend/public/locales/fr.json` — add new keys, remove `interactionsComingSoon`

- [x] **Task 5: Lint and type-check** (AC5)
  - [x] 5.1 `pnpm biome check --write .` from root — 0 errors (1 file auto-formatted)
  - [x] 5.2 `pnpm --filter @battlecrm/frontend type-check` — 0 errors

---

## Dev Notes

### CRITICAL: No Separate Detail Page — Expanded Row IS the Detail View

The UX spec explicitly states: *"Click row = expand/drill-down (pas de page detail)"* — there is **no** `/prospects/:id` detail page. The `ProspectRow` expanded panel is the complete prospect detail view. Do NOT create a new page or route. Do NOT add a new `/prospects/:id` route to `apps/frontend/src/routes.tsx`.

The expanded panel is already feature-rich (from Stories 3.1–3.6):
- All optional fields in a DL
- Stage selector + position indicator (Story 3.6)
- Stage history timeline (Story 3.6)
- Edit form (Story 3.4)
- Archive/Restore (Story 3.5)

This story adds the **missing** pieces: positioning display + proper interactions section.

---

### Task 1.1: Add `prospectsApi.get(id)` to api.ts

**File: `apps/frontend/src/features/prospects/lib/api.ts`** — ADD to `prospectsApi` object, after `restore()`:

```typescript
get(id: string): Promise<ProspectType> {
  return fetchApi<ProspectType>(`/prospects/${id}`)
},
```

The `GET /api/prospects/:id` endpoint already exists (Story 3.2). The method is pure infrastructure — it is NOT used in ProspectRow (the list query already provides prospect data). It is intentionally created here for Epic 5 to use when implementing the interaction timeline (which may need fresh prospect data independently).

---

### Task 2.1: Create `useProspect` Hook

**File: `apps/frontend/src/features/prospects/hooks/useProspect.ts`** (NEW FILE)

```typescript
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { prospectsApi } from '../lib/api'

export function useProspect(id: string) {
  return useQuery({
    queryKey: queryKeys.prospects.detail(id),
    queryFn: () => prospectsApi.get(id),
  })
}
```

**Pattern:** Same as `useProspects()` — minimal `useQuery` wrapper. `queryKeys.prospects.detail(id)` already exists in `apps/frontend/src/lib/queryKeys.ts` (added in Story 3.4 mutation invalidation). This hook gives it a corresponding query function.

**DO NOT use this hook inside ProspectRow** — the list query provides all needed prospect data. This hook is for Epic 5's interaction features.

---

### Task 3: Modify ProspectRow.tsx

**File: `apps/frontend/src/features/prospects/components/ProspectRow.tsx`**

#### 3.1 — Remove `hasDetails` and its wrapper

**Delete** the `hasDetails` variable declaration (lines 112–119):
```typescript
// DELETE THIS ENTIRE BLOCK:
const hasDetails = !!(
  prospect.company ||
  prospect.linkedinUrl ||
  prospect.email ||
  prospect.phone ||
  prospect.title ||
  prospect.notes
)
```

**Remove** the `{hasDetails && (` wrapper and its closing `)}` in the JSX, keeping the `<dl>` always rendered:

```tsx
// BEFORE:
{hasDetails && (
  <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
    {/* ... */}
  </dl>
)}

// AFTER:
<dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
  {/* ... */}
</dl>
```

**Why:** With positioning now always shown in the DL, the DL always has at least one row. Removing the conditional simplifies the code and makes the detail panel consistent for all prospects.

#### 3.2 — Add positioning row to the DL

Inside the `<dl>`, **after** the `notes` block:

```tsx
{/* Positioning — Epic 4 will replace with positioning name via usePositioning hook */}
<dt className="text-muted-foreground">{t('prospects.fields.positioning')}</dt>
<dd>
  {prospect.positioningId ? (
    <span>{t('prospects.positioningLinked')}</span>
  ) : (
    <span className="italic text-muted-foreground">{t('prospects.notAssigned')}</span>
  )}
</dd>
```

**Context:** All current prospects have `positioningId: null` (positionings are Epic 4). This always renders as "Not assigned" until Epic 4 adds positioning management. When Epic 4 is done, a separate story will add a `usePositioning(id)` hook to show the actual positioning name.

#### 3.3 — Add `Plus` icon import

**Modify** the existing lucide-react import to include `Plus`:

```typescript
// BEFORE:
import { Archive, ChevronRight, Pencil, RotateCcw, X } from 'lucide-react'

// AFTER:
import { Archive, ChevronRight, Pencil, Plus, RotateCcw, X } from 'lucide-react'
```

⚠️ Biome sorts imports within the curly braces alphabetically. `Plus` is inserted between `Pencil` and `RotateCcw`.

#### 3.4 — Replace "interactions coming soon" with Interactions section

**REPLACE** this existing block:
```tsx
{/* Interactions — Epic 5 */}
<p className="mt-4 text-xs italic text-muted-foreground">
  {t('prospects.interactionsComingSoon')}
</p>
```

**WITH:**
```tsx
{/* Interactions — Epic 5 will implement the Log Interaction form and timeline */}
<div className="mt-4">
  <div className="mb-2 flex items-center justify-between">
    <p className="text-xs font-medium text-muted-foreground">
      {t('prospects.interactions.title')}
    </p>
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled
      title={t('prospects.interactions.comingSoon')}
    >
      <Plus className="mr-1 size-3" />
      {t('prospects.interactions.logButton')}
    </Button>
  </div>
  <p className="text-xs italic text-muted-foreground">
    {t('prospects.interactions.empty')}
  </p>
</div>
```

**Design decisions:**
- `disabled` button — visually present (satisfies AC3 "I see a prominent 'Log Interaction' button"), but non-functional until Epic 5
- `title` attribute — browser tooltip explains "Coming in a future release" on hover
- `Plus` icon — standard "add" affordance, clear intent
- Empty state text always shown (since interactions table doesn't exist yet — Epic 5, Story 5.1 creates `interactions` migration)

---

### Task 4: i18n Keys

#### 4.1: `apps/frontend/public/locales/en.json`

**REMOVE** (line 100):
```json
"interactionsComingSoon": "Interaction history coming soon.",
```

**ADD** to `prospects.fields` object (after `"funnelStage"`):
```json
"positioning": "Positioning"
```

**ADD** at the top level of `prospects` object (after `"searchPlaceholder"` or anywhere logical, Biome won't reorder JSON):
```json
"notAssigned": "Not assigned",
"positioningLinked": "Linked",
"interactions": {
  "title": "Interactions",
  "empty": "No interactions logged yet.",
  "logButton": "Log Interaction",
  "comingSoon": "Coming in a future release"
},
```

#### 4.2: `apps/frontend/public/locales/fr.json`

**REMOVE** (line 100):
```json
"interactionsComingSoon": "Historique des interactions à venir.",
```

**ADD** to `prospects.fields` object (after `"funnelStage"`):
```json
"positioning": "Positionnement"
```

**ADD** to top level of `prospects`:
```json
"notAssigned": "Non assigné",
"positioningLinked": "Lié",
"interactions": {
  "title": "Interactions",
  "empty": "Aucune interaction enregistrée.",
  "logButton": "Journaliser une interaction",
  "comingSoon": "Disponible dans une prochaine version"
},
```

---

### Project Structure Notes

**New files:**
- `apps/frontend/src/features/prospects/hooks/useProspect.ts` — `useProspect(id)` hook

**Existing files modified:**
- `apps/frontend/src/features/prospects/lib/api.ts` — `prospectsApi.get(id)` method
- `apps/frontend/src/features/prospects/components/ProspectRow.tsx` — DL always visible, positioning row, interactions section
- `apps/frontend/public/locales/en.json` — new keys, remove `interactionsComingSoon`
- `apps/frontend/public/locales/fr.json` — same

**No backend changes.** All needed endpoints already exist:
- `GET /api/prospects/:id` — Story 3.2
- `GET /api/prospects/:id/stage-transitions` — Story 3.6

**No new routes** in `apps/frontend/src/routes.tsx`. No new pages.

---

### Previous Story Intelligence (Story 3.6 Learnings)

**Established patterns:**
- `useProspectStageTransitions(id, { enabled: isExpanded })` — lazy fetch on expand; same pattern for `useProspect(id)` if used in future
- `useFunnelStages()` cross-feature import from `@/features/settings/hooks/useFunnelStages` — already used in ProspectRow (cached, no overhead)
- `toast.success()` for mutations; never `toast.error()` — inline errors instead
- `stageError` / `archiveError` / `restoreError` state pattern: `useState<string | null>(null)` + error paragraph

**What this story inherits:**
- All of ProspectRow's existing structure — this story modifies the read-only expanded panel only
- No changes to edit form, archive/restore logic, stage Select, stage history

**Stage Select note:** The `update.isPending` disables the stage Select. The new "Log Interaction" button uses its own `disabled` attribute (unconditional since Epic 5 isn't built). This is intentional — the button is always disabled in this story.

---

### CRITICAL: Biome Import Sort — lucide-react

When adding `Plus` to the lucide-react import:
```typescript
import { Archive, ChevronRight, Pencil, Plus, RotateCcw, X } from 'lucide-react'
```
Biome sorts named imports alphabetically: A < C < P (Pencil) < P (Plus) < R < X. `Plus` comes after `Pencil` and before `RotateCcw`. Running `pnpm biome check --write .` after Task 3 will auto-fix any ordering issues.

---

### CRITICAL: camelCase API Responses (Known Divergence)

Lucid v3 serializes camelCase by default. All API response fields in `ProspectType` are camelCase:
- `positioningId` (NOT `positioning_id`)
- `funnelStageId` (NOT `funnel_stage_id`)

Use `prospect.positioningId` (not `prospect.positioning_id`) in ProspectRow. This is already the convention used for `funnelStageId` throughout the existing code.

---

### Git Intelligence Summary

Recent commits (last 5):
- `5d85f0c` Merge PR #17 — story 3.6 (funnel stage management)
- `822d246` feat(prospects): update funnel stage management status + enhance transitions accessibility
- `97721de` feat(prospects): implement funnel stage transitions history (frontend)
- `0ef0b5b` feat(prospects): implement funnel stage transitions history (backend)
- `665c0dd` Merge remote-tracking branch 'origin/main' into story-3.6

**Patterns from recent work:**
1. Biome auto-formats on `pnpm biome check --write .` — always run last
2. Small frontend-only stories: no migration, no new controller — just hooks + component + i18n
3. `useQuery` hook pattern: minimal wrapper with typed query key and query function
4. `isExpanded` passed as `enabled` to lazy queries — reuse for `useProspect` if needed in Epic 5

---

### References

- [Source: apps/frontend/src/features/prospects/components/ProspectRow.tsx#L112-119] — `hasDetails` variable to delete
- [Source: apps/frontend/src/features/prospects/components/ProspectRow.tsx#L480-484] — `interactionsComingSoon` placeholder to replace
- [Source: apps/frontend/src/features/prospects/lib/api.ts] — `prospectsApi` object to extend with `get(id)`
- [Source: apps/frontend/src/lib/queryKeys.ts#prospects.detail] — existing key used by `useProspect`
- [Source: apps/frontend/src/features/prospects/hooks/useProspectStageTransitions.ts] — hook pattern to follow for `useProspect`
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7] — original acceptance criteria (FR8, FR9)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#L1262] — "Click row = expand/drill-down (pas de page detail)" — confirms no separate page
- [Source: _bmad-output/planning-artifacts/architecture.md] — ProspectType camelCase serialization, feature-based folder organization

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 5 tasks implemented in a single session. Frontend-only story — no backend changes.
- `prospectsApi.get(id)` added to api.ts: infrastructure for Epic 5 interaction timeline
- `useProspect(id)` hook created: wraps `queryKeys.prospects.detail(id)` — not used in ProspectRow (list data sufficient), available for Epic 5
- ProspectRow expanded panel: `hasDetails` removed (DL always visible), positioning row added (always shows "Not assigned" since positionings are Epic 4), interactions placeholder replaced with proper section (header + disabled "Log Interaction" button + empty state)
- i18n: `interactionsComingSoon` removed from en.json + fr.json; new keys added: `fields.positioning`, `notAssigned`, `positioningLinked`, `interactions.{title,empty,logButton,comingSoon}`
- Biome: 1 file auto-formatted (ProspectRow.tsx indentation), 0 errors
- TypeScript: 0 errors

### File List

- `apps/frontend/src/features/prospects/hooks/useProspect.ts` — NEW: `useProspect(id)` hook
- `apps/frontend/src/features/prospects/lib/api.ts` — MODIFIED: `prospectsApi.get(id)` method added
- `apps/frontend/src/features/prospects/components/ProspectRow.tsx` — MODIFIED: removed `hasDetails`, DL always visible, positioning row, interactions section with disabled "Log Interaction" button
- `apps/frontend/public/locales/en.json` — MODIFIED: removed `interactionsComingSoon`, added `fields.positioning`, `notAssigned`, `positioningLinked`, `interactions.*`
- `apps/frontend/public/locales/fr.json` — MODIFIED: same changes in French
