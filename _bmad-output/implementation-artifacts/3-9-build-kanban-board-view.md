# Story 3.9: Build Kanban Board View

Status: ready-for-dev

<!-- PM Analysis: 2026-03-02 -->
<!-- Epic 3: Prospect Management — frontend-only story (no new backend) -->
<!-- Depends on: Story 3.8 (ProspectDetail + shadcn drawer/badge/button-group installed) -->

## Story

As a user,
I want to see my prospects organized as a Kanban board by funnel stage,
So that I have a visual overview of my pipeline and can move prospects between stages with drag-and-drop.

## Acceptance Criteria

1. **AC1 (Kanban board renders):** When the user selects "Kanban" in the view toggle, a board appears with one column per funnel stage (in funnel stage `order` sequence). Each column header shows the stage name and the count of prospects in that stage using the `Badge` component. The Kanban placeholder text from Story 3.8 is replaced by this real implementation.

2. **AC2 (Prospect cards):** Each prospect appears as a `Card` in its corresponding stage column. The card shows: prospect name (bold), company (muted, optional), email (muted, optional). Archived prospects appear with `opacity-50` and a "Archived" `Badge`. The card has a drag handle icon (`GripVertical`) on the left — dragging only works via the handle (not the whole card).

3. **AC3 (Drag-and-drop between columns):** Using `@dnd-kit/core`, the user can drag a prospect card from one column and drop it onto another. On drop, the card moves immediately (optimistic update). `PUT /api/prospects/:id` is called with `{ funnel_stage_id: newStageId }`. If the call fails, the card reverts to its original column and a `toast.error` is shown. Archived prospects are NOT draggable (drag handle is disabled/hidden for archived).

4. **AC4 (Drawer for prospect detail):** Clicking anywhere on a card (excluding the drag handle) opens a `Drawer` from the right side. The Drawer renders `<ProspectDetail prospect={selectedProspect} onClose={() => setSelectedProspect(null)} />`. After archiving from the Drawer, the Drawer closes and the card disappears from the board. The Drawer can also be dismissed via the Drawer overlay/close button.

5. **AC5 (Search filter in Kanban):** The search input (from ProspectsList) is extracted into a shared location OR duplicated in the Kanban view. Typing in the search field in Kanban mode filters cards across all columns (client-side, by prospect name and company). Stage filter chip is NOT shown in Kanban (not relevant — all stages are visible as columns).

6. **AC6 (Archived toggle in Kanban):** The "Show archived" toggle works in Kanban view. When enabled, archived prospects appear in their last stage column with `opacity-50` styling and non-draggable state. When disabled, only active prospects are shown.

7. **AC7 (Empty column state):** A column with no prospects (after filtering) shows: stage name badge + "No prospects" text centered vertically.

8. **AC8 (Lint + type-check):** `pnpm biome check --write .` from root passes with 0 errors. `pnpm --filter @battlecrm/frontend type-check` passes with 0 errors.

## Tasks / Subtasks

- [ ] **Task 1: Data layer — query and grouping** (AC1, AC3)
  - [ ] 1.1 Create `useProspectsKanban` hook (or reuse `useProspects`) — fetch all prospects (no stage filter) grouped client-side by `funnelStageId`
  - [ ] 1.2 Use `useFunnelStages()` for column order (already cached from list view)

- [ ] **Task 2: KanbanCard component** (AC2, AC3, AC4)
  - [ ] 2.1 Create `apps/frontend/src/features/prospects/components/KanbanCard.tsx`
  - [ ] 2.2 Use `@dnd-kit/core` `useDraggable` for the drag handle only
  - [ ] 2.3 Use `Card` + optional `ButtonGroup` for card layout
  - [ ] 2.4 `onClick` on card body → calls `onOpenDetail(prospect)` callback

- [ ] **Task 3: KanbanColumn component** (AC1, AC2, AC7)
  - [ ] 3.1 Create `apps/frontend/src/features/prospects/components/KanbanColumn.tsx`
  - [ ] 3.2 Use `@dnd-kit/core` `useDroppable` — each column is a drop target
  - [ ] 3.3 Column header: stage name + `Badge` with prospect count
  - [ ] 3.4 Empty state when no cards to show

- [ ] **Task 4: ProspectsKanbanView component** (AC1–AC7)
  - [ ] 4.1 Create `apps/frontend/src/features/prospects/components/ProspectsKanbanView.tsx`
  - [ ] 4.2 Wrap columns in `DndContext` with `closestCorners` + `onDragEnd` handler
  - [ ] 4.3 Optimistic state: `useState` for local `prospectsByStage` derived from query data
  - [ ] 4.4 `onDragEnd`: detect column change → optimistic move → `update.mutate` → revert on error
  - [ ] 4.5 `DragOverlay` rendering dragged card copy during drag
  - [ ] 4.6 Drawer state: `selectedProspect: ProspectType | null`
  - [ ] 4.7 Render `Drawer` + `ProspectDetail` with `onClose={() => setSelectedProspect(null)}`
  - [ ] 4.8 Search input + archive toggle (local UI controls, client-side filtering)

- [ ] **Task 5: Wire into ProspectsPage** (AC1)
  - [ ] 5.1 Replace Kanban placeholder in `ProspectsPage.tsx` with `<ProspectsKanbanView />`

- [ ] **Task 6: i18n translations** (AC1, AC2, AC7)
  - [ ] 6.1 Update `apps/frontend/public/locales/en.json` — add kanban keys
  - [ ] 6.2 Update `apps/frontend/public/locales/fr.json` — add kanban keys

- [ ] **Task 7: Lint and type-check** (AC8)
  - [ ] 7.1 `pnpm biome check --write .` from root — 0 errors
  - [ ] 7.2 `pnpm --filter @battlecrm/frontend type-check` — 0 errors

---

## Dev Notes

### Architecture Overview

```
ProspectsPage
├── ToggleGroup (List | Kanban) — from Story 3.8
├── ProspectsList (list mode, unchanged)
└── ProspectsKanbanView (kanban mode)
    ├── search input + archive toggle (local state)
    ├── DndContext (onDragEnd → update mutation)
    │   └── KanbanColumn × N
    │       ├── Column header (stage name + Badge count)
    │       └── KanbanCard × M (useDraggable on handle)
    ├── DragOverlay (card clone during drag)
    └── Drawer
        └── DrawerContent
            └── ProspectDetail (from Story 3.8)
```

### dnd-kit Pattern for Cross-Column Drag

**⚠️ This is DIFFERENT from Story 2.3's pattern.** Story 2.3 used `SortableContext` + `verticalListSortingStrategy` for same-list reordering. Story 3.9 uses cross-container drag: `useDraggable` cards + `useDroppable` columns.

**Recommended imports:**
```typescript
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
```

**KanbanCard drag setup (handle only):**
```typescript
const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
  id: prospect.id,
  data: { prospect, fromStageId: prospect.funnelStageId },
  disabled: isArchived,
})

// On the drag handle element only:
<GripVertical
  ref={setDragRef}
  {...listeners}
  {...attributes}
  className={cn('size-4 cursor-grab text-muted-foreground', isArchived && 'hidden')}
/>
```

**KanbanColumn droppable setup:**
```typescript
const { setNodeRef: setDropRef, isOver } = useDroppable({
  id: stage.id,  // column id = stage id
})

<div
  ref={setDropRef}
  className={cn('min-h-[200px] rounded-md p-2', isOver && 'bg-accent/50')}
>
```

**onDragEnd handler in ProspectsKanbanView:**
```typescript
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over) return

  const fromStageId = active.data.current?.fromStageId as string
  const toStageId = over.id as string  // over.id is the column (stage) id

  if (fromStageId === toStageId) return  // no-op: same column

  const prospectId = active.id as string

  // 1. Optimistic update
  setLocalProspects(prev => moveProspect(prev, prospectId, toStageId))

  // 2. API call
  updateMutation.mutate(
    { id: prospectId, funnel_stage_id: toStageId },
    {
      onError: () => {
        // Revert
        setLocalProspects(prev => moveProspect(prev, prospectId, fromStageId))
        toast.error(t('prospects.kanban.moveFailed'))
      },
    }
  )
}
```

**DragOverlay** renders a copy of the dragged card (pass `overlay` prop to KanbanCard for reduced opacity styling):
```tsx
<DragOverlay>
  {activeProspect ? <KanbanCard prospect={activeProspect} overlay /> : null}
</DragOverlay>
```

### Optimistic State Management

```typescript
// Derive local state from query data; reset when query data changes
const { data: prospectsData } = useProspects({ include_archived: showArchived })
const allProspects = prospectsData?.data ?? []

// Local override for optimistic drag updates
const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, string>>({})

// Computed: prospects grouped by stage, with optimistic overrides applied
const prospectsByStage = useMemo(() => {
  const withOverrides = allProspects.map(p =>
    optimisticOverrides[p.id]
      ? { ...p, funnelStageId: optimisticOverrides[p.id] }
      : p
  )
  return groupBy(withOverrides, p => p.funnelStageId)
}, [allProspects, optimisticOverrides])

// On dragEnd success: TanStack Query invalidation will update allProspects → optimistic override no longer needed
// On error: revert the override
```

The helper `groupBy` is a simple client-side utility (no external lib needed for this):
```typescript
function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    acc[k] = [...(acc[k] ?? []), item]
    return acc
  }, {} as Record<string, T[]>)
}
```

### Drawer Integration

The `Drawer` from shadcn (installed in Story 3.8) renders from the right by default. Use `direction="right"` if the default is bottom:

```tsx
<Drawer open={!!selectedProspect} onOpenChange={(open) => !open && setSelectedProspect(null)}>
  <DrawerContent className="max-w-lg">
    <DrawerHeader>
      <DrawerTitle>{selectedProspect?.name}</DrawerTitle>
    </DrawerHeader>
    {selectedProspect && (
      <ProspectDetail
        prospect={selectedProspect}
        onClose={() => setSelectedProspect(null)}
      />
    )}
  </DrawerContent>
</Drawer>
```

**⚠️ Check shadcn Drawer API:** The direction prop name may differ. Read the installed `drawer.tsx` before implementing.

### Search + Archive Toggle in Kanban

The search and archive toggle from `ProspectsList` should NOT be tightly coupled to the list component. Two approaches:

**Option A (Simpler — recommended):** Duplicate the search input + archive toggle JSX inside `ProspectsKanbanView`. State is local to the Kanban view.

**Option B (Refactor):** Lift search + archive toggle state to `ProspectsPage` and pass down as props. More work, but `ProspectsPage` becomes the single source of filter state.

**Use Option A for this story.** Option B can be a follow-up refactor if needed.

Filter logic in Kanban (client-side, no API call):
```typescript
const filteredProspects = useMemo(() =>
  allProspects.filter(p =>
    searchQuery === '' ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.company?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  ),
  [allProspects, searchQuery]
)
```

### KanbanCard Layout

```tsx
<Card
  className={cn(
    'cursor-pointer hover:shadow-md transition-shadow',
    isArchived && 'opacity-50',
    isDragging && 'opacity-0',  // hidden while DragOverlay shows the clone
    overlay && 'rotate-2 shadow-lg',  // tilt when being dragged (DragOverlay)
  )}
  onClick={() => !isDragging && onOpenDetail(prospect)}
>
  <CardContent className="flex items-start gap-2 p-3">
    {/* Drag handle */}
    {!isArchived && (
      <div ref={setDragRef} {...listeners} {...attributes} className="mt-0.5 cursor-grab">
        <GripVertical className="size-4 text-muted-foreground" />
      </div>
    )}
    {/* Content */}
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{prospect.name}</p>
      {prospect.company && (
        <p className="truncate text-xs text-muted-foreground">{prospect.company}</p>
      )}
      {prospect.email && (
        <p className="truncate text-xs text-muted-foreground">{prospect.email}</p>
      )}
      {isArchived && (
        <Badge variant="secondary" className="mt-1 text-xs">
          {t('prospects.archived')}
        </Badge>
      )}
    </div>
  </CardContent>
</Card>
```

### i18n Keys

**`apps/frontend/public/locales/en.json`** — add to `prospects` object:
```json
"kanban": {
  "moveFailed": "Failed to move prospect. Please try again.",
  "noProspects": "No prospects",
  "searchPlaceholder": "Search prospects...",
  "showArchived": "Show archived"
}
```

**`apps/frontend/public/locales/fr.json`** — add to `prospects` object:
```json
"kanban": {
  "moveFailed": "Impossible de déplacer le prospect. Veuillez réessayer.",
  "noProspects": "Aucun prospect",
  "searchPlaceholder": "Rechercher un prospect...",
  "showArchived": "Afficher les archivés"
}
```

### Files Changed

**New files:**
- `apps/frontend/src/features/prospects/components/ProspectsKanbanView.tsx`
- `apps/frontend/src/features/prospects/components/KanbanColumn.tsx`
- `apps/frontend/src/features/prospects/components/KanbanCard.tsx`

**Modified files:**
- `apps/frontend/src/features/prospects/ProspectsPage.tsx` — replace Kanban placeholder with `<ProspectsKanbanView />`
- `apps/frontend/public/locales/en.json` — kanban keys
- `apps/frontend/public/locales/fr.json` — kanban keys

**No backend changes.** All needed endpoints exist:
- `GET /api/prospects` (with `?include_archived=true`) — Story 3.2
- `PUT /api/prospects/:id` (with `funnel_stage_id`) — Story 3.2
- `GET /api/funnel_stages` — Epic 2

### Previous Story Intelligence

- **dnd-kit already installed**: `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`, `@dnd-kit/utilities@^3.2.2`
- **`useProspects()`** hook uses TanStack Query — reuse directly, no need for a new hook
- **`useFunnelStages()`** cross-feature import from `@/features/settings/hooks/useFunnelStages` — already used in ProspectRow (cached, zero overhead)
- **`useUpdateProspect()`** mutation from `../hooks/useProspectMutations` — reuse for drag-and-drop stage update
- **`toast.error()`** is acceptable for drag failures (this is an edge case error, not an inline form error)
- **Biome**: always run `pnpm biome check --write .` last; it auto-sorts imports alphabetically
- **camelCase API**: `funnelStageId` (not `funnel_stage_id`) in `ProspectType` responses; use `funnel_stage_id` for PUT request body

### CRITICAL: `closestCorners` vs `closestCenter`

For multi-column Kanban layouts, use **`closestCorners`** collision detection (imported from `@dnd-kit/core`). It correctly handles dragging a card to an empty column or to the column header. `closestCenter` works for single-list sorting (Story 2.3) but can behave unexpectedly with droppable containers.

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
