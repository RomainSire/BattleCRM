# Story 3.8: Extract ProspectDetail Component & Kanban Foundation

Status: ready-for-dev

<!-- PM Analysis: 2026-03-02 -->
<!-- Epic 3: Prospect Management — frontend-only story (no new backend) -->

## Story

As a developer,
I want the prospect detail panel extracted as a shared component and the view toggle scaffolded,
So that the Kanban board in Story 3.9 can reuse the detail panel via a Drawer without code duplication.

## Acceptance Criteria

1. **AC1 (Shared ProspectDetail component):** A new `ProspectDetail.tsx` component exists at `apps/frontend/src/features/prospects/components/ProspectDetail.tsx`. It accepts `prospect: ProspectType` and an optional `onClose?: () => void` callback. It contains all state, mutations, and JSX that was previously inside the `{isExpanded && (...)}` block in `ProspectRow.tsx`. No visual regression in the list view — expanding a prospect row looks and behaves identically to before this story.

2. **AC2 (ProspectRow simplified):** `ProspectRow.tsx` is slimmed down: the large inline detail block is replaced by `{isExpanded && <ProspectDetail prospect={prospect} />}`. The collapsed row (button with name, company, stage, email) is unchanged. The `id={prospect-panel-${prospect.id}}` aria attribute moves to ProspectRow's wrapper div.

3. **AC3 (View toggle):** `ProspectsPage.tsx` renders a `ToggleGroup` (List | Kanban) in the header, between the title and the `AddProspectDialog`. The toggle defaults to `'list'`. Selecting "Kanban" renders a placeholder `<div>` with text "Kanban view — Story 3.9" and hides `ProspectsList`. Selecting "List" shows `ProspectsList` and hides the placeholder.

4. **AC4 (shadcn components installed):** The following shadcn components are installed and present in `apps/frontend/src/components/ui/`: `toggle-group`, `button-group`, `drawer`, `badge`, `tooltip`. They do not need to be used yet (except `toggle-group` for AC3) — they are installed for Story 3.9 to use.

5. **AC5 (Lint + type-check):** `pnpm biome check --write .` from root passes with 0 errors. `pnpm --filter @battlecrm/frontend type-check` passes with 0 errors.

## Tasks / Subtasks

- [ ] **Task 1: Install shadcn components** (AC4)
  - [ ] 1.1 `pnpm dlx shadcn@latest add toggle-group` from `apps/frontend/`
  - [ ] 1.2 `pnpm dlx shadcn@latest add button-group` from `apps/frontend/`
  - [ ] 1.3 `pnpm dlx shadcn@latest add drawer` from `apps/frontend/`
  - [ ] 1.4 `pnpm dlx shadcn@latest add badge` from `apps/frontend/`
  - [ ] 1.5 `pnpm dlx shadcn@latest add tooltip` from `apps/frontend/`

- [ ] **Task 2: Create ProspectDetail component** (AC1)
  - [ ] 2.1 Create `apps/frontend/src/features/prospects/components/ProspectDetail.tsx`
  - [ ] 2.2 Move all imports, state, mutations, handlers, and JSX from the expanded panel into `ProspectDetail`
  - [ ] 2.3 Add `onClose?: () => void` prop — called in `handleArchiveConfirm`'s `onSuccess` callback

- [ ] **Task 3: Simplify ProspectRow** (AC2)
  - [ ] 3.1 Remove the large `{isExpanded && (...)}` block
  - [ ] 3.2 Replace with `{isExpanded && <ProspectDetail prospect={prospect} />}` inside the existing wrapper div
  - [ ] 3.3 Keep the `id={...}` aria attribute on the ProspectRow wrapper div

- [ ] **Task 4: Add ViewToggle to ProspectsPage** (AC3)
  - [ ] 4.1 Add `viewMode` state (`'list' | 'kanban'`, default `'list'`) to `ProspectsPage`
  - [ ] 4.2 Import and render `ToggleGroup` + `ToggleGroupItem` in the header
  - [ ] 4.3 Conditionally render `<ProspectsList />` or Kanban placeholder based on `viewMode`

- [ ] **Task 5: i18n translations** (AC3)
  - [ ] 5.1 Add view toggle keys to `apps/frontend/public/locales/en.json`
  - [ ] 5.2 Add view toggle keys to `apps/frontend/public/locales/fr.json`

- [ ] **Task 6: Lint and type-check** (AC5)
  - [ ] 6.1 `pnpm biome check --write .` from root — 0 errors
  - [ ] 6.2 `pnpm --filter @battlecrm/frontend type-check` — 0 errors

---

## Dev Notes

### CRITICAL: ToggleGroup vs ButtonGroup for View Toggle

Use **`ToggleGroup`** (not `ButtonGroup`) for the List/Kanban toggle. Reasons:
- `ToggleGroup` has native exclusive-selection semantics (`value` + `onValueChange`, one active at a time)
- Correct `aria-pressed` and `role="group"` attributes built-in
- Designed exactly for this use case (mode switcher)

**`ButtonGroup`** is installed for Story 3.9 (card quick-action button groups on KanbanCard), not for the view toggle.

### Task 2: ProspectDetail Interface

```typescript
interface ProspectDetailProps {
  prospect: ProspectType
  onClose?: () => void
}
```

**State to move into ProspectDetail (from ProspectRow):**
- `isEditing: boolean`
- `apiError: string | null`
- `archiveError: string | null`
- `restoreError: string | null`
- `stageError: string | null`

**Hooks to move into ProspectDetail (from ProspectRow):**
- `useUpdateProspect()`
- `useArchiveProspect()`
- `useRestoreProspect()`
- `useFunnelStages()`
- `useProspectStageTransitions(prospect.id, { enabled: true })` ← always enabled (component only mounts when expanded/drawer is open)

**⚠️ IMPORTANT — lazy loading via React mount:** In ProspectRow, the previous code used `{ enabled: isExpanded }`. With extraction, `ProspectDetail` only mounts when `isExpanded` is true (because ProspectRow renders `{isExpanded && <ProspectDetail />}`). So passing `{ enabled: true }` inside ProspectDetail is correct — the hook only runs when the component is mounted (i.e., when actually visible).

**onClose usage:**
```typescript
function handleArchiveConfirm() {
  setArchiveError(null)
  archive.mutate(prospect.id, {
    onSuccess: () => {
      toast.success(t('prospects.toast.archived'))
      onClose?.()  // ← close Drawer if provided; no-op in list view
    },
    // ...
  })
}
```

**ProspectDetail renders (without outer wrapper):**
```tsx
export function ProspectDetail({ prospect, onClose }: ProspectDetailProps) {
  // ... all state and hooks ...
  return (
    <div className="space-y-2 px-4 py-4">
      {isEditing ? (
        /* ── EDIT MODE ── */
        // ... form JSX ...
      ) : (
        /* ── READ-ONLY MODE ── */
        // ... DL + actions JSX ...
      )}
    </div>
  )
}
```

The outer wrapper styling (border-t, bg-muted/30) stays in ProspectRow since it's list-specific.

### Task 3: ProspectRow After Extraction

```tsx
{/* Expanded detail panel */}
{isExpanded && (
  <div
    id={`prospect-panel-${prospect.id}`}
    className="border-t bg-muted/30"
  >
    <ProspectDetail prospect={prospect} />
  </div>
)}
```

ProspectRow retains only: `isExpanded` prop, `onToggle` prop, the collapsed row `<button>`, and the wrapper div. All detail logic is gone.

### Task 4: ViewToggle in ProspectsPage

```tsx
import { LayoutGrid, List } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export function ProspectsPage() {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('prospects.title')}</h1>
          <p className="text-muted-foreground">{t('prospects.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as 'list' | 'kanban')}
            aria-label={t('prospects.viewToggle.label')}
          >
            <ToggleGroupItem value="list" aria-label={t('prospects.viewToggle.list')}>
              <List className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label={t('prospects.viewToggle.kanban')}>
              <LayoutGrid className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <AddProspectDialog />
        </div>
      </header>

      <section>
        {viewMode === 'list' ? (
          <ProspectsList />
        ) : (
          <div className="text-sm italic text-muted-foreground">
            {t('prospects.viewToggle.kanbanPlaceholder')}
          </div>
        )}
      </section>
    </div>
  )
}
```

**⚠️ onValueChange guard:** `(v) => v && setViewMode(...)` — ToggleGroup fires with empty string when clicking the already-active item. The guard prevents deselecting both options.

### Task 5: i18n Keys

**`apps/frontend/public/locales/en.json`** — add to `prospects` object:
```json
"viewToggle": {
  "label": "View mode",
  "list": "List view",
  "kanban": "Kanban view",
  "kanbanPlaceholder": "Kanban view — coming in Story 3.9"
}
```

**`apps/frontend/public/locales/fr.json`** — add to `prospects` object:
```json
"viewToggle": {
  "label": "Mode d'affichage",
  "list": "Vue liste",
  "kanban": "Vue Kanban",
  "kanbanPlaceholder": "Vue Kanban — disponible en Story 3.9"
}
```

### Files Changed

**New files:**
- `apps/frontend/src/features/prospects/components/ProspectDetail.tsx` — extracted detail panel
- `apps/frontend/src/components/ui/toggle-group.tsx` — shadcn (installed)
- `apps/frontend/src/components/ui/button-group.tsx` — shadcn (installed)
- `apps/frontend/src/components/ui/drawer.tsx` — shadcn (installed)
- `apps/frontend/src/components/ui/badge.tsx` — shadcn (installed)
- `apps/frontend/src/components/ui/tooltip.tsx` — shadcn (installed)

**Modified files:**
- `apps/frontend/src/features/prospects/components/ProspectRow.tsx` — simplified
- `apps/frontend/src/features/prospects/ProspectsPage.tsx` — viewMode state + ToggleGroup + conditional render
- `apps/frontend/public/locales/en.json` — viewToggle keys
- `apps/frontend/public/locales/fr.json` — viewToggle keys

**No backend changes. No new routes.**

### Previous Story Intelligence (Story 3.7 Learnings)

- `useProspectStageTransitions(id, { enabled: isExpanded })` pattern → now `{ enabled: true }` inside ProspectDetail (lazy via React mount)
- `useProspect(id, { enabled?: boolean })` hook exists for Epic 5 — not used in this story
- Biome auto-formats on `pnpm biome check --write .` — always run last
- `toast.success()` for mutations; never `toast.error()` — inline errors instead
- i18n namespace: all keys under `prospects.*`

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
