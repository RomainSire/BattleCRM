# Story 4.5: Add Positioning Archive & Prospect Linking

Status: done

<!-- Ultimate Context Engine Analysis: 2026-03-11 -->
<!-- Epic 4: Positioning Variants — Story 5 (Archive + prospect navigation links in PositioningRow) -->

## Story

As a user,
I want to archive old positionings and see which prospects received each variant,
so that I can maintain a clean list while preserving historical data.

## Acceptance Criteria

1. **AC1 (Archive button):** In the expanded `PositioningRow` read-only mode, an "Archive" button appears in the action bar (alongside the "Edit" button). The button uses the destructive style (border-destructive/40, text-destructive). Clicking it opens an `AlertDialog` confirmation. (FR15)

2. **AC2 (Archive confirm):** Confirming the AlertDialog calls `DELETE /api/positionings/:id`. On success: the positioning disappears from the active list (TanStack Query invalidation of `queryKeys.positionings.all`), and a success toast is shown. (FR15)

3. **AC3 (Archive error):** If the archive API call fails, an inline error message appears below the action bar (no `toast.error`). The positioning remains in the list.

4. **AC4 (Linked prospects — navigation):** In the expanded `PositioningRow` read-only mode, each linked prospect in the "Linked Prospects" list is displayed as a clickable `<Link>` that navigates to `/prospects`. Name and company are shown as before. (FR16)

5. **AC5 (Interactions placeholder — unchanged):** The "Interactions" section in the expanded row keeps its existing "Coming in a future release" placeholder. No backend interaction data exists yet (Epic 5). (FR17)

6. **AC6 (Lint + type-check):** `pnpm biome check --write .` from root — 0 errors. `pnpm type-check` from root — 0 errors.

## Tasks / Subtasks

- [x] **Task 1: Add archive method to positionings API lib** (AC2)
  - [x] 1.1 Add `archive(id: string)` to `apps/frontend/src/features/positionings/lib/api.ts` — calls `DELETE /api/positionings/:id`

- [x] **Task 2: Add `useArchivePositioning` mutation hook** (AC2, AC3)
  - [x] 2.1 Add `useArchivePositioning()` to `apps/frontend/src/features/positionings/hooks/usePositioningMutations.ts`
  - [x] 2.2 On success: invalidate `queryKeys.positionings.all`

- [x] **Task 3: Add Archive button + AlertDialog to PositioningRow** (AC1, AC2, AC3)
  - [x] 3.1 Import `AlertDialog` components, `Archive` icon (lucide-react), `Link` (react-router), `useArchivePositioning`
  - [x] 3.2 Add `archiveError` state (`string | null`)
  - [x] 3.3 In read-only mode action bar: add `AlertDialog` with destructive-styled trigger button, title/description, Cancel + Confirm actions
  - [x] 3.4 `handleArchiveConfirm`: call `archive.mutate(id)`, on success → `toast.success`, on error → `setArchiveError`
  - [x] 3.5 Render `archiveError` inline below the action bar if non-null

- [x] **Task 4: Add navigation links to linked prospects** (AC4)
  - [x] 4.1 In the "Linked Prospects" list in `PositioningRow`, wrap each prospect `<li>` content in a `<Link to="/prospects">` from `react-router`
  - [x] 4.2 Style the link: `text-primary underline-offset-4 hover:underline`

- [x] **Task 5: i18n keys** (AC1–AC3)
  - [x] 5.1 Add archive-related keys to `apps/frontend/public/locales/en.json` under `positionings`
  - [x] 5.2 Add archive-related keys to `apps/frontend/public/locales/fr.json` under `positionings`

- [x] **Task 6: Lint + type-check** (AC6)
  - [x] 6.1 `pnpm biome check --write .` from root — 0 errors (1 auto-fix in PositioningRow.tsx: formatting inside Link)
  - [x] 6.2 `pnpm type-check` from root — 0 errors across all 3 workspaces

## Dev Notes

### CRITICAL: Mostly frontend — zero backend changes needed

All required backend endpoints from Story 4.2 are already live and tested:
- `DELETE /api/positionings/:id` — soft-deletes positioning (sets `deleted_at`)
- `GET /api/positionings/:id/prospects` — returns linked prospects (already used)

**No migrations. No shared type changes. No new backend endpoints.**

---

### Task 1: Add `archive()` to positionings API lib

**File: `apps/frontend/src/features/positionings/lib/api.ts`** — ADD `archive` method:

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

  archive(id: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/positionings/${id}`, {
      method: 'DELETE',
    })
  },
}
```

**Pattern source:** `apps/frontend/src/features/prospects/lib/api.ts` — `archive()` method is identical in shape.

---

### Task 2: Add `useArchivePositioning` hook

**File: `apps/frontend/src/features/positionings/hooks/usePositioningMutations.ts`** — ADD at the end:

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

export function useArchivePositioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => positioningsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.positionings.all })
    },
  })
}
```

**Pattern source:** `apps/frontend/src/features/prospects/hooks/useProspectMutations.ts` — `useArchiveProspect()` is identical.

---

### Task 3 & 4: PositioningRow — Archive button + Prospect links

**File: `apps/frontend/src/features/positionings/components/PositioningRow.tsx`** — MODIFY:

Key changes from current state:
1. Add imports: `AlertDialog*` components, `Archive` from `lucide-react`, `Link` from `react-router`, `useArchivePositioning`
2. Add `archiveError` state
3. In read-only mode action bar: add `AlertDialog` with `handleArchiveConfirm`
4. Linked prospects list: wrap each item content in `<Link to="/prospects">`

```typescript
import type { PositioningType } from '@battlecrm/shared'
import { vineResolver } from '@hookform/resolvers/vine'
import { Archive, Pencil, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
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
import { useArchivePositioning, useUpdatePositioning } from '../hooks/usePositioningMutations'
import { usePositioningProspects } from '../hooks/usePositioningProspects'
import { updatePositioningSchema } from '../schemas/positioning'

interface PositioningRowProps {
  positioning: PositioningType
  isOpen: boolean
}

interface EditFormValues {
  name: string
  description: string
  content: string
}

export function PositioningRow({ positioning, isOpen }: PositioningRowProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [editStageId, setEditStageId] = useState<string>(positioning.funnelStageId)

  const { data: prospectsData, isLoading: prospectsLoading } = usePositioningProspects(
    positioning.id,
    { enabled: isOpen },
  )
  const linkedProspects = prospectsData?.data ?? []

  const { data: stagesData, isLoading: stagesLoading, isError: stagesError } = useFunnelStages()
  const stages = stagesData?.data ?? []

  const update = useUpdatePositioning()
  const archive = useArchivePositioning()

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

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false)
      setApiError(null)
      setArchiveError(null)
    }
  }, [isOpen])

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

  function handleArchiveConfirm() {
    setArchiveError(null)
    archive.mutate(positioning.id, {
      onSuccess: () => {
        toast.success(t('positionings.toast.archived'))
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setArchiveError(message ?? t('positionings.toast.archiveFailed'))
      },
    })
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
                  disabled={update.isPending}
                />
                <FieldError errors={[errors.name]} />
              </div>

              {/* Funnel Stage — required */}
              {stagesError ? (
                <p className="text-xs text-destructive">{t('funnelStages.loadError')}</p>
              ) : stagesLoading ? (
                <div className="flex flex-col gap-1">
                  <Label>
                    {t('positionings.fields.funnelStage')}{' '}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </Label>
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : stages.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`edit-stage-${positioning.id}`}>
                    {t('positionings.fields.funnelStage')}{' '}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </Label>
                  <Select
                    value={editStageId}
                    onValueChange={setEditStageId}
                    disabled={update.isPending}
                  >
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
              ) : null}

              {/* Description — optional */}
              <div className="flex flex-col gap-1">
                <Label htmlFor={`edit-description-${positioning.id}`}>
                  {t('positionings.fields.description')}
                </Label>
                <Textarea
                  id={`edit-description-${positioning.id}`}
                  {...register('description')}
                  placeholder={t('positionings.placeholders.description')}
                  rows={2}
                  disabled={update.isPending}
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
                  placeholder={t('positionings.placeholders.content')}
                  rows={4}
                  disabled={update.isPending}
                />
              </div>

              {/* API error */}
              <FieldError>{apiError}</FieldError>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={update.isPending}>
                  {update.isPending ? '...' : t('common.save')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={handleCancel}>
                  <X className="size-4" />
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          ) : (
            /* ── READ-ONLY MODE ── */
            <>
              {/* Action bar: Edit + Archive */}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={handleEditStart}>
                  <Pencil className="size-4" />
                  {t('positionings.edit')}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Archive className="size-4" />
                      {t('positionings.archive')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t('positionings.archiveDialog.title')}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('positionings.archiveDialog.description', {
                          name: positioning.name,
                        })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleArchiveConfirm}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={archive.isPending}
                      >
                        {t('positionings.archiveDialog.confirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {archiveError && (
                  <p className="text-xs text-destructive">{archiveError}</p>
                )}
              </div>

              {/* Details */}
              <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t('positionings.fields.funnelStage')}</dt>
                <dd>
                  <Badge variant="secondary">{positioning.funnelStageName}</Badge>
                </dd>

                <dt className="text-muted-foreground">{t('positionings.fields.description')}</dt>
                <dd className="whitespace-pre-wrap">
                  {positioning.description ?? (
                    <span className="italic text-muted-foreground">—</span>
                  )}
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
                        <Link
                          to="/prospects"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          <span className="font-medium">{prospect.name}</span>
                          {prospect.company && (
                            <span className="ml-2 text-muted-foreground">
                              — {prospect.company}
                            </span>
                          )}
                        </Link>
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

**Import order (Biome):** `@battlecrm/shared` → `@hookform/resolvers/vine` → `lucide-react` → `react` → `react-hook-form` → `react-i18next` → `react-router` → `sonner` → `@/components/ui/*` (alphabetical: accordion, alert-dialog, badge, button, field, input, label, select, skeleton, textarea) → `@/features/settings/hooks/useFunnelStages` → `@/lib/api` → `@/lib/validation` → relative `../hooks/*` → relative `../schemas/positioning`.

**⚠️ NOTE — `alert-dialog` shadcn component:** Verify it's installed by checking `apps/frontend/src/components/ui/alert-dialog.tsx`. It was used in `ProspectDetail`, so it's already installed. No `npx shadcn add` needed.

---

### Task 5: i18n Keys

**File: `apps/frontend/public/locales/en.json`** — ADD to the `positionings` block:

```json
"archive": "Archive",
"archiveDialog": {
  "title": "Archive positioning?",
  "description": "\"{{name}}\" will be archived. It will no longer appear in the active list, but historical data (prospects, interactions) will be preserved.",
  "confirm": "Archive"
},
"toast": {
  "created": "Positioning created.",
  "createFailed": "Failed to create positioning.",
  "updated": "Positioning updated.",
  "updateFailed": "Failed to update positioning.",
  "archived": "Positioning archived.",
  "archiveFailed": "Failed to archive positioning."
}
```

**File: `apps/frontend/public/locales/fr.json`** — ADD to the `positionings` block:

```json
"archive": "Archiver",
"archiveDialog": {
  "title": "Archiver ce positionnement ?",
  "description": "\"{{name}}\" sera archivé. Il n'apparaîtra plus dans la liste active, mais les données historiques (prospects, interactions) seront conservées.",
  "confirm": "Archiver"
},
"toast": {
  "created": "Positionnement créé.",
  "createFailed": "Impossible de créer le positionnement.",
  "updated": "Positionnement mis à jour.",
  "updateFailed": "Impossible de mettre à jour le positionnement.",
  "archived": "Positionnement archivé.",
  "archiveFailed": "Impossible d'archiver le positionnement."
}
```

**⚠️ IMPORTANT:** The `toast` block must REPLACE the existing one (which has `created/createFailed/updated/updateFailed`) — add `archived/archiveFailed` to it. Do NOT create a duplicate `toast` key. Also add the new `archive` and `archiveDialog` keys alongside the existing keys in the `positionings` block.

---

### Architecture Compliance

- All server state via TanStack Query — `useArchivePositioning` invalidates `queryKeys.positionings.all` on success
- All API calls through `fetchApi` with `credentials: 'include'` (inherited via `fetchApi`)
- Types from `@battlecrm/shared` — `PositioningType` (linked prospects use `ProspectType` from shared via `ProspectsListResponse`)
- API response fields camelCase (`funnelStageName`, `funnelStageId`) — Lucid v3 default
- **No `toast.error()`** — API errors shown inline via `setArchiveError` + inline `<p className="text-xs text-destructive">`
- **`toast.success()`** for successful archive mutation
- Feature-based org: all new/modified files under `src/features/positionings/`
- Semantic HTML: `<Link>` from react-router (renders `<a>`) for prospect navigation
- shadcn `AlertDialog` used for archive confirmation — same as `ProspectDetail` pattern
- Destructive button style: `border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive` — exact copy from `ProspectDetail`

### Project Structure Notes

**Alignment with unified project structure:**
- `apps/frontend/src/features/positionings/` — feature folder (all changes here)
- `apps/frontend/public/locales/` — i18n files (add keys, do NOT replace entire block)
- Routes: `/prospects` exists (`routes.tsx` line 21) — safe to link to

**No route change needed:** There is NO `/prospects/:id` route in the app (routes.tsx). The router only has `/prospects` (list page). Linked prospects therefore navigate to `/prospects` (the list page). A per-prospect detail URL route is out of scope for this story.

**Modified files:**
- `apps/frontend/src/features/positionings/lib/api.ts` — add `archive()` method
- `apps/frontend/src/features/positionings/hooks/usePositioningMutations.ts` — add `useArchivePositioning()`
- `apps/frontend/src/features/positionings/components/PositioningRow.tsx` — archive button + prospect links
- `apps/frontend/public/locales/en.json` — add `archive`, `archiveDialog`, extend `toast` block
- `apps/frontend/public/locales/fr.json` — same

**No new files needed.**

### Previous Story Intelligence (4.4)

From Story 4.4 dev notes and completion record:
- `PositioningRow` now uses `isOpen` prop (passed from `PositioningsList`) to lazily load prospects and reset edit state on collapse
- `archiveError` must also be reset in the `useEffect([isOpen])` block (add `setArchiveError(null)`) — already included in the Task 3 implementation above
- `alert-dialog` shadcn component is already installed (used in `ProspectDetail.tsx`)
- `AlertDialogAction` needs `disabled={archive.isPending}` to prevent double-submit
- `Link` from `react-router` (NOT `react-router-dom` — the project uses `react-router` v7)
- `queryKeys.positionings.all` = `['positionings']` — invalidating this key invalidates all positionings queries (list, prospects sub-queries are nested)
- Story 4.4 Senior Review identified issues with missing loading/error states — this story's implementation already incorporates those fixes (they're in the current `PositioningRow.tsx`)

From Story 4.4 completion notes:
- **`common.cancel`** translation key exists in both locales (used in edit form)
- **`useFunnelStages()`** is TanStack Query cached — adding `useArchivePositioning` does NOT introduce a new network call
- **Biome** may reorder imports automatically on `check --write` — verify final import order after running

### Git Intelligence

Recent relevant commits:
- `89a75ad` Merge PR #24 story-4.4 — archive button and prospect links
- `6f998f6` feat(positionings): finalize implementation of create/edit functionality and address review feedback
- `886c037` Merge PR #23 story-4.3 — positionings list view with Accordion

Confirmed patterns for this story:
1. Archive button: `ProspectDetail` AlertDialog pattern — destructive Button trigger + AlertDialogAction onClick
2. Mutation hook: `useArchiveProspect` shape — `useMutation` + `invalidateQueries(queryKeys.X.all)`
3. Archive API call: `prospectsApi.archive(id)` → `DELETE /api/prospects/:id` (identical shape)
4. Error handling: `archiveError` state + inline `<p className="text-xs text-destructive">` (NOT `toast.error`)
5. React Router Link: `<Link to="/prospects">` from `react-router` (v7, not react-router-dom)

### References

- [Source: apps/frontend/src/features/prospects/components/ProspectDetail.tsx] — archive AlertDialog pattern (exact copy)
- [Source: apps/frontend/src/features/prospects/hooks/useProspectMutations.ts] — `useArchiveProspect` shape
- [Source: apps/frontend/src/features/prospects/lib/api.ts] — `archive()` method shape
- [Source: apps/frontend/src/features/positionings/components/PositioningRow.tsx] — current state (post-4.4 with isOpen, lazy prospects, stages error/loading)
- [Source: apps/frontend/src/features/positionings/hooks/usePositioningMutations.ts] — current mutations (add to it)
- [Source: apps/frontend/src/features/positionings/lib/api.ts] — current api lib (add archive)
- [Source: apps/frontend/src/lib/queryKeys.ts] — `queryKeys.positionings.all`
- [Source: apps/frontend/src/routes.tsx] — `/prospects` route confirmed, no `/prospects/:id` route
- [Source: apps/backend/app/controllers/positionings_controller.ts] — `destroy()` method confirms `DELETE /api/positionings/:id` soft-deletes
- [Source: packages/shared/src/types/positioning.ts] — `PositioningType` (no changes needed)
- [Source: _bmad-output/project-context.md] — no `toast.error`, use `<Link>` not `<a>`, `react-router` v7

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Pure frontend story — zero backend changes. `DELETE /api/positionings/:id` already existed from Story 4.2.
- `positioningsApi.archive(id)` added to api lib — identical shape to `prospectsApi.archive()`.
- `useArchivePositioning()` added to `usePositioningMutations.ts` — invalidates `queryKeys.positionings.all` on success, mirrors `useArchiveProspect` exactly.
- `PositioningRow` rewritten to add: `archiveError` state, `handleArchiveConfirm`, `AlertDialog` with destructive styling (exact copy of ProspectDetail pattern), and `<Link to="/prospects">` on linked prospects.
- `archiveError` also cleared in the `useEffect([isOpen])` block (when accordion collapses).
- `alertDialogAction.disabled={archive.isPending}` prevents double-submit during pending state.
- Linked prospects: no `/prospects/:id` route exists → links navigate to `/prospects` (list page).
- i18n: added `archive`, `archiveDialog` keys; extended `toast` block with `archived/archiveFailed` in both en.json and fr.json.
- Biome auto-fixed 1 formatting change in PositioningRow.tsx (whitespace inside Link).
- `pnpm type-check` — 0 errors across shared, backend, frontend workspaces.

### File List

- `apps/frontend/src/features/positionings/lib/api.ts` — MODIFIED: added `archive()` method
- `apps/frontend/src/features/positionings/hooks/usePositioningMutations.ts` — MODIFIED: added `useArchivePositioning()`
- `apps/frontend/src/features/positionings/components/PositioningRow.tsx` — MODIFIED: archive AlertDialog, `archiveError` state, `<Link>` on prospect items, updated imports
- `apps/frontend/public/locales/en.json` — MODIFIED: added `archive`, `archiveDialog`, `toast.archived`, `toast.archiveFailed` keys
- `apps/frontend/public/locales/fr.json` — MODIFIED: same
