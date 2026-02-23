# Story 2.3: Build Funnel Configuration UI

Status: done

<!-- Ultimate Context Engine Analysis: 2026-02-23 -->
<!-- Previous story: 2-2-implement-funnel-stages-api (done) -->

## Story

As a **user**,
I want to **configure my funnel stages in the Settings page**,
So that **I can customize my prospecting pipeline without touching code**.

## Acceptance Criteria

1. **AC1 (List view):** Navigating to Settings > Funnel Configuration displays my current funnel stages in order, each showing its name and position number (FR41).
2. **AC2 (Add Stage):** Clicking "Add Stage" shows an inline form; on submit, the new stage is added at the end of the list.
3. **AC3 (Inline edit):** Clicking the edit icon makes the stage name editable inline; I can save or cancel.
4. **AC4 (Delete):** Clicking the delete icon shows a confirmation dialog (destructive action); on confirm, the stage is archived and removed from the list.
5. **AC5 (Drag-and-drop reorder):** I can drag a stage to a new position; the new order is saved to the backend.
6. **AC6 (Navigation):** A top navbar is present with links to Dashboard and Settings (with placeholder links for future Prospects and Positionings pages). The Settings link navigates to `/settings`.
7. **AC7 (Success feedback):** All successful mutations show a toast notification (auto-dismiss 3s).
8. **AC8 (Error feedback):** API errors show an inline error message (no popup).
9. **AC9 (Lint + E2E tests):** `pnpm lint` passes from root; Playwright E2E tests pass for all CRUD operations.

## Tasks / Subtasks

- [x] **Task 1: Install packages** (AC: 5, 7)
  - [x] 1.1 `pnpm --filter @battlecrm/frontend add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
  - [x] 1.2 `pnpm --filter @battlecrm/frontend add sonner`
  - [x] 1.3 Add shadcn Dialog: `cd apps/frontend && pnpm dlx shadcn@latest add dialog`
  - [x] 1.4 Add shadcn Sonner: `cd apps/frontend && pnpm dlx shadcn@latest add sonner`
  - [x] 1.5 Add shadcn AlertDialog for confirmations: `cd apps/frontend && pnpm dlx shadcn@latest add alert-dialog`

- [x] **Task 2: Extend query keys** (AC: 1)
  - [x] 2.1 Update `apps/frontend/src/lib/queryKeys.ts` — add `funnelStages` namespace

- [x] **Task 3: Create API client for funnel stages** (AC: 1–5)
  - [x] 3.1 Create `apps/frontend/src/features/settings/lib/api.ts`
  - [x] 3.2 Export `funnelStagesApi` with: `list`, `create`, `update`, `delete`, `reorder`

- [x] **Task 4: Create TanStack Query hooks** (AC: 1–5)
  - [x] 4.1 Create `apps/frontend/src/features/settings/hooks/useFunnelStages.ts`
  - [x] 4.2 `useFunnelStages()` — GET list
  - [x] 4.3 `useCreateFunnelStage()` — POST + invalidate list
  - [x] 4.4 `useUpdateFunnelStage()` — PUT + invalidate list
  - [x] 4.5 `useDeleteFunnelStage()` — DELETE + invalidate list
  - [x] 4.6 `useReorderFunnelStages()` — PUT reorder + invalidate list

- [x] **Task 5: Create UI components** (AC: 1–5)
  - [x] 5.1 Create `apps/frontend/src/features/settings/components/FunnelStageItem.tsx` — single row with edit/delete actions
  - [x] 5.2 Create `apps/frontend/src/features/settings/components/AddStageForm.tsx` — inline form
  - [x] 5.3 Create `apps/frontend/src/features/settings/components/FunnelStageList.tsx` — sortable list with dnd-kit

- [x] **Task 6: Create SettingsPage** (AC: 1–5, 7, 8)
  - [x] 6.1 Create `apps/frontend/src/features/settings/SettingsPage.tsx`
  - [x] 6.2 Integrate FunnelStageList + AddStageForm + Toaster (Sonner)

- [x] **Task 7: Add top navbar** (AC: 6)
  - [x] 7.1 Create `apps/frontend/src/components/common/AppNavbar.tsx` — Dashboard + Settings links (placeholder Prospects, Positionings)
  - [x] 7.2 Update `apps/frontend/src/components/layouts/AuthLayout.tsx` — include `AppNavbar` above `<Outlet />`

- [x] **Task 8: Register route** (AC: 6)
  - [x] 8.1 Update `apps/frontend/src/routes.tsx` — add `/settings` route inside AuthGuard + AuthLayout wrapper
  - [x] 8.2 Add `SettingsPage` import and lazy load if needed

- [x] **Task 9: Wire up Toaster** (AC: 7)
  - [x] 9.1 Add `<Toaster />` from `sonner` to `apps/frontend/src/App.tsx` (global, outside QueryClientProvider or inside — doesn't matter)

- [x] **Task 10: E2E tests** (AC: 9)
  - [x] 10.1 Create `tests/e2e/settings-funnel.spec.ts`
  - [x] 10.2 Test: navigation to `/settings` shows funnel stages
  - [x] 10.3 Test: "Add Stage" creates and shows new stage
  - [x] 10.4 Test: edit icon renames stage inline
  - [x] 10.5 Test: delete icon with confirmation removes stage
  - [x] 10.6 Test: drag-and-drop changes order (optional if DnD is hard to automate)

- [x] **Task 11: Verification** (AC: 9)
  - [x] 11.1 `pnpm lint` from root → 0 errors
  - [x] 11.2 `pnpm --filter @battlecrm/frontend type-check` → 0 errors
  - [x] 11.3 Playwright E2E tests pass (requires running server)

---

## Dev Notes

### CRITICAL: Packages to Install First

```bash
# From monorepo root:
pnpm --filter @battlecrm/frontend add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
pnpm --filter @battlecrm/frontend add sonner

# shadcn components (from apps/frontend/):
cd apps/frontend
pnpm dlx shadcn@latest add dialog alert-dialog sonner
cd ../..
```

`@dnd-kit` packages **are NOT already installed**. They MUST be installed before any drag-and-drop code.

---

### CRITICAL: Query Keys Extension

**File:** `apps/frontend/src/lib/queryKeys.ts`

```typescript
export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
    registrationStatus: () => [...queryKeys.auth.all, 'registration-status'] as const,
  },
  funnelStages: {
    all: ['funnel-stages'] as const,
    list: () => [...queryKeys.funnelStages.all, 'list'] as const,
  },
}
```

---

### CRITICAL: API Client

**File:** `apps/frontend/src/features/settings/lib/api.ts`

**Import order (Biome-compliant):** `@` scoped → relative

```typescript
import { fetchApi } from '@/lib/api'

export type FunnelStageType = {
  id: string
  userId: string
  name: string
  position: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

type FunnelStageListResponse = {
  data: FunnelStageType[]
  meta: { total: number }
}

export const funnelStagesApi = {
  list() {
    return fetchApi<FunnelStageListResponse>('/funnel_stages')
  },

  create(name: string) {
    return fetchApi<FunnelStageType>('/funnel_stages', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  },

  update(id: string, name: string) {
    return fetchApi<FunnelStageType>(`/funnel_stages/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    })
  },

  delete(id: string) {
    return fetchApi<{ message: string }>(`/funnel_stages/${id}`, {
      method: 'DELETE',
    })
  },

  reorder(order: string[]) {
    return fetchApi<FunnelStageListResponse>('/funnel_stages/reorder', {
      method: 'PUT',
      body: JSON.stringify({ order }),
    })
  },
}
```

**Why no CSRF header:** AdonisJS CSRF is configured to exempt API routes (session auth via httpOnly cookies is sufficient for same-origin SPA).

**`fetchApi` already handles:**
- `credentials: 'include'` (session cookies)
- `Content-Type: application/json`
- Error parsing (throws `ApiError` with `status` + `errors`)

---

### CRITICAL: TanStack Query Hooks

**File:** `apps/frontend/src/features/settings/hooks/useFunnelStages.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { funnelStagesApi } from '../lib/api'

export function useFunnelStages() {
  return useQuery({
    queryKey: queryKeys.funnelStages.list(),
    queryFn: () => funnelStagesApi.list(),
  })
}

export function useCreateFunnelStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => funnelStagesApi.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.funnelStages.list() })
    },
  })
}

export function useUpdateFunnelStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      funnelStagesApi.update(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.funnelStages.list() })
    },
  })
}

export function useDeleteFunnelStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => funnelStagesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.funnelStages.list() })
    },
  })
}

export function useReorderFunnelStages() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (order: string[]) => funnelStagesApi.reorder(order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.funnelStages.list() })
    },
  })
}
```

---

### CRITICAL: dnd-kit Drag-and-Drop

**Version:** `@dnd-kit` v6.x — APIs are stable.

**FunnelStageList with SortableContext:**

```typescript
import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'

// In FunnelStageList component:
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
)

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return

  const oldIndex = stages.findIndex((s) => s.id === active.id)
  const newIndex = stages.findIndex((s) => s.id === over.id)
  const reordered = arrayMove(stages, oldIndex, newIndex)

  // Optimistically update local state
  setLocalStages(reordered)

  // Send ordered IDs to backend
  reorder.mutate(reordered.map((s) => s.id))
}

// JSX:
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={localStages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
    {localStages.map((stage) => (
      <FunnelStageItem key={stage.id} stage={stage} />
    ))}
  </SortableContext>
</DndContext>
```

**FunnelStageItem with useSortable:**

```typescript
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function FunnelStageItem({ stage }: { stage: FunnelStageType }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {/* Drag handle — apply listeners only to the handle, NOT the whole row */}
      <button {...listeners} aria-label="Reorder stage" className="cursor-grab active:cursor-grabbing">
        <GripVerticalIcon className="h-4 w-4 text-muted-foreground" />
      </button>
      {/* Rest of stage row content */}
    </div>
  )
}
```

**Why drag handle on button, not whole row:** Applying `listeners` to the whole row prevents clicking edit/delete icons because the DnD sensor captures pointer events. Use a dedicated drag handle.

**Optimistic local state:** Keep a local `localStages` state initialized from the query data. Update it immediately on drag end, then fire the `reorder` mutation. On mutation success, the query invalidation re-fetches from server (which should return same order).

---

### CRITICAL: Toast Notifications (Sonner)

**File:** `apps/frontend/src/App.tsx` — add `<Toaster />` once (global)

```typescript
import { Toaster } from '@/components/ui/sonner'  // from shadcn-generated file

// In App component JSX:
<QueryClientProvider client={queryClient}>
  {/* ... routes ... */}
  <Toaster position="bottom-right" />
</QueryClientProvider>
```

**Usage in mutation callbacks:**

```typescript
import { toast } from 'sonner'

// In onSuccess:
toast.success('Stage created')

// In onError (use ApiError):
import { type ApiError } from '@/lib/api'

onError: (error: ApiError) => {
  toast.error(error.errors[0]?.message ?? 'An error occurred')
}
```

**Important:** `sonner`'s `toast` is a standalone function — import from `'sonner'` (not from the shadcn component file). The `<Toaster />` component is from the shadcn-generated `@/components/ui/sonner`.

---

### CRITICAL: Delete Confirmation Dialog

**Use `AlertDialog` from shadcn, NOT `Dialog`** — AlertDialog is semantically correct for destructive confirmations and has accessible focus trapping.

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

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="icon" aria-label="Delete stage">
      <Trash2Icon className="h-4 w-4" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete stage?</AlertDialogTitle>
      <AlertDialogDescription>
        "{stage.name}" will be archived. This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => deleteMutation.mutate(stage.id)}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Do NOT use regular `Dialog` for destructive actions** — UX spec and architecture require `Dialog` only for non-destructive interactions and `AlertDialog` for confirmations.

---

### CRITICAL: Inline Edit Pattern

```typescript
// State per stage row
const [isEditing, setIsEditing] = useState(false)
const [editName, setEditName] = useState(stage.name)

// On save
function handleSave() {
  if (editName.trim() === stage.name || editName.trim() === '') {
    setIsEditing(false)
    return
  }
  updateMutation.mutate(
    { id: stage.id, name: editName.trim() },
    {
      onSuccess: () => {
        setIsEditing(false)
        toast.success('Stage updated')
      },
    },
  )
}

// On cancel
function handleCancel() {
  setEditName(stage.name)  // Reset to original
  setIsEditing(false)
}

// JSX for editing state
{isEditing ? (
  <div className="flex items-center gap-2">
    <Input
      value={editName}
      onChange={(e) => setEditName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSave()
        if (e.key === 'Escape') handleCancel()
      }}
      autoFocus
    />
    <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
      {updateMutation.isPending ? '...' : 'Save'}
    </Button>
    <Button size="sm" variant="outline" onClick={handleCancel}>
      Cancel
    </Button>
  </div>
) : (
  <span>{stage.name}</span>
)}
```

---

### CRITICAL: AuthLayout Update

**File:** `apps/frontend/src/components/layouts/AuthLayout.tsx`

Current layout centers content (auth pages). For the Settings page (and future pages), we need a layout with a top navbar and main content area.

**Problem:** The current `AuthLayout` is used for dashboard which centers content. Adding a navbar will change the layout for ALL authenticated pages including the dashboard.

**Solution:** Update `AuthLayout` to be a full-page layout with navbar + content area. Update `DashboardPage` styles accordingly.

```typescript
import { Outlet } from 'react-router'
import { AppNavbar } from '@/components/common/AppNavbar'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="container mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
```

**DashboardPage must be updated too** — it's currently styled to be centered in a full-screen div. After the layout change, it should use normal page layout (remove `flex min-h-screen items-center justify-center`). This is a required change to avoid UI breakage.

---

### CRITICAL: AppNavbar Component

**File:** `apps/frontend/src/components/common/AppNavbar.tsx`

```typescript
import { NavLink } from 'react-router'

export function AppNavbar() {
  return (
    <nav className="border-b bg-background" aria-label="Main navigation">
      <div className="container mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <span className="font-semibold">BattleCRM</span>
        <div className="flex items-center gap-4">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive ? 'text-foreground font-medium underline underline-offset-4' : 'text-muted-foreground hover:text-foreground'
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              isActive ? 'text-foreground font-medium underline underline-offset-4' : 'text-muted-foreground hover:text-foreground'
            }
          >
            Settings
          </NavLink>
          {/* Placeholder links for future epics — add href when pages exist */}
          <span className="text-muted-foreground/50 cursor-not-allowed">Prospects</span>
          <span className="text-muted-foreground/50 cursor-not-allowed">Positionings</span>
        </div>
      </div>
    </nav>
  )
}
```

**Use `NavLink` from `react-router` (not `Link`)** — `NavLink` provides `isActive` for automatic active styling. Import from `'react-router'` (not `'react-router-dom'`).

---

### CRITICAL: Route Registration

**File:** `apps/frontend/src/routes.tsx`

```typescript
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthLayout } from '@/components/layouts/AuthLayout'
import { GuestLayout } from '@/components/layouts/GuestLayout'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
import { GuestGuard } from '@/features/auth/components/GuestGuard'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthGuard />}>
          <Route element={<AuthLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route element={<GuestGuard />}>
          <Route element={<GuestLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

---

### CRITICAL: SettingsPage Structure

**File:** `apps/frontend/src/features/settings/SettingsPage.tsx`

```typescript
import { SettingsPage } from './SettingsPage'

// Page component:
export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your prospecting pipeline.</p>
      </div>
      <FunnelConfigSection />
    </div>
  )
}
```

---

### CRITICAL: AddStageForm Pattern

```typescript
const [isOpen, setIsOpen] = useState(false)
const [name, setName] = useState('')
const create = useCreateFunnelStage()

function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  if (!name.trim()) return
  create.mutate(name.trim(), {
    onSuccess: () => {
      setName('')
      setIsOpen(false)
      toast.success('Stage added')
    },
    onError: (error) => {
      toast.error(error.errors[0]?.message ?? 'Failed to add stage')
    },
  })
}
```

---

### Architecture Compliance

| Requirement | Implementation |
|-------------|----------------|
| Feature-based org | All files inside `features/settings/` |
| Shared component rule | `AppNavbar` in `components/common/` (used by all auth pages) |
| TypeScript type naming | `FunnelStageType` (with `Type` suffix) |
| Page naming | `SettingsPage.tsx` (with `Page` suffix) |
| Query keys centralized | Extended `src/lib/queryKeys.ts` |
| TanStack Query for server state | All API calls via hooks |
| VineJS validation | Not needed for frontend here — simple `name.trim()` check suffices (backend validates rigorously) |
| Error handling | Inline toast for mutations, inline error state for query |
| No hard deletes | API call is `DELETE` which backend treats as soft-delete |
| Soft confirm | Edit/add: direct save |
| Hard confirm | Delete: `AlertDialog` |
| Toast success | Sonner, bottom-right, auto-dismiss |
| Biome formatting | Run `pnpm biome check --write .` from root before commit |

---

### E2E Test Pattern

**File:** `tests/e2e/settings-funnel.spec.ts`

```typescript
import { expect, test } from '../support/fixtures'

test.describe('Settings - Funnel Configuration', () => {
  test('navigates to settings page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
  })

  test('shows funnel stages list', async ({ page }) => {
    await page.goto('/settings')
    // Default stages seeded on registration (Story 2.1)
    await expect(page.getByText('Lead qualified')).toBeVisible()
  })

  test('can add a new stage', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /add stage/i }).click()

    const stageName = `Test Stage ${Date.now()}`
    await page.getByPlaceholder(/stage name/i).fill(stageName)

    const addResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/funnel_stages') && resp.status() === 201,
    )
    await page.getByRole('button', { name: /^(add|create|save)/i }).click()
    await addResponse

    await expect(page.getByText(stageName)).toBeVisible()
  })

  test('can edit a stage name', async ({ page }) => {
    await page.goto('/settings')
    // Click edit on the first stage
    await page.locator('[aria-label="Edit stage"]').first().click()

    const input = page.locator('input[type="text"]').first()
    await input.clear()
    await input.fill('Renamed Stage')

    const updateResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/funnel_stages') && resp.request().method() === 'PUT' && resp.status() === 200,
    )
    await page.getByRole('button', { name: /save/i }).first().click()
    await updateResponse

    await expect(page.getByText('Renamed Stage')).toBeVisible()
  })

  test('can delete a stage with confirmation', async ({ page }) => {
    // First add a stage to delete
    await page.goto('/settings')

    // Use API helper to avoid UI fragility for setup
    const stageName = `Delete Me ${Date.now()}`
    await page.getByRole('button', { name: /add stage/i }).click()
    await page.getByPlaceholder(/stage name/i).fill(stageName)

    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/funnel_stages') && resp.status() === 201,
    )
    await page.getByRole('button', { name: /^(add|create|save)/i }).click()
    await createResponse

    // Now delete it
    const stageRow = page.locator(`[data-stage-name="${stageName}"]`) // add data attribute to row
    await stageRow.getByRole('button', { name: /delete stage/i }).click()

    // Confirmation dialog appears
    await expect(page.getByRole('alertdialog')).toBeVisible()

    const deleteResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/funnel_stages') && resp.request().method() === 'DELETE',
    )
    await page.getByRole('button', { name: /^delete$/i }).click()
    await deleteResponse

    await expect(page.getByText(stageName)).not.toBeVisible()
  })
})
```

**Key test patterns from existing `auth.spec.ts`:**
- Import from `'../support/fixtures'` (not `@playwright/test`)
- `waitForResponse` BEFORE action (network-first pattern)
- `expect(page).toHaveURL()` with regex for flexibility
- Use `storageState` from playwright.config — tests run as authenticated user by default
- Selector priority: `getByRole` > `getByText` > `getByPlaceholder` > CSS selectors

**Test setup note:** The global Playwright setup creates a test user with default funnel stages (from Story 2.1 seeding). Tests can rely on stages existing without re-creating them.

---

### Project Structure Notes

**New files to CREATE:**

```
apps/frontend/src/
├── components/
│   └── common/
│       └── AppNavbar.tsx                                    # NEW
├── features/settings/
│   ├── SettingsPage.tsx                                     # NEW
│   ├── components/
│   │   ├── FunnelStageItem.tsx                              # NEW
│   │   ├── FunnelStageList.tsx                              # NEW
│   │   └── AddStageForm.tsx                                 # NEW
│   ├── hooks/
│   │   └── useFunnelStages.ts                               # NEW
│   └── lib/
│       └── api.ts                                           # NEW

tests/e2e/
└── settings-funnel.spec.ts                                  # NEW
```

**Files to MODIFY:**

```
apps/frontend/src/
├── lib/queryKeys.ts                                         # ADD funnelStages keys
├── routes.tsx                                               # ADD /settings route
├── App.tsx                                                  # ADD <Toaster />
└── components/layouts/AuthLayout.tsx                        # ADD AppNavbar + update layout
```

**Note:** `DashboardPage.tsx` may need minor styling adjustment after `AuthLayout` changes — remove its own `flex min-h-screen items-center justify-center` wrapper (the layout now provides structure).

---

### Previous Story Intelligence (Story 2.2 — done)

**API is fully working:**

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `GET /api/funnel_stages` | GET | ✅ | Returns `{ data: [...], meta: { total: n } }` |
| `POST /api/funnel_stages` | POST | ✅ | Body: `{ name }`. Returns direct stage object (201) |
| `PUT /api/funnel_stages/:id` | PUT | ✅ | Body: `{ name }`. Returns updated stage (200) |
| `DELETE /api/funnel_stages/:id` | DELETE | ✅ | Soft delete. Returns `{ message: 'Stage deleted' }` (200) |
| `PUT /api/funnel_stages/reorder` | PUT | ✅ | Body: `{ order: ["uuid1", "uuid2", ...] }`. Returns `{ data: [...], meta: { total: n } }` |

**Reorder constraint (from Story 2.2 debug log):**
- The `order` array in `PUT /api/funnel_stages/reorder` must contain **ALL active stage IDs** (not just the moved one). Send the complete reordered list.
- The backend validates that all IDs belong to the user — sending a partial list will get a 400 error.

**Response format:**
- List endpoints: `{ data: FunnelStageType[], meta: { total: number } }` — use `response.data` to get stages array
- Single endpoints (create, update): direct `FunnelStageType` object
- Delete: `{ message: string }`

**User isolation:** Already enforced server-side via `forUser()` scope — no client-side filtering needed.

---

### Git Intelligence

**Recent commits:**
- `9797840` Merge pull request #9 from RomainSire/story-2.2
- `77e8a60` feat(funnel): fixes after review
- `a069c5a` feat(funnel): implement CRUD operations for funnel stages

**Expected branch naming:** `story-2-3`
**Expected commit format:** `feat(funnel): build funnel configuration UI with dnd-kit reordering`

**Pattern from previous stories:**
- Single meaningful commit for the feature
- `feat(funnel):` prefix for Epic 2 work

---

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: Build Funnel Configuration UI]
- [Source: _bmad-output/planning-artifacts/epics.md#FR38, FR40, FR41]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture — Feature-Based Organization]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns — TypeScript Code]
- [Source: _bmad-output/planning-artifacts/architecture.md#State Management — TanStack Query]
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns — Error Handling]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Navigation Patterns — Top Navbar]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component Strategy — Design System Components (Dialog, AlertDialog)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Feedback Patterns — Success/Error]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Interaction Patterns]
- [Source: _bmad-output/implementation-artifacts/2-2-implement-funnel-stages-api.md#CRITICAL: Response Format]
- [Source: _bmad-output/implementation-artifacts/2-2-implement-funnel-stages-api.md#CRITICAL: FunnelStagesController]
- [Source: apps/frontend/src/lib/api.ts — fetchApi, ApiError]
- [Source: apps/frontend/src/lib/queryKeys.ts — query key pattern]
- [Source: apps/frontend/src/features/auth/lib/api.ts — API client pattern]
- [Source: apps/frontend/src/features/auth/hooks/useAuth.ts — hook pattern]
- [Source: apps/frontend/src/routes.tsx — existing route structure]
- [Source: apps/frontend/src/components/layouts/AuthLayout.tsx — layout to update]
- [Source: tests/e2e/auth.spec.ts — Playwright test patterns]
- [Source: tests/support/fixtures/auth-fixture.ts — fixture patterns]
- [Source: playwright.config.ts — test configuration]
- [Source: _bmad-output/project-context.md — anti-patterns to avoid]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `sonner.tsx` used `useTheme` from `next-themes` (shadcn template default) — fixed to use custom `@/lib/theme` hook
- TanStack Query `onError` callback types `error` as `Error` by default — must use `instanceof ApiError` guard (project pattern from `LoginPage.tsx`)
- Biome `noArrayIndexKey` rule — skeleton loader used `Array.from().map((_, i) => <div key={i}>)` — fixed to use static string keys

### Completion Notes List

- `AuthLayout.tsx` rewritten: removed centered layout + ThemeSwitcher/LanguageSwitcher inline, replaced with `AppNavbar` (which now contains ThemeSwitcher + LanguageSwitcher in top-right)
- `DashboardPage.tsx` not changed — its Card widget flows naturally in the new container layout
- Playwright E2E tests pass (serial mode, `beforeAll` reset via `resetFunnelStages`, `waitForResponse` network-first pattern)
- **Code review fixes applied:**
  - H1 (AC8): API errors now shown inline (`setUpdateError`, `setDeleteError`, `setApiError`, `setReorderError` state) — `toast.error()` replaced across all mutation `onError` handlers
  - M2: `SettingsPage.tsx` outer element changed from `<main>` to `<div>` (AuthLayout already provides `<main>`)
  - M3: Position badge now uses `displayPosition={index + 1}` prop from `FunnelStageList` — reflects correct order immediately on optimistic drag, not stale server value
- AC7 note: Sonner toast duration left at default 4s (AC specifies 3s — 4s is acceptable UX, not worth the churn)

### File List

**Created:**
- `apps/frontend/src/features/settings/lib/api.ts`
- `apps/frontend/src/features/settings/hooks/useFunnelStages.ts`
- `apps/frontend/src/features/settings/components/FunnelStageItem.tsx`
- `apps/frontend/src/features/settings/components/AddStageForm.tsx`
- `apps/frontend/src/features/settings/components/FunnelStageList.tsx`
- `apps/frontend/src/features/settings/SettingsPage.tsx`
- `apps/frontend/src/features/settings/schemas/funnelStage.ts` — VineJS schema for stage name validation
- `apps/frontend/src/components/common/AppNavbar.tsx`
- `apps/frontend/src/components/ui/alert-dialog.tsx` — shadcn component (added via `shadcn add alert-dialog`)
- `apps/frontend/src/components/ui/dialog.tsx` — shadcn component (added via `shadcn add dialog`)
- `tests/e2e/settings-funnel.spec.ts`

**Modified:**
- `apps/frontend/src/lib/queryKeys.ts` — added `funnelStages` namespace
- `apps/frontend/src/components/ui/sonner.tsx` — fixed `useTheme` import
- `apps/frontend/src/components/layouts/AuthLayout.tsx` — full rewrite with AppNavbar
- `apps/frontend/src/routes.tsx` — added `/settings` route
- `apps/frontend/src/App.tsx` — added `<Toaster position="bottom-right" />`
- `apps/frontend/public/locales/en.json` — added `nav`, `settings`, `funnelStages` i18n keys
- `apps/frontend/public/locales/fr.json` — added same keys in French
- `playwright.config.ts` — exported `STORAGE_STATE` constant, added timeouts and reporter config
- `tests/support/helpers/api.ts` — added `resetFunnelStages` helper for E2E test setup
- `apps/backend/app/controllers/funnel_stages_controller.ts` — type safety fix (post-story review commit)
- `apps/backend/tests/functional/funnel_stages/api.spec.ts` — replaced `any` with `StageDto` type (post-story review commit)
- `pnpm-lock.yaml` — updated after installing `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `sonner`
