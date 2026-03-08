# Story 4.4: Implement Positioning Create & Edit

Status: review

<!-- Ultimate Context Engine Analysis: 2026-03-08 -->
<!-- Epic 4: Positioning Variants — Story 4 (Frontend create/edit forms on top of Story 4.2 API) -->

## Story

As a user,
I want to create and edit positioning variants for specific funnel stages,
so that I can track different versions of my outreach materials per stage.

## Acceptance Criteria

1. **AC1 (Create dialog):** An "Add Positioning" button is displayed in the `PositioningsPage` header. Clicking it opens a Dialog with fields: Name (required), Funnel Stage (required — dropdown of user's funnel stages), Description (optional), Content (optional). (FR10, FR11, FR12)

2. **AC2 (Create submit — valid data):** Submitting the create form with valid data calls `POST /api/positionings`. On success: the dialog closes, form resets, a success toast is shown, and the list is refreshed (TanStack Query invalidation). (FR10)

3. **AC3 (Create submit — validation):** Submitting with no name shows a validation error inline (VineJS + `vineResolver`). Submitting with no funnel stage selected is prevented by disabling the submit button when no stage is selected. API-level errors are shown inline below the form (no toast.error).

4. **AC4 (Edit mode):** Inside the expanded `PositioningRow`, an "Edit" button appears in the expanded section when the positioning is not archived. Clicking it switches the content to an inline edit form with fields: Name (required), Funnel Stage (required), Description (optional), Content (optional), pre-filled with current values.

5. **AC5 (Edit submit — valid data):** Submitting the edit form with valid data calls `PUT /api/positionings/:id`. On success: the form reverts to read-only view, a success toast is shown, and the list is refreshed. (FR14)

6. **AC6 (Edit cancel):** A "Cancel" button in the edit form discards changes and returns to read-only view.

7. **AC7 (Lint + type-check):** `pnpm biome check --write .` from root — 0 errors. `pnpm type-check` from root — 0 errors.

## Tasks / Subtasks

- [x] **Task 1: Extend positionings API lib** (AC2, AC5)
  - [x] 1.1 Add `create(payload: CreatePositioningPayload)` to `apps/frontend/src/features/positionings/lib/api.ts` — `POST /api/positionings`
  - [x] 1.2 Add `update(id, payload: UpdatePositioningPayload)` to `apps/frontend/src/features/positionings/lib/api.ts` — `PUT /api/positionings/:id`

- [x] **Task 2: Create VineJS schema** (AC2, AC5)
  - [x] 2.1 Create `apps/frontend/src/features/positionings/schemas/positioning.ts`
  - [x] 2.2 `createPositioningSchema`: name (required, minLength 1), description (optional), content (optional)
  - [x] 2.3 `updatePositioningSchema`: same shape

- [x] **Task 3: Create mutation hooks** (AC2, AC5)
  - [x] 3.1 Create `apps/frontend/src/features/positionings/hooks/usePositioningMutations.ts`
  - [x] 3.2 `useCreatePositioning()` — invalidates `queryKeys.positionings.all` on success
  - [x] 3.3 `useUpdatePositioning()` — invalidates `queryKeys.positionings.all` on success

- [x] **Task 4: Create AddPositioningDialog** (AC1, AC2, AC3)
  - [x] 4.1 Create `apps/frontend/src/features/positionings/components/AddPositioningDialog.tsx`
  - [x] 4.2 Dialog with trigger button (Plus icon + label), form fields, DialogFooter with Cancel + Submit
  - [x] 4.3 Initialize `funnel_stage_id` to first stage when stages data loads (same as AddProspectDialog)
  - [x] 4.4 Reset form + state on dialog close

- [x] **Task 5: Add edit mode to PositioningRow** (AC4, AC5, AC6)
  - [x] 5.1 Add `isEditing` state to `PositioningRow`
  - [x] 5.2 In read-only mode: render "Edit" button above the `dl`
  - [x] 5.3 In edit mode: render inline form (Name, Funnel Stage, Description, Content) with Save + Cancel buttons
  - [x] 5.4 Use `vineResolver(updatePositioningSchema)` + `useUpdatePositioning()`

- [x] **Task 6: Update PositioningsPage header** (AC1)
  - [x] 6.1 Change `PositioningsPage.tsx` header to `flex items-start justify-between gap-4` (like ProspectsPage)
  - [x] 6.2 Add `<AddPositioningDialog />` to the header right side

- [x] **Task 7: i18n** (AC1–AC6)
  - [x] 7.1 Add create/edit i18n keys to `apps/frontend/public/locales/en.json`
  - [x] 7.2 Add create/edit i18n keys to `apps/frontend/public/locales/fr.json`

- [x] **Task 8: Lint + type-check** (AC7)
  - [x] 8.1 `pnpm biome check --write .` from root — 0 errors (1 auto-fix in PositioningRow.tsx)
  - [x] 8.2 `pnpm type-check` from root — 0 errors across all 3 workspaces

## Dev Notes

### CRITICAL: Pure frontend story — zero backend changes needed

All API endpoints from Story 4.2 are live and tested:
- `POST /api/positionings` — creates new positioning
- `PUT /api/positionings/:id` — updates existing positioning

All payload types already exist in `@battlecrm/shared`:
- `CreatePositioningPayload` — `{ funnel_stage_id: string, name: string, description?: string | null, content?: string | null }`
- `UpdatePositioningPayload` — `{ name?: string, funnel_stage_id?: string, description?: string | null, content?: string | null }`

No migrations. No shared type changes. No backend changes.

---

### Task 1: Extend positionings API lib

**File: `apps/frontend/src/features/positionings/lib/api.ts`** — ADD `create` and `update` methods:

```typescript
import type {
  CreatePositioningPayload,
  PositioningListResponse,
  PositioningsFilterType,
  PositioningType,
  ProspectsListResponse,
  UpdatePositioningPayload,
} from '@battlecrm/shared'
import { fetchApi } from '@/lib/api'

export const positioningsApi = {
  list(filters?: PositioningsFilterType): Promise<PositioningListResponse> {
    const params = new URLSearchParams()
    if (filters?.funnel_stage_id) {
      params.set('funnel_stage_id', filters.funnel_stage_id)
    }
    const queryString = params.toString()
    return fetchApi<PositioningListResponse>(`/positionings${queryString ? `?${queryString}` : ''}`)
  },

  prospects(id: string): Promise<ProspectsListResponse> {
    return fetchApi<ProspectsListResponse>(`/positionings/${id}/prospects`)
  },

  create(payload: CreatePositioningPayload): Promise<PositioningType> {
    return fetchApi<PositioningType>('/positionings', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  update(id: string, payload: UpdatePositioningPayload): Promise<PositioningType> {
    return fetchApi<PositioningType>(`/positionings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
}
```

**Import order (Biome):** `@battlecrm/shared` (@ scoped external) → `@/lib/api` (@ path alias).

---

### Task 2: VineJS Schema

**File: `apps/frontend/src/features/positionings/schemas/positioning.ts`** (NEW):

```typescript
import vine from '@vinejs/vine'

export const createPositioningSchema = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    description: vine.string().trim().optional(),
    content: vine.string().trim().optional(),
  }),
)

export const updatePositioningSchema = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    description: vine.string().trim().optional(),
    content: vine.string().trim().optional(),
  }),
)
```

**Note:** `funnel_stage_id` is NOT in the VineJS schema because it is managed via a separate `useState` (not via `register`) — same pattern as `AddProspectDialog` where `selectedStageId` is its own state variable controlled by the shadcn `Select`.

**Note:** `@vinejs/vine` is already installed — see `apps/frontend/package.json`. `@hookform/resolvers/vine` is also installed.

---

### Task 3: Mutation Hooks

**File: `apps/frontend/src/features/positionings/hooks/usePositioningMutations.ts`** (NEW):

```typescript
import type { CreatePositioningPayload, UpdatePositioningPayload } from '@battlecrm/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { positioningsApi } from '../lib/api'

export function useCreatePositioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePositioningPayload) => positioningsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.positionings.all })
    },
  })
}

export function useUpdatePositioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdatePositioningPayload) =>
      positioningsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.positionings.all })
    },
  })
}
```

**Import order:** `@battlecrm/shared` → `@tanstack/react-query` → `@/lib/queryKeys` → relative `../lib/api`.
**Pattern source:** `apps/frontend/src/features/prospects/hooks/useProspectMutations.ts` — identical shape.

---

### Task 4: AddPositioningDialog Component

**File: `apps/frontend/src/features/positionings/components/AddPositioningDialog.tsx`** (NEW):

```typescript
import { vineResolver } from '@hookform/resolvers/vine'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { useCreatePositioning } from '../hooks/usePositioningMutations'
import { createPositioningSchema } from '../schemas/positioning'

interface FormValues {
  name: string
  description: string
  content: string
}

export function AddPositioningDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [selectedStageId, setSelectedStageId] = useState<string>('')

  const create = useCreatePositioning()
  const { data: stagesData } = useFunnelStages()
  const stages = stagesData?.data ?? []

  // Initialize selected stage to first stage when data loads
  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) {
      setSelectedStageId(stages[0].id)
    }
  }, [stages, selectedStageId])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: vineResolver(createPositioningSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: {
      name: '',
      description: '',
      content: '',
    },
  })

  function onSubmit(values: FormValues) {
    setApiError(null)
    const payload = {
      funnel_stage_id: selectedStageId,
      name: values.name.trim(),
      ...(values.description.trim() && { description: values.description.trim() }),
      ...(values.content.trim() && { content: values.content.trim() }),
    }
    create.mutate(payload, {
      onSuccess: () => {
        reset()
        setOpen(false)
        toast.success(t('positionings.toast.created'))
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setApiError(message ?? t('positionings.toast.createFailed'))
      },
    })
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      reset()
      setApiError(null)
      setSelectedStageId(stages[0]?.id ?? '')
    }
    setOpen(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          {t('positionings.addPositioning')}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('positionings.createForm.title')}</DialogTitle>
          <DialogDescription>{t('positionings.createForm.description')}</DialogDescription>
        </DialogHeader>

        <form id="create-positioning-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Name — required */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="positioning-name">
              {t('positionings.fields.name')}{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id="positioning-name"
              {...register('name')}
              placeholder={t('positionings.placeholders.name')}
              autoFocus
            />
            <FieldError errors={[errors.name]} />
          </div>

          {/* Funnel Stage — required */}
          {stages.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="positioning-stage">
                {t('positionings.fields.funnelStage')}{' '}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </Label>
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                <SelectTrigger id="positioning-stage" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description — optional */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="positioning-description">{t('positionings.fields.description')}</Label>
            <Textarea
              id="positioning-description"
              {...register('description')}
              placeholder={t('positionings.placeholders.description')}
              rows={2}
            />
          </div>

          {/* Content — optional */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="positioning-content">{t('positionings.fields.content')}</Label>
            <Textarea
              id="positioning-content"
              {...register('content')}
              placeholder={t('positionings.placeholders.content')}
              rows={4}
            />
          </div>

          {/* API-level error */}
          <FieldError>{apiError}</FieldError>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="create-positioning-form"
            disabled={create.isPending || !selectedStageId}
          >
            {create.isPending ? '...' : t('positionings.createForm.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Key notes:**
- `funnel_stage_id` is NOT registered in react-hook-form — it's a `useState` like `AddProspectDialog`. This mirrors the existing pattern exactly.
- Submit button is `disabled` when `!selectedStageId` (no stage loaded yet) — this prevents create without a stage.
- `Controller` is NOT needed — no `PhoneInput` equivalent. All fields use `register`.
- `DialogContent` default max-width is `sm:max-w-lg`. The content field (Textarea rows=4) will fit without scrolling.

**Import order (Biome):** `@hookform/resolvers/vine` → `lucide-react` → `react` → `react-hook-form` → `react-i18next` → `sonner` → `@/components/ui/*` (alphabetical) → `@/features/settings/hooks/useFunnelStages` → `@/lib/api` → `@/lib/validation` → relative `../hooks` → relative `../schemas`.

---

### Task 5: Edit Mode in PositioningRow

**File: `apps/frontend/src/features/positionings/components/PositioningRow.tsx`** — REWRITE with edit mode added:

```typescript
import type { PositioningType } from '@battlecrm/shared'
import { vineResolver } from '@hookform/resolvers/vine'
import { Pencil, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { usePositioningProspects } from '../hooks/usePositioningProspects'
import { useUpdatePositioning } from '../hooks/usePositioningMutations'
import { updatePositioningSchema } from '../schemas/positioning'

interface PositioningRowProps {
  positioning: PositioningType
}

interface EditFormValues {
  name: string
  description: string
  content: string
}

export function PositioningRow({ positioning }: PositioningRowProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [editStageId, setEditStageId] = useState<string>(positioning.funnelStageId)

  const { data: prospectsData, isLoading: prospectsLoading } = usePositioningProspects(
    positioning.id,
  )
  const linkedProspects = prospectsData?.data ?? []

  const { data: stagesData } = useFunnelStages()
  const stages = stagesData?.data ?? []

  const update = useUpdatePositioning()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: vineResolver(updatePositioningSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: {
      name: positioning.name,
      description: positioning.description ?? '',
      content: positioning.content ?? '',
    },
  })

  // Reset form if positioning prop changes (e.g. after external update)
  useEffect(() => {
    if (!isEditing) {
      reset({
        name: positioning.name,
        description: positioning.description ?? '',
        content: positioning.content ?? '',
      })
      setEditStageId(positioning.funnelStageId)
    }
  }, [positioning, isEditing, reset])

  function handleEditStart() {
    reset({
      name: positioning.name,
      description: positioning.description ?? '',
      content: positioning.content ?? '',
    })
    setEditStageId(positioning.funnelStageId)
    setApiError(null)
    setIsEditing(true)
  }

  function handleCancel() {
    reset()
    setApiError(null)
    setIsEditing(false)
  }

  function onSubmit(values: EditFormValues) {
    setApiError(null)
    update.mutate(
      {
        id: positioning.id,
        name: values.name.trim(),
        funnel_stage_id: editStageId,
        description: values.description.trim() || null,
        content: values.content.trim() || null,
      },
      {
        onSuccess: () => {
          setIsEditing(false)
          toast.success(t('positionings.toast.updated'))
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          setApiError(message ?? t('positionings.toast.updateFailed'))
        },
      },
    )
  }

  return (
    <AccordionItem value={positioning.id}>
      <AccordionTrigger className="items-center px-4 py-3 hover:bg-accent hover:no-underline">
        <span className="min-w-0 flex-1 truncate font-medium">{positioning.name}</span>
        <span className="w-40 shrink-0">
          <Badge variant="secondary">{positioning.funnelStageName}</Badge>
        </span>
        <span className="w-64 shrink-0 truncate text-sm text-muted-foreground">
          {positioning.description ?? '—'}
        </span>
      </AccordionTrigger>

      <AccordionContent className="p-0">
        <div className="space-y-4 border-t bg-muted/30 px-4 py-4">
          {isEditing ? (
            /* ── EDIT MODE ── */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              {/* Name — required */}
              <div className="flex flex-col gap-1">
                <Label htmlFor={`edit-name-${positioning.id}`}>
                  {t('positionings.fields.name')}{' '}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </Label>
                <Input
                  id={`edit-name-${positioning.id}`}
                  {...register('name')}
                  autoFocus
                />
                <FieldError errors={[errors.name]} />
              </div>

              {/* Funnel Stage — required */}
              {stages.length > 0 && (
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`edit-stage-${positioning.id}`}>
                    {t('positionings.fields.funnelStage')}{' '}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </Label>
                  <Select value={editStageId} onValueChange={setEditStageId}>
                    <SelectTrigger id={`edit-stage-${positioning.id}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Description — optional */}
              <div className="flex flex-col gap-1">
                <Label htmlFor={`edit-description-${positioning.id}`}>
                  {t('positionings.fields.description')}
                </Label>
                <Textarea
                  id={`edit-description-${positioning.id}`}
                  {...register('description')}
                  rows={2}
                />
              </div>

              {/* Content — optional */}
              <div className="flex flex-col gap-1">
                <Label htmlFor={`edit-content-${positioning.id}`}>
                  {t('positionings.fields.content')}
                </Label>
                <Textarea
                  id={`edit-content-${positioning.id}`}
                  {...register('content')}
                  rows={4}
                />
              </div>

              {/* API error */}
              <FieldError>{apiError}</FieldError>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={update.isPending}>
                  {update.isPending ? '...' : t('common.save')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleCancel}
                >
                  <X className="size-4" />
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          ) : (
            /* ── READ-ONLY MODE ── */
            <>
              {/* Edit button */}
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={handleEditStart}>
                  <Pencil className="size-4" />
                  {t('positionings.edit')}
                </Button>
              </div>

              {/* Details */}
              <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t('positionings.fields.funnelStage')}</dt>
                <dd>
                  <Badge variant="secondary">{positioning.funnelStageName}</Badge>
                </dd>

                <dt className="text-muted-foreground">{t('positionings.fields.description')}</dt>
                <dd className="whitespace-pre-wrap">
                  {positioning.description ?? <span className="italic text-muted-foreground">—</span>}
                </dd>

                <dt className="text-muted-foreground">{t('positionings.fields.content')}</dt>
                <dd className="whitespace-pre-wrap">
                  {positioning.content ?? <span className="italic text-muted-foreground">—</span>}
                </dd>
              </dl>

              {/* Linked prospects */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {t('positionings.linkedProspects.title')}
                </p>
                {prospectsLoading ? (
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : linkedProspects.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">
                    {t('positionings.linkedProspects.empty')}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {linkedProspects.map((prospect) => (
                      <li key={prospect.id} className="text-sm">
                        <span className="font-medium">{prospect.name}</span>
                        {prospect.company && (
                          <span className="ml-2 text-muted-foreground">— {prospect.company}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Interactions — placeholder for Epic 5 */}
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t('positionings.interactions.title')}
                </p>
                <p className="text-xs italic text-muted-foreground">
                  {t('positionings.interactions.comingSoon')}
                </p>
              </div>
            </>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
```

**Key notes:**
- `useFunnelStages()` is added to this component for the edit stage dropdown (already imported in `PositioningsList.tsx` — TanStack Query deduplicates the request).
- `isEditing` resets to `false` when the accordion item is closed externally — the `AccordionItem` handles unmount/remount via the parent `Accordion`. However, to avoid stale edit state when switching between items, you may also reset in the accordion's `onValueChange` callback in `PositioningsList` — but this is not strictly necessary since each row has its own `isEditing` state.
- **Import order (Biome):** `@battlecrm/shared` → `@hookform/resolvers/vine` → `lucide-react` → `react` (useEffect, useState) → `react-hook-form` → `react-i18next` → `sonner` → `@/components/ui/*` (alphabetical: accordion, badge, button, field, input, label, select, skeleton, textarea) → `@/features/settings/hooks/useFunnelStages` → `@/lib/api` → `@/lib/validation` → relative `../hooks/*` → relative `../schemas/positioning`.

---

### Task 6: Update PositioningsPage Header

**File: `apps/frontend/src/features/positionings/PositioningsPage.tsx`** — MODIFY header to add the "Add" button:

```typescript
import { useTranslation } from 'react-i18next'
import { AddPositioningDialog } from './components/AddPositioningDialog'
import { PositioningsList } from './components/PositioningsList'

export function PositioningsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('positionings.title')}</h1>
          <p className="text-muted-foreground">{t('positionings.description')}</p>
        </div>
        <AddPositioningDialog />
      </header>

      <section>
        <PositioningsList />
      </section>
    </div>
  )
}
```

**Pattern source:** `apps/frontend/src/features/prospects/ProspectsPage.tsx` — identical header layout.

---

### Task 7: i18n Keys

**File: `apps/frontend/public/locales/en.json`** — ADD to the `positionings` block:

```json
"positionings": {
  "title": "Positionings",
  "description": "Manage your positioning variants per funnel stage.",
  "addPositioning": "Add Positioning",
  "edit": "Edit",
  "loadError": "Failed to load positionings. Please try again.",
  "empty": "No positionings yet.",
  "emptyFiltered": "No positionings for this stage.",
  "clearFilter": "Clear filter",
  "count": "{{count}} positioning(s)",
  "columns": {
    "name": "Name",
    "stage": "Funnel Stage",
    "description": "Description"
  },
  "fields": {
    "name": "Name",
    "funnelStage": "Funnel Stage",
    "description": "Description",
    "content": "Content"
  },
  "placeholders": {
    "name": "e.g. CV v3 — Architecture Focus",
    "description": "Why this variant was created...",
    "content": "Actual content or file reference..."
  },
  "createForm": {
    "title": "Add Positioning",
    "description": "Create a new positioning variant for a funnel stage.",
    "submit": "Create"
  },
  "toast": {
    "created": "Positioning created.",
    "createFailed": "Failed to create positioning.",
    "updated": "Positioning updated.",
    "updateFailed": "Failed to update positioning."
  },
  "linkedProspects": {
    "title": "Linked Prospects",
    "empty": "No prospects linked to this positioning yet."
  },
  "interactions": {
    "title": "Interactions",
    "comingSoon": "Coming in a future release"
  }
}
```

**File: `apps/frontend/public/locales/fr.json`** — ADD to the `positionings` block:

```json
"positionings": {
  "title": "Positionnements",
  "description": "Gérez vos variantes de positionnement par étape du funnel.",
  "addPositioning": "Ajouter un positionnement",
  "edit": "Modifier",
  "loadError": "Impossible de charger les positionnements. Veuillez réessayer.",
  "empty": "Aucun positionnement pour le moment.",
  "emptyFiltered": "Aucun positionnement pour cette étape.",
  "clearFilter": "Effacer le filtre",
  "count": "{{count}} positionnement(s)",
  "columns": {
    "name": "Nom",
    "stage": "Étape du funnel",
    "description": "Description"
  },
  "fields": {
    "name": "Nom",
    "funnelStage": "Étape du funnel",
    "description": "Description",
    "content": "Contenu"
  },
  "placeholders": {
    "name": "ex. CV v3 — Focus Architecture",
    "description": "Pourquoi cette variante a été créée...",
    "content": "Contenu réel ou référence de fichier..."
  },
  "createForm": {
    "title": "Ajouter un positionnement",
    "description": "Créez une nouvelle variante de positionnement pour une étape du funnel.",
    "submit": "Créer"
  },
  "toast": {
    "created": "Positionnement créé.",
    "createFailed": "Impossible de créer le positionnement.",
    "updated": "Positionnement mis à jour.",
    "updateFailed": "Impossible de mettre à jour le positionnement."
  },
  "linkedProspects": {
    "title": "Prospects liés",
    "empty": "Aucun prospect lié à ce positionnement."
  },
  "interactions": {
    "title": "Interactions",
    "comingSoon": "Disponible dans une prochaine version"
  }
}
```

**⚠️ IMPORTANT:** Replace the ENTIRE `positionings` block in each file (not just append). The existing block is missing `fields.name`, `placeholders`, `createForm`, `toast`, `addPositioning`, and `edit` keys.

---

### Architecture Compliance

- All server state via TanStack Query — mutations invalidate `queryKeys.positionings.all`
- All API calls through `fetchApi` with `credentials: 'include'` (inherited)
- Types from `@battlecrm/shared` — `CreatePositioningPayload`, `UpdatePositioningPayload`, `PositioningType` — never redefine locally
- API response fields camelCase (`funnelStageName`, `funnelStageId`) — Lucid v3 default
- API request payloads snake_case (`funnel_stage_id`, `description`, `content`) — VineJS convention
- **No `toast.error()`** — API errors shown inline via `setApiError` + `<FieldError>`
- **`toast.success()`** for successful mutations only
- Feature-based org: all new files under `src/features/positionings/`
- Semantic HTML: `<form>`, `<Label>`, semantic elements inside Dialog and AccordionContent
- shadcn components: `Button`, `Input`, `Label`, `Textarea`, `Select`, `Dialog`, `Badge`, `Skeleton`, `FieldError`
- VineJS + `vineResolver` for frontend validation (NOT Zod)
- `funnel_stage_id` managed as separate `useState` (not `register`) — consistent with `AddProspectDialog` pattern

### Project Structure Notes

**New files:**
- `apps/frontend/src/features/positionings/components/AddPositioningDialog.tsx`
- `apps/frontend/src/features/positionings/hooks/usePositioningMutations.ts`
- `apps/frontend/src/features/positionings/schemas/positioning.ts`

**Modified files:**
- `apps/frontend/src/features/positionings/lib/api.ts` — add `create()` and `update()` methods
- `apps/frontend/src/features/positionings/components/PositioningRow.tsx` — add edit mode (isEditing state, inline form, useUpdatePositioning, useFunnelStages)
- `apps/frontend/src/features/positionings/PositioningsPage.tsx` — header layout + AddPositioningDialog
- `apps/frontend/public/locales/en.json` — replace positionings block (adds name field, placeholders, createForm, toast, addPositioning, edit keys)
- `apps/frontend/public/locales/fr.json` — replace positionings block (same)

**No backend changes.** No migration. No shared type changes.

### Previous Story Intelligence (4.3)

- `PositioningRow` was REFACTORED in Story 4.3 to use shadcn `AccordionItem/Trigger/Content` (replacing the custom `<article>` + `<button aria-expanded>` pattern). The current `PositioningRow.tsx` uses `AccordionItem`. This story's edit mode must integrate WITHIN `AccordionContent`.
- `PositioningsList.tsx` uses controlled `<Accordion type="single" collapsible value={expandedId}...>` — the `expandedId` state in `PositioningsList` controls which item is open. No changes needed to `PositioningsList` for edit support.
- `useFunnelStages()` is already called in `PositioningsList.tsx` — adding it in `PositioningRow.tsx` is safe; TanStack Query deduplicates.
- `@/lib/validation` exports `i18nMessagesProvider` (used in `AddProspectDialog` and `ProspectDetail`).
- `@/lib/api` exports `ApiError` class used for error extraction.
- `common.save` and `common.cancel` translation keys exist in both i18n files (used in ProspectDetail).

### Git Intelligence

Recent relevant commits:
- `886c037` Merge PR #23 story-4.3 — positionings list view, accordion refactor, badges
- `a5d555b` feat(positionings): finalize build of positionings list view and improve UI components — ProspectRow refactored to Accordion, AppNavbar enabled
- `6c7f129` feat(positionings): implement UI positionings feature — PositioningsPage, list, row, hooks, api lib, i18n
- `98662d8` Merge PR #22 story-4.2 — positionings CRUD API + 31 tests

**Confirmed patterns for this story:**
1. Create dialog: `AddProspectDialog` pattern — `Dialog` + `DialogTrigger` + `useForm` + `vineResolver` + separate state for Select
2. Inline edit: `ProspectDetail` pattern — `isEditing` toggle, inline form with Save/Cancel, `useUpdateX` mutation
3. Mutation hooks: `useProspectMutations` pattern — `useMutation` + `invalidateQueries(queryKeys.X.all)`
4. VineJS schema: `vine.compile(vine.object({...}))` — separate create/update schemas
5. Error handling: `ApiError` instanceof check → `error.errors[0]?.message` → fallback i18n key
6. AccordionItem: `value={positioning.id}` — matches the `value` prop in `PositioningsList` Accordion

### References

- [Source: apps/frontend/src/features/prospects/components/AddProspectDialog.tsx] — create dialog pattern
- [Source: apps/frontend/src/features/prospects/components/ProspectDetail.tsx] — inline edit mode pattern
- [Source: apps/frontend/src/features/prospects/hooks/useProspectMutations.ts] — mutation hooks pattern
- [Source: apps/frontend/src/features/prospects/schemas/prospect.ts] — VineJS schema pattern
- [Source: apps/frontend/src/features/prospects/ProspectsPage.tsx] — page header with dialog button
- [Source: apps/frontend/src/features/positionings/components/PositioningRow.tsx] — current Accordion-based row
- [Source: apps/frontend/src/features/positionings/components/PositioningsList.tsx] — controlled Accordion parent
- [Source: apps/frontend/src/features/positionings/lib/api.ts] — current api lib to extend
- [Source: packages/shared/src/types/positioning.ts] — PositioningType, CreatePositioningPayload, UpdatePositioningPayload
- [Source: apps/frontend/src/lib/queryKeys.ts] — queryKeys.positionings.all for invalidation
- [Source: apps/frontend/public/locales/en.json] — current positionings i18n block to replace
- [Source: apps/frontend/public/locales/fr.json] — current positionings i18n block to replace
- [Source: _bmad-output/project-context.md] — anti-patterns (no toast.error, no Zod, VineJS only)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Pure frontend story — zero backend changes. All API endpoints from Story 4.2 consumed directly.
- `positioningsApi.create()` and `.update()` added to existing api lib — identical pattern to `prospectsApi`.
- `createPositioningSchema` / `updatePositioningSchema` created with VineJS (`name` required, `description`/`content` optional) — `funnel_stage_id` NOT in schema, managed via separate `useState` like `AddProspectDialog`.
- `useCreatePositioning()` / `useUpdatePositioning()` invalidate `queryKeys.positionings.all` on success — mirrors `useProspectMutations` shape exactly.
- `AddPositioningDialog`: Dialog pattern from `AddProspectDialog`. Stage initialized to first stage on data load; form + state reset on dialog close; submit disabled when no stage selected.
- `PositioningRow` rewritten with `isEditing` toggle — inline form in edit mode (ProspectDetail pattern), read-only `dl` + Edit button otherwise. `useFunnelStages()` added for stage select in edit form (TanStack Query deduplicates).
- `PositioningsPage` header changed to flex justify-between to accommodate dialog trigger button.
- i18n: positionings block replaced in both locales — added `addPositioning`, `edit`, `fields.name`, `placeholders`, `createForm`, `toast` keys.
- Biome auto-fixed 1 file: import sort in `PositioningRow.tsx` (`useUpdatePositioning` import moved after `usePositioningProspects` alphabetically).
- `pnpm type-check` — 0 errors across shared, backend, frontend workspaces.

### File List

- `apps/frontend/src/features/positionings/lib/api.ts` — MODIFIED: added `create()` and `update()` methods
- `apps/frontend/src/features/positionings/schemas/positioning.ts` — NEW: `createPositioningSchema`, `updatePositioningSchema`
- `apps/frontend/src/features/positionings/hooks/usePositioningMutations.ts` — NEW: `useCreatePositioning`, `useUpdatePositioning`
- `apps/frontend/src/features/positionings/components/AddPositioningDialog.tsx` — NEW: create dialog with trigger button, form, validation
- `apps/frontend/src/features/positionings/components/PositioningRow.tsx` — MODIFIED: added edit mode (isEditing, inline form, useUpdatePositioning, useFunnelStages)
- `apps/frontend/src/features/positionings/PositioningsPage.tsx` — MODIFIED: header flex layout + AddPositioningDialog
- `apps/frontend/public/locales/en.json` — MODIFIED: positionings block with new keys
- `apps/frontend/public/locales/fr.json` — MODIFIED: positionings block with new keys
