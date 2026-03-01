# Story 3.5: Add Archive & Restore Functionality

Status: done

<!-- Ultimate Context Engine Analysis: 2026-03-01 -->
<!-- Epic 3: Prospect Management — backend + frontend story (new endpoint + UI) -->

## Story

As a user,
I want to archive prospects I no longer need and restore them if needed,
so that I can keep my active list clean without losing data.

## Acceptance Criteria

1. **AC1 (Archive with confirmation):** In the expanded `ProspectRow` panel (read-only view), an "Archive" button is visible for active (non-archived) prospects. Clicking it opens an `AlertDialog` confirmation. On confirm, `DELETE /api/prospects/:id` is called. On success: `toast.success(...)`, the prospect disappears from the active list (query invalidation). On error: inline error message in the panel — **never `toast.error()`**.

2. **AC2 (Show archived toggle):** The `ProspectsList` filter bar includes a "Show archived" `<Switch>` (shadcn/ui) paired with a `<Label>`, placed in the first toolbar row alongside the search input. When toggled ON:
   - The query uses `?include_archived=true` (shows all prospects — active + archived)
   - Archived rows display a visual indicator (muted styling + small "Archived" badge)
   - The count footer updates to reflect the total including archived

3. **AC3 (Restore):** In the expanded `ProspectRow` panel, archived prospects display a "Restore" button (instead of Archive). Clicking it calls `PATCH /api/prospects/:id/restore` (no confirmation dialog needed). On success: `toast.success(...)`, the prospect is removed from the list if "Show archived" is OFF (query invalidation). On error: inline error in the panel — **never `toast.error()`**.

4. **AC4 (Search):** A name search input appears in the filter bar (always visible). Typing filters the displayed prospects list client-side by name (case-insensitive substring match). Archived prospects only appear in search results when "Show archived" is ON (controlled by the existing `include_archived` query filter). No backend changes needed for search — filtering is client-side since all prospects are loaded.

5. **AC5 (Backend — restore endpoint):** `PATCH /api/prospects/:id/restore` calls `prospect.restore()` (adonis-lucid-soft-deletes mixin). The prospect must belong to the authenticated user (check with `.withTrashed().forUser()` to find it even when soft-deleted). Returns 200 with restored prospect. Returns 404 if not found.

6. **AC6 (Lint + type-check):** `pnpm biome check --write .` from root passes with 0 errors. `pnpm --filter @battlecrm/frontend type-check` passes with 0 errors.

## Tasks / Subtasks

- [x] **Task 1: Backend — add restore endpoint** (AC5)
  - [x] 1.1 Add `restore` action to `apps/backend/app/controllers/prospects_controller.ts`
  - [x] 1.2 Register `PATCH /:id/restore` route in `apps/backend/start/routes.ts`
  - [x] 1.3 Add functional tests in `apps/backend/tests/functional/prospects/api.spec.ts`

- [x] **Task 2: Extend frontend API layer** (AC1, AC3)
  - [x] 2.1 Add `archive(id)` and `restore(id)` methods to `apps/frontend/src/features/prospects/lib/api.ts`

- [x] **Task 3: Add mutation hooks** (AC1, AC3)
  - [x] 3.1 Add `useArchiveProspect()` and `useRestoreProspect()` to `apps/frontend/src/features/prospects/hooks/useProspectMutations.ts`

- [x] **Task 4: Update `ProspectRow`** (AC1, AC2, AC3)
  - [x] 4.1 Mutations handled internally (no callbacks needed — same pattern as useUpdateProspect)
  - [x] 4.2 Add archived visual indicator: muted text + "Archived" badge visible in collapsed row when `prospect.deletedAt !== null`
  - [x] 4.3 In read-only expanded panel: show Archive button + AlertDialog for active prospects
  - [x] 4.4 In read-only expanded panel: show Restore button for archived prospects (no confirmation needed)
  - [x] 4.5 Show inline `archiveError` / `restoreError` in the expanded panel on mutation failure

- [x] **Task 5: Update `ProspectsList`** (AC2, AC4)
  - [x] 5.1 Add `showArchived` boolean state (default: `false`)
  - [x] 5.2 Add `searchQuery` string state (default: `""`)
  - [x] 5.3 Pass `{ include_archived: true }` to `useProspects()` when `showArchived` is true; merge with existing `funnel_stage_id` filter
  - [x] 5.4 Add "Show archived" toggle button in the filter bar
  - [x] 5.5 Add name search `<Input>` in the filter bar
  - [x] 5.6 Apply client-side `searchQuery` filter to `prospects` before rendering

- [x] **Task 6: i18n translations** (all ACs)
  - [x] 6.1 Add new keys to `apps/frontend/public/locales/en.json`
  - [x] 6.2 Add new keys to `apps/frontend/public/locales/fr.json`

- [x] **Task 7: Lint and type-check** (AC6)
  - [x] 7.1 `pnpm biome check --write .` from root — 0 errors (4 files auto-formatted)
  - [x] 7.2 `pnpm --filter @battlecrm/frontend type-check` — 0 errors

---

## Dev Notes

### CRITICAL: Backend — adonis-lucid-soft-deletes `.restore()` Method

The `Prospect` model uses the `SoftDeletes` mixin from `adonis-lucid-soft-deletes`. This provides:
- `.delete()` → sets `deleted_at = now()` (already used in `destroy`)
- `.restore()` → sets `deleted_at = null` ← needed for Story 3.5
- `.withTrashed()` → includes soft-deleted records in query ← needed to find archived prospect by ID
- `.onlyTrashed()` → returns only soft-deleted records

**Key constraint:** To call `.restore()` on an archived prospect, you must first find it using `.withTrashed()` — otherwise the default scope (`deleted_at IS NULL`) will exclude it and you get a 404.

---

### Task 1.1: ProspectsController — add `restore` action

**File: `apps/backend/app/controllers/prospects_controller.ts`** — ADD after `destroy`:

```typescript
/**
 * PATCH /api/prospects/:id/restore
 * Restores a soft-deleted prospect (sets deleted_at to null).
 * Must use withTrashed() to find archived prospects.
 */
async restore({ params, response, auth }: HttpContext) {
  const userId = auth.user!.id

  const prospect = await Prospect.query()
    .withTrashed()
    .withScopes((s) => s.forUser(userId))
    .where('id', params.id)
    .firstOrFail()

  await prospect.restore()
  return response.ok(prospect)
}
```

**Notes:**
- `withTrashed()` MUST come before `withScopes()` — order matters with adonis-lucid-soft-deletes
- Returns 200 with the restored prospect (same pattern as `update`)
- Returns 404 if prospect not found or doesn't belong to user (automatic via `firstOrFail`)
- No new validator needed — no request body

---

### Task 1.2: Routes — add restore route

**File: `apps/backend/start/routes.ts`** — ADD inside the `/prospects` group, BEFORE `/:id` routes:

```typescript
// ⚠️ CRITICAL: /:id/restore has 2 path segments so it CANNOT conflict with /:id,
// but list it before the other /:id routes for readability and clarity.
router.patch('/:id/restore', [ProspectsController, 'restore']).where('id', UUID_REGEX)
```

The final prospects routes group should look like:

```typescript
router
  .group(() => {
    router.get('/', [ProspectsController, 'index'])
    router.post('/', [ProspectsController, 'store'])
    router.get('/:id', [ProspectsController, 'show']).where('id', UUID_REGEX)
    router.put('/:id', [ProspectsController, 'update']).where('id', UUID_REGEX)
    router.delete('/:id', [ProspectsController, 'destroy']).where('id', UUID_REGEX)
    router.patch('/:id/restore', [ProspectsController, 'restore']).where('id', UUID_REGEX)
  })
  .prefix('/prospects')
  .use(middleware.auth())
```

---

### Task 1.3: Backend Tests

**File: `apps/backend/tests/functional/prospects/api.spec.ts`** — ADD at the end of the test group:

```typescript
// ===========================
// DELETE /api/prospects/:id (archive)
// ===========================

test('DELETE /api/prospects/:id soft-deletes the prospect', async ({ client, assert }) => {
  const user = await registerUser(client, 'delete-soft')
  const stage = await getFirstStage(user.id)
  const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'ToArchive' })

  const res = await client.delete(`/api/prospects/${prospect.id}`).loginAs(user)
  res.assertStatus(200)

  // Verify soft-deleted
  const found = await Prospect.query().withTrashed().where('id', prospect.id).first()
  assert.isNotNull(found?.deletedAt)
})

test('DELETE /api/prospects/:id returns 404 for another user\'s prospect', async ({ client }) => {
  const user1 = await registerUser(client, 'delete-404-user1')
  const user2 = await registerUser(client, 'delete-404-user2')
  const stage = await getFirstStage(user1.id)
  const prospect = await Prospect.create({ userId: user1.id, funnelStageId: stage.id, name: 'NotMine' })

  const res = await client.delete(`/api/prospects/${prospect.id}`).loginAs(user2)
  res.assertStatus(404)
})

// ===========================
// PATCH /api/prospects/:id/restore
// ===========================

test('PATCH /api/prospects/:id/restore restores a soft-deleted prospect', async ({ client, assert }) => {
  const user = await registerUser(client, 'restore-ok')
  const stage = await getFirstStage(user.id)
  const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'ToRestore' })
  await prospect.delete() // soft-delete first

  const res = await client.patch(`/api/prospects/${prospect.id}/restore`).loginAs(user)
  res.assertStatus(200)
  assert.isNull(res.body().deletedAt)

  // Verify it shows in normal query again
  const found = await Prospect.query().where('id', prospect.id).first()
  assert.isNotNull(found)
})

test('PATCH /api/prospects/:id/restore returns 404 for active (non-archived) prospect', async ({ client }) => {
  // restore on a prospect that is NOT archived: it still succeeds (restore() is idempotent on a non-deleted row)
  // OR it 404s because it doesn't use withTrashed... actually it should still find it.
  // The real 404 case is: prospect doesn't exist or belongs to another user
  const user1 = await registerUser(client, 'restore-404-user1')
  const user2 = await registerUser(client, 'restore-404-user2')
  const stage = await getFirstStage(user1.id)
  const prospect = await Prospect.create({ userId: user1.id, funnelStageId: stage.id, name: 'NotMineRestore' })
  await prospect.delete()

  const res = await client.patch(`/api/prospects/${prospect.id}/restore`).loginAs(user2)
  res.assertStatus(404)
})

test('PATCH /api/prospects/:id/restore requires authentication', async ({ client }) => {
  const res = await client.patch('/api/prospects/00000000-0000-0000-0000-000000000001/restore')
  res.assertStatus(401)
})
```

**Test pattern notes:**
- `registerUser(client, prefix)` is already defined in the test file — reuse it
- `getFirstStage(userId)` is already defined — reuse it
- `await prospect.delete()` triggers soft delete (from SoftDeletes mixin)
- Use `Prospect.query().withTrashed().where(...)` to verify soft-deleted state

---

### Task 2: Frontend API Layer Extension

**File: `apps/frontend/src/features/prospects/lib/api.ts`** — ADD to `prospectsApi` object:

```typescript
archive(id: string): Promise<{ message: string }> {
  return fetchApi<{ message: string }>(`/prospects/${id}`, {
    method: 'DELETE',
  })
},

restore(id: string): Promise<ProspectType> {
  return fetchApi<ProspectType>(`/prospects/${id}/restore`, {
    method: 'PATCH',
  })
},
```

**Note:** `archive` maps to the existing `DELETE /api/prospects/:id` endpoint, which already returns `{ message: 'Prospect archived' }`. `restore` hits the new `PATCH /api/prospects/:id/restore` endpoint.

---

### Task 3: Mutation Hooks

**File: `apps/frontend/src/features/prospects/hooks/useProspectMutations.ts`** — ADD:

```typescript
export function useArchiveProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => prospectsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.all })
    },
  })
}

export function useRestoreProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => prospectsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.all })
    },
  })
}
```

**Pattern:** Identical to `useCreateProspect` / `useUpdateProspect`. Both invalidate `queryKeys.prospects.all` to refresh all prospect queries (list + any cached lists with filters).

---

### Task 4: ProspectRow — Archive/Restore Buttons + Archived Visual Indicator

**File: `apps/frontend/src/features/prospects/components/ProspectRow.tsx`** — MODIFY:

#### New imports to add:
```typescript
import { Archive, RotateCcw } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useArchiveProspect, useRestoreProspect } from '../hooks/useProspectMutations'
```

#### New state + hooks inside `ProspectRow`:
```typescript
const [archiveError, setArchiveError] = useState<string | null>(null)
const [restoreError, setRestoreError] = useState<string | null>(null)
const archive = useArchiveProspect()
const restore = useRestoreProspect()

const isArchived = prospect.deletedAt !== null
```

#### Archive action handler:
```typescript
function handleArchiveConfirm() {
  setArchiveError(null)
  archive.mutate(prospect.id, {
    onSuccess: () => {
      toast.success(t('prospects.toast.archived'))
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.errors[0]?.message : undefined
      setArchiveError(message ?? t('prospects.toast.archiveFailed'))
    },
  })
}
```

#### Restore action handler:
```typescript
function handleRestore() {
  setRestoreError(null)
  restore.mutate(prospect.id, {
    onSuccess: () => {
      toast.success(t('prospects.toast.restored'))
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.errors[0]?.message : undefined
      setRestoreError(message ?? t('prospects.toast.restoreFailed'))
    },
  })
}
```

#### Collapsed row visual indicator — add badge AFTER the stage name span:
```tsx
{/* Collapsed row — always visible */}
<button
  type="button"
  onClick={onToggle}
  className={`flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-accent ${isArchived ? 'opacity-60' : ''}`}
  aria-expanded={isExpanded}
  aria-controls={`prospect-panel-${prospect.id}`}
>
  {isExpanded ? (
    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
  ) : (
    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
  )}
  <span className={`min-w-0 flex-1 truncate font-medium ${isArchived ? 'line-through text-muted-foreground' : ''}`}>
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
</button>
```

#### Read-only panel — replace current edit button with action buttons group:

**Current code (lines ~309-319 in ProspectRow.tsx):**
```tsx
{/* Edit button */}
<Button
  type="button"
  size="icon-sm"
  variant="ghost"
  onClick={handleEditStart}
  aria-label={t('prospects.aria.editProspect', { name: prospect.name })}
  className="shrink-0"
>
  <Pencil className="size-3" />
</Button>
```

**Replace it with** (inside the `<div className="flex items-start justify-between">` alongside the `<div className="flex-1">` content):

```tsx
{/* Actions: Edit (active only) + Archive/Restore */}
<div className="flex shrink-0 flex-col items-end gap-1">
  {!isArchived && (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      onClick={handleEditStart}
      aria-label={t('prospects.aria.editProspect', { name: prospect.name })}
    >
      <Pencil className="size-3" />
    </Button>
  )}
  {isArchived ? (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={handleRestore}
      disabled={restore.isPending}
      aria-label={t('prospects.aria.restoreProspect', { name: prospect.name })}
    >
      <RotateCcw className="size-3" />
      {t('prospects.restore')}
    </Button>
  ) : (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          aria-label={t('prospects.aria.archiveProspect', { name: prospect.name })}
        >
          <Archive className="size-3" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('prospects.archiveDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('prospects.archiveDialog.description', { name: prospect.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleArchiveConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('prospects.archiveDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )}
  {archiveError && <p className="text-xs text-destructive">{archiveError}</p>}
  {restoreError && <p className="text-xs text-destructive">{restoreError}</p>}
</div>
```

**`common.cancel` key exists** — verified in `en.json` and `fr.json`. Use `t('common.cancel')` directly in the AlertDialog cancel button.

---

### Task 5: ProspectsList — Show Archived Toggle + Name Search

**File: `apps/frontend/src/features/prospects/components/ProspectsList.tsx`** — MODIFY:

#### New imports:
```typescript
import { Input } from '@/components/ui/input'
```

#### New state:
```typescript
const [showArchived, setShowArchived] = useState(false)
const [searchQuery, setSearchQuery] = useState('')
```

#### Updated `useProspects` call — merge all active filters:
```typescript
const activeFilters = {
  ...(activeStageFilter ? { funnel_stage_id: activeStageFilter } : {}),
  ...(showArchived ? { include_archived: true } : {}),
}

const {
  data: prospectsData,
  isLoading: prospectsLoading,
  isError: prospectsError,
} = useProspects(Object.keys(activeFilters).length > 0 ? activeFilters : undefined)
```

#### Client-side search filter (after `prospects = prospectsData?.data ?? []`):
```typescript
const filteredProspects = searchQuery.trim()
  ? prospects.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    )
  : prospects
```

Replace all uses of `prospects` in the JSX with `filteredProspects` for the row rendering. Keep `prospectsData.meta.total` for the count footer (raw total from backend, not filtered count).

#### Filter bar — add "Show archived" toggle and search input:

```tsx
{/* Search input — always visible */}
<div className="flex items-center gap-2">
  <Input
    type="search"
    placeholder={t('prospects.searchPlaceholder')}
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="h-8 w-48 text-sm"
    aria-label={t('prospects.searchPlaceholder')}
  />
</div>

{/* Stage filter buttons */}
{stages.length > 0 && (
  <div className="flex flex-wrap items-center gap-2">
    {/* ... existing stage filter buttons ... */}
    {/* Show archived toggle */}
    <Button
      type="button"
      size="sm"
      variant={showArchived ? 'default' : 'outline'}
      onClick={() => setShowArchived((prev) => !prev)}
      aria-pressed={showArchived}
      className="rounded-full"
    >
      {t('prospects.showArchived')}
    </Button>
  </div>
)}
```

**Note:** When `showArchived` is toggled off, archived prospects disappear from the query results automatically (backend excludes them). No need to manually clear `searchQuery`.

---

### Task 6: i18n Keys

**File: `apps/frontend/public/locales/en.json`** — ADD to `prospects` section:

```json
"archived": "Archived",
"showArchived": "Show archived",
"restore": "Restore",
"searchPlaceholder": "Search prospects...",
"archiveDialog": {
  "title": "Archive prospect?",
  "description": "\"{{name}}\" will be moved to the archive. You can restore it later.",
  "confirm": "Archive"
},
"toast": {
  "archived": "Prospect archived",
  "restored": "Prospect restored",
  "archiveFailed": "Failed to archive prospect.",
  "restoreFailed": "Failed to restore prospect."
},
"aria": {
  "archiveProspect": "Archive {{name}}",
  "restoreProspect": "Restore {{name}}"
}
```

**⚠️ Merge with existing `toast` and `aria` keys — do not replace them. Existing keys:**
- `toast.created`, `toast.updated`, `toast.createFailed`, `toast.updateFailed` → KEEP
- `aria.editProspect`, `aria.cancelEdit` → KEEP

**File: `apps/frontend/public/locales/fr.json`** — ADD same keys translated:

```json
"archived": "Archivé",
"showArchived": "Voir archivés",
"restore": "Restaurer",
"searchPlaceholder": "Rechercher un prospect...",
"archiveDialog": {
  "title": "Archiver ce prospect ?",
  "description": "\"{{name}}\" sera déplacé dans les archives. Vous pourrez le restaurer plus tard.",
  "confirm": "Archiver"
},
"toast": {
  "archived": "Prospect archivé",
  "restored": "Prospect restauré",
  "archiveFailed": "Impossible d'archiver le prospect.",
  "restoreFailed": "Impossible de restaurer le prospect."
},
"aria": {
  "archiveProspect": "Archiver {{name}}",
  "restoreProspect": "Restaurer {{name}}"
}
```

---

### Project Structure Notes

**Backend files to modify:**
- `apps/backend/app/controllers/prospects_controller.ts` — add `restore()` action
- `apps/backend/start/routes.ts` — add `PATCH /:id/restore` route
- `apps/backend/tests/functional/prospects/api.spec.ts` — add restore + archive tests

**Frontend files to modify:**
- `apps/frontend/src/features/prospects/lib/api.ts` — add `archive()` and `restore()` methods
- `apps/frontend/src/features/prospects/hooks/useProspectMutations.ts` — add `useArchiveProspect()` and `useRestoreProspect()`
- `apps/frontend/src/features/prospects/components/ProspectRow.tsx` — archive/restore UI
- `apps/frontend/src/features/prospects/components/ProspectsList.tsx` — toggle + search
- `apps/frontend/public/locales/en.json` — new translation keys
- `apps/frontend/public/locales/fr.json` — new translation keys

**No new files need to be created** — all changes are additions/modifications to existing files.

---

### AlertDialog Pattern (from FunnelStageItem)

Reference: `apps/frontend/src/features/settings/components/FunnelStageItem.tsx`

```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
```

All components are from `@/components/ui/alert-dialog` (shadcn, already installed). Import path is exact.

---

### CRITICAL: API Returns camelCase (NOT snake_case)

⚠️ Known divergence (documented in Story 3.2): Lucid v3 serializes camelCase by default.
- Response fields: `deletedAt`, `funnelStageId`, `linkedinUrl`, `positioningId`, `userId`
- Use `prospect.deletedAt` (camelCase) to check if archived, NOT `prospect.deleted_at`
- `ProspectType` already correctly declares `deletedAt: string | null` — use it

---

### CRITICAL: adonis-lucid-soft-deletes `.withTrashed()` Scope Ordering

In the `restore` controller action, `.withTrashed()` must be chained BEFORE `.withScopes()`:

```typescript
// ✅ CORRECT
Prospect.query()
  .withTrashed()                    // Include soft-deleted records
  .withScopes((s) => s.forUser(userId))  // Then filter by user

// ❌ WRONG — withTrashed may not work correctly after withScopes
Prospect.query()
  .withScopes((s) => s.forUser(userId))
  .withTrashed()
```

This is critical — the `forUser` scope adds `WHERE user_id = :userId`. Adding `.withTrashed()` after a scope may produce incorrect query ordering. Always chain `.withTrashed()` first.

---

### `common.cancel` Key — Already Exists

`common.cancel` = "Cancel" (en) / "Annuler" (fr) — verified in both locale files. Use directly:
```tsx
<AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
```

---

### Biome Import Ordering Rule

Biome sorts imports alphabetically:
- `@` scoped packages (shadcn, react, etc.) come first
- `#` aliases (backend only) come second
- relative imports last

When adding `AlertDialog` import to `ProspectRow.tsx`, it should go after other `@/components/ui/` imports (alphabetically).

---

### Git Intelligence Summary

Recent commits (last 5):
- `b6cf83c` Merge PR #15 — story 3.4 (prospect create & edit)
- `f27178c` feat(prospects): complete implementation of prospect create and edit functionality with UI enhancements
- `e2b2c6c` feat(prospects): add prospect management features with create and update functionality

**Patterns from recent work:**
1. Backend is already complete for soft-delete (`destroy` action) — no migration needed
2. Frontend mutation hooks follow the `useMutation` + `queryClient.invalidateQueries` pattern
3. `react-hook-form` with `vineResolver` for forms; plain `onClick` handlers for simple actions (archive/restore)
4. Error handling: `error instanceof ApiError ? error.errors[0]?.message : undefined`
5. `toast.success()` on success — never `toast.error()` for errors

---

### Previous Story Intelligence (Story 3.4)

**Lessons learned:**
- Native `<select>` was used (no shadcn Select needed) — the shadcn `Select` is now installed per MEMORY. Either works. Use whichever is simpler.
- `AlertDialog` is used in `FunnelStageItem` — import path is `@/components/ui/alert-dialog`
- `useFunnelStages()` is cross-feature imported from `features/settings/hooks/useFunnelStages`
- `defaultValues` in `useForm` with empty strings for optional fields, then convert to null/undefined in submit handler
- `queryKeys.prospects.all` = `['prospects']` — invalidating this clears ALL prospect-related queries (list + detail)
- `fetchApi` at `@/lib/api` handles `Content-Type: application/json` and `credentials: 'include'` automatically
- The path passed to `fetchApi` does NOT include `/api/` prefix (VITE_API_URL = `/api` handles it)

**Files established in Story 3.4 (read before touching):**
- `apps/frontend/src/features/prospects/lib/api.ts` — `ProspectType` (camelCase fields), `prospectsApi`
- `apps/frontend/src/features/prospects/hooks/useProspectMutations.ts` — `useCreateProspect`, `useUpdateProspect`
- `apps/frontend/src/features/prospects/components/ProspectRow.tsx` — fully implemented with edit mode
- `apps/backend/app/controllers/prospects_controller.ts` — complete CRUD, DO NOT regress existing actions

---

### References

- [Source: apps/backend/app/controllers/prospects_controller.ts] — `destroy` action uses `prospect.delete()` (soft delete)
- [Source: apps/backend/app/models/prospect.ts] — `SoftDeletes` mixin, `deletedAt` column
- [Source: apps/backend/start/routes.ts] — existing prospects routes group structure
- [Source: apps/backend/tests/functional/prospects/api.spec.ts] — `registerUser`, `getFirstStage` helpers
- [Source: apps/frontend/src/features/prospects/lib/api.ts] — `ProspectType`, `prospectsApi`, `ProspectsFilterType`
- [Source: apps/frontend/src/features/prospects/hooks/useProspects.ts] — `useProspects(filters?)`
- [Source: apps/frontend/src/features/prospects/hooks/useProspectMutations.ts] — mutation pattern
- [Source: apps/frontend/src/features/prospects/components/ProspectRow.tsx] — current implementation
- [Source: apps/frontend/src/features/prospects/components/ProspectsList.tsx] — filter bar structure
- [Source: apps/frontend/src/lib/queryKeys.ts] — `queryKeys.prospects.all`, `queryKeys.prospects.list(filters)`
- [Source: apps/frontend/src/features/settings/components/FunnelStageItem.tsx] — AlertDialog usage pattern
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] — naming, soft delete patterns
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5] — original acceptance criteria
- [Source: _bmad-output/implementation-artifacts/3-4-implement-prospect-create-edit.md] — patterns from previous story

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `apps/backend/app/controllers/prospects_controller.ts` — added `restore()` action
- `apps/backend/start/routes.ts` — added `PATCH /:id/restore` route
- `apps/backend/tests/functional/prospects/api.spec.ts` — added archive/restore tests, fixed duplicate test, added missing restore edge-case tests
- `apps/frontend/src/features/prospects/lib/api.ts` — added `archive()` and `restore()` methods
- `apps/frontend/src/features/prospects/hooks/useProspectMutations.ts` — added `useArchiveProspect()` and `useRestoreProspect()`
- `apps/frontend/src/features/prospects/components/ProspectRow.tsx` — archive/restore UI with AlertDialog, archived visual indicator, a11y fix
- `apps/frontend/src/features/prospects/components/ProspectsList.tsx` — search input, show-archived Switch, two-row toolbar layout, emptySearch state
- `apps/frontend/src/components/ui/switch.tsx` — shadcn Switch component (installed)
- `apps/frontend/public/locales/en.json` — archive/restore/search i18n keys incl. `emptySearch`
- `apps/frontend/public/locales/fr.json` — idem en français
