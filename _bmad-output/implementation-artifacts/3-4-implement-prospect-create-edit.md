# Story 3.4: Implement Prospect Create & Edit

Status: review

<!-- Ultimate Context Engine Analysis: 2026-03-01 -->
<!-- Epic 3: Prospect Management — first write-mutation story (frontend only) -->

## Story

As a user,
I want to create and edit prospect information,
so that I can maintain accurate data about my contacts.

## Acceptance Criteria

1. **AC1 (Create form):** An "Add Prospect" button in the Prospects page header opens a Dialog form with fields: name (required), company, LinkedIn URL, email, phone, title, notes. A funnel stage `<select>` defaults to the first active stage (by position).

2. **AC2 (Create submit):** Submitting valid data sends `POST /api/prospects`. On success: `toast.success("Prospect created")`, dialog closes, new prospect appears in list (query invalidation). On error: inline API error message below the form — **never `toast.error()`**.

3. **AC3 (Inline edit):** The expanded ProspectRow panel shows an edit button (pencil icon). Clicking it replaces the `<dl>` read-only view with a form (name, company, linkedinUrl, email, phone, title, notes — pre-filled with current values). Saving sends `PUT /api/prospects/:id`. On success: `toast.success("Prospect updated")`, panel returns to read-only view. Cancel returns to view without saving. Funnel stage is **not** editable here (Story 3.6).

4. **AC4 (Positioning — deferred):** Positioning variant assignment (FR7) requires Epic 4 positionings data. The positioning field is **deferred entirely** from this story. Do NOT add a positioning dropdown.

5. **AC5 (Validation):** Name is required. Email must be valid format when provided. Errors shown inline per field — **never `toast.error()`**. API errors shown at form level (below all fields).

6. **AC6 (Lint + type-check):** `pnpm biome check --write .` from root passes with 0 errors. `pnpm --filter @battlecrm/frontend type-check` passes with 0 errors.

## Tasks / Subtasks

- [x] **Task 1: Extend API layer** (AC1, AC2, AC3)
  - [x] 1.1 Add `CreateProspectPayload` and `UpdateProspectPayload` types to `apps/frontend/src/features/prospects/lib/api.ts`
  - [x] 1.2 Add `prospectsApi.create(payload)` (POST `/prospects`) and `prospectsApi.update(id, payload)` (PUT `/prospects/:id`) methods

- [x] **Task 2: Create VineJS frontend schema** (AC5)
  - [x] 2.1 Create `apps/frontend/src/features/prospects/schemas/prospect.ts` with `createProspectSchema` and `updateProspectSchema`

- [x] **Task 3: Create mutation hooks** (AC2, AC3)
  - [x] 3.1 Create `apps/frontend/src/features/prospects/hooks/useProspectMutations.ts` exporting `useCreateProspect()` and `useUpdateProspect()`, both invalidating `queryKeys.prospects.all` on success

- [x] **Task 4: Create `AddProspectDialog` component** (AC1, AC2, AC5)
  - [x] 4.1 Create `apps/frontend/src/features/prospects/components/AddProspectDialog.tsx` — Dialog wrapping a create form
  - [x] 4.2 Form fields: name (required Input), company, linkedinUrl, email, phone, title (optional Inputs), notes (optional `<textarea>`), funnel stage native `<select>` (populated from `useFunnelStages()`, defaults to first stage by position)
  - [x] 4.3 Use `react-hook-form` with `vineResolver(createProspectSchema)` + `i18nMessagesProvider`; show per-field errors inline
  - [x] 4.4 On submit: convert empty strings to undefined, call `useCreateProspect`; `toast.success()` + close dialog on success; show API error inline on failure
  - [x] 4.5 Reset form and apiError state when dialog closes (`onOpenChange`)

- [x] **Task 5: Update `ProspectRow` for inline edit** (AC3, AC5)
  - [x] 5.1 Add `isEditing` local state and `useUpdateProspect` hook inside `ProspectRow`
  - [x] 5.2 Add pencil-icon edit button visible in the expanded panel header (next to the "editing" / detail area)
  - [x] 5.3 In edit mode: render a form pre-filled with `prospect` values (name, company, linkedinUrl, email, phone, title, notes); use `react-hook-form` + `vineResolver(updateProspectSchema)`
  - [x] 5.4 Save: convert empty strings to null for nullable fields, call `useUpdateProspect`; `toast.success()` + `setIsEditing(false)` on success; inline error on failure
  - [x] 5.5 Cancel: `setIsEditing(false)` + `reset()` form, no API call

- [x] **Task 6: Update `ProspectsPage`** (AC1)
  - [x] 6.1 Import `AddProspectDialog` and add it to the `<header>` with `justify-between` layout (title left, button right)

- [x] **Task 7: i18n translations** (all ACs)
  - [x] 7.1 Add new keys to `apps/frontend/public/locales/en.json`
  - [x] 7.2 Add new keys to `apps/frontend/public/locales/fr.json`

- [x] **Task 8: Lint and type-check** (AC6)
  - [x] 8.1 `pnpm biome check --write .` from root — 0 errors (1 file auto-formatted: import ordering)
  - [x] 8.2 `pnpm --filter @battlecrm/frontend type-check` — 0 errors

---

## Dev Notes

### CRITICAL: Backend Already Complete — Frontend-Only Story

All CRUD endpoints are **already implemented** and working. Backend files must NOT be touched:
- `apps/backend/app/controllers/prospects_controller.ts` — store, update, destroy all implemented
- `apps/backend/app/validators/prospects.ts` — createProspectValidator & updateProspectValidator
- `apps/backend/app/models/prospect.ts` — Lucid model with `forUser()` scope

Only frontend files change in this story.

---

### CRITICAL: API Returns camelCase (NOT snake_case)

⚠️ Architecture doc says snake_case, but Lucid v3 serializes camelCase by default. Known tracked divergence (Story 3.2):
- Response fields: `funnelStageId`, `linkedinUrl`, `deletedAt`, `positioningId`, `userId`
- Request payload (POST/PUT): use **snake_case** (`funnel_stage_id`, `linkedin_url`) — these are parsed by AdonisJS validator which uses snake_case keys
- Frontend `ProspectType` uses camelCase (for responses); `CreateProspectPayload` uses snake_case (for requests)

---

### Task 1.1–1.2: API Layer Extension

**File: `apps/frontend/src/features/prospects/lib/api.ts`** — ADD after existing `ProspectsFilterType`:

```typescript
// snake_case because these are POST/PUT request body fields (AdonisJS validator convention)
export type CreateProspectPayload = {
  name: string
  funnel_stage_id?: string       // Defaults to first stage on backend if omitted
  company?: string | null
  linkedin_url?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  notes?: string | null
}

export type UpdateProspectPayload = {
  name?: string
  company?: string | null
  linkedin_url?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  notes?: string | null
  // funnel_stage_id omitted — Story 3.6 handles stage changes
  // positioning_id omitted — Epic 4 handles positioning
}
```

**ADD to `prospectsApi` object** (after existing `list` method):

```typescript
create(payload: CreateProspectPayload): Promise<ProspectType> {
  return fetchApi<ProspectType>('/prospects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
},

update(id: string, payload: UpdateProspectPayload): Promise<ProspectType> {
  return fetchApi<ProspectType>(`/prospects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
},
```

**Note:** `fetchApi` at `@/lib/api` already adds `Content-Type: application/json` and `credentials: 'include'` — no extra headers needed. The path does NOT include `/api/` prefix (VITE_API_URL already includes `/api`).

---

### Task 2: VineJS Frontend Schema

**File: `apps/frontend/src/features/prospects/schemas/prospect.ts`** (NEW):

```typescript
import vine from '@vinejs/vine'

export const createProspectSchema = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    funnel_stage_id: vine.string().optional(),
    company: vine.string().trim().optional(),
    linkedin_url: vine.string().trim().optional(),
    email: vine.string().trim().email().optional(),
    phone: vine.string().trim().optional(),
    title: vine.string().trim().optional(),
    notes: vine.string().trim().optional(),
  }),
)

export const updateProspectSchema = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    company: vine.string().trim().optional(),
    linkedin_url: vine.string().trim().optional(),
    email: vine.string().trim().email().optional(),
    phone: vine.string().trim().optional(),
    title: vine.string().trim().optional(),
    notes: vine.string().trim().optional(),
  }),
)
```

**Pattern:** Mirrors `apps/frontend/src/features/settings/schemas/funnelStage.ts` — compiled `vine.compile()`. Email validated with `.email()` when provided; all optional fields use `.optional()`. No `.nullable()` on frontend — empty string → undefined is handled in submit handler.

---

### Task 3: Mutation Hooks

**File: `apps/frontend/src/features/prospects/hooks/useProspectMutations.ts`** (NEW):

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { prospectsApi, type CreateProspectPayload, type UpdateProspectPayload } from '../lib/api'

export function useCreateProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateProspectPayload) => prospectsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.all })
    },
  })
}

export function useUpdateProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateProspectPayload) =>
      prospectsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.all })
    },
  })
}
```

**Pattern:** Mirrors `useFunnelStages.ts` exactly. Invalidates `queryKeys.prospects.all` (= `['prospects']`) to clear all prospect caches (list + any detail queries). `queryKeys.prospects.all` is defined in `@/lib/queryKeys`.

---

### Task 4: AddProspectDialog — Complete Implementation

**File: `apps/frontend/src/features/prospects/components/AddProspectDialog.tsx`** (NEW):

```tsx
import { vineResolver } from '@hookform/resolvers/vine'
import { Plus } from 'lucide-react'
import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { useFunnelStages } from '../../settings/hooks/useFunnelStages'
import { useCreateProspect } from '../hooks/useProspectMutations'
import { createProspectSchema } from '../schemas/prospect'

interface FormValues {
  name: string
  funnel_stage_id: string
  company: string
  linkedin_url: string
  email: string
  phone: string
  title: string
  notes: string
}

export function AddProspectDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const create = useCreateProspect()
  const { data: stagesData } = useFunnelStages()
  const stages = stagesData?.data ?? []

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: vineResolver(createProspectSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: {
      name: '',
      funnel_stage_id: '',
      company: '',
      linkedin_url: '',
      email: '',
      phone: '',
      title: '',
      notes: '',
    },
  })

  function onSubmit(values: FormValues) {
    setApiError(null)
    // Build payload — omit empty strings (backend expects null or absent, not "")
    const payload = {
      name: values.name.trim(),
      ...(values.funnel_stage_id && { funnel_stage_id: values.funnel_stage_id }),
      ...(values.company.trim() && { company: values.company.trim() }),
      ...(values.linkedin_url.trim() && { linkedin_url: values.linkedin_url.trim() }),
      ...(values.email.trim() && { email: values.email.trim() }),
      ...(values.phone.trim() && { phone: values.phone.trim() }),
      ...(values.title.trim() && { title: values.title.trim() }),
      ...(values.notes.trim() && { notes: values.notes.trim() }),
    }
    create.mutate(payload, {
      onSuccess: () => {
        reset()
        setOpen(false)
        toast.success(t('prospects.toast.created'))
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setApiError(message ?? t('prospects.toast.createFailed'))
      },
    })
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      reset()
      setApiError(null)
    }
    setOpen(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          {t('prospects.addProspect')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('prospects.createForm.title')}</DialogTitle>
          <DialogDescription>{t('prospects.createForm.description')}</DialogDescription>
        </DialogHeader>

        <form id="create-prospect-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Name — required */}
          <div className="flex flex-col gap-1">
            <label htmlFor="prospect-name" className="text-sm font-medium">
              {t('prospects.fields.name')} <span aria-hidden="true" className="text-destructive">*</span>
            </label>
            <Input
              id="prospect-name"
              {...register('name')}
              placeholder={t('prospects.placeholders.name')}
              autoFocus
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Funnel Stage — select (native, no shadcn Select installed) */}
          {stages.length > 0 && (
            <div className="flex flex-col gap-1">
              <label htmlFor="prospect-stage" className="text-sm font-medium">
                {t('prospects.fields.funnelStage')}
              </label>
              <select
                id="prospect-stage"
                {...register('funnel_stage_id')}
                defaultValue={stages[0]?.id ?? ''}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Optional text fields */}
          {(
            [
              ['company', 'company'],
              ['linkedin_url', 'linkedinUrl'],
              ['email', 'email'],
              ['phone', 'phone'],
              ['title', 'title'],
            ] as const
          ).map(([field, labelKey]) => (
            <div key={field} className="flex flex-col gap-1">
              <label htmlFor={`prospect-${field}`} className="text-sm font-medium">
                {t(`prospects.fields.${labelKey}`)}
              </label>
              <Input
                id={`prospect-${field}`}
                {...register(field)}
                placeholder={t(`prospects.placeholders.${labelKey}`)}
                type={field === 'email' ? 'email' : 'text'}
              />
              {errors[field] && (
                <p className="text-xs text-destructive">{errors[field]?.message}</p>
              )}
            </div>
          ))}

          {/* Notes — textarea */}
          <div className="flex flex-col gap-1">
            <label htmlFor="prospect-notes" className="text-sm font-medium">
              {t('prospects.fields.notes')}
            </label>
            <textarea
              id="prospect-notes"
              {...register('notes')}
              placeholder={t('prospects.placeholders.notes')}
              rows={3}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>

          {/* API-level error */}
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="create-prospect-form"
            disabled={create.isPending}
          >
            {create.isPending ? '...' : t('prospects.createForm.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Key decisions:**
- `Dialog` controlled with `open`/`onOpenChange` so we can reset form on close
- `form` with `id="create-prospect-form"` linked to submit button via `form=` attribute (button is in DialogFooter outside the form DOM)
- Native `<select>` for funnel stage (no shadcn Select installed; className copied from Input for visual consistency)
- Optional fields mapped with array to avoid repetition
- `textarea` for notes with similar className to Input
- `useFunnelStages()` reuses cached data from TanStack Query (already fetched by ProspectsList) — zero extra network calls
- Cross-feature import: `features/settings/hooks/useFunnelStages` — same pattern as Story 3.3

**⚠️ Check `common.cancel` key:** Before writing, verify this key exists in `en.json`. If not, use `t('prospects.editForm.cancel')` or create `common.cancel`.

---

### Task 5: ProspectRow — Inline Edit Mode

**File: `apps/frontend/src/features/prospects/components/ProspectRow.tsx`** — MODIFY:

```tsx
import { vineResolver } from '@hookform/resolvers/vine'
import { ChevronDown, ChevronRight, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { useUpdateProspect } from '../hooks/useProspectMutations'
import { updateProspectSchema } from '../schemas/prospect'
import type { ProspectType } from '../lib/api'

interface ProspectRowProps {
  prospect: ProspectType
  stageName: string | undefined
  isExpanded: boolean
  onToggle: () => void
}

interface EditFormValues {
  name: string
  company: string
  linkedin_url: string
  email: string
  phone: string
  title: string
  notes: string
}

export function ProspectRow({ prospect, stageName, isExpanded, onToggle }: ProspectRowProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const update = useUpdateProspect()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: vineResolver(updateProspectSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: {
      name: prospect.name,
      company: prospect.company ?? '',
      linkedin_url: prospect.linkedinUrl ?? '',
      email: prospect.email ?? '',
      phone: prospect.phone ?? '',
      title: prospect.title ?? '',
      notes: prospect.notes ?? '',
    },
  })

  const hasDetails = !!(
    prospect.company ||
    prospect.linkedinUrl ||
    prospect.email ||
    prospect.phone ||
    prospect.title ||
    prospect.notes
  )

  function handleEditStart() {
    // Re-initialize with current prospect values (in case data was refreshed)
    reset({
      name: prospect.name,
      company: prospect.company ?? '',
      linkedin_url: prospect.linkedinUrl ?? '',
      email: prospect.email ?? '',
      phone: prospect.phone ?? '',
      title: prospect.title ?? '',
      notes: prospect.notes ?? '',
    })
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
    // Convert empty strings to null for nullable fields
    const payload = {
      name: values.name.trim(),
      company: values.company.trim() || null,
      linkedin_url: values.linkedin_url.trim() || null,
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      title: values.title.trim() || null,
      notes: values.notes.trim() || null,
    }
    update.mutate(
      { id: prospect.id, ...payload },
      {
        onSuccess: () => {
          setIsEditing(false)
          toast.success(t('prospects.toast.updated'))
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          setApiError(message ?? t('prospects.toast.updateFailed'))
        },
      },
    )
  }

  return (
    <article className="border-b last:border-b-0">
      {/* Collapsed row — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-accent"
        aria-expanded={isExpanded}
        aria-controls={`prospect-panel-${prospect.id}`}
      >
        {isExpanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{prospect.name}</span>
        <span className="w-40 shrink-0 truncate text-sm text-muted-foreground">
          {prospect.company ?? '—'}
        </span>
        <span className="w-40 shrink-0 truncate text-sm">{stageName ?? '—'}</span>
        <span className="w-48 shrink-0 truncate text-sm text-muted-foreground">
          {prospect.email ?? '—'}
        </span>
      </button>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div
          id={`prospect-panel-${prospect.id}`}
          className="space-y-2 border-t bg-muted/30 px-4 py-4"
        >
          {isEditing ? (
            /* ── EDIT MODE ── */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              {/* Name — required */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  {t('prospects.fields.name')} <span aria-hidden="true" className="text-destructive">*</span>
                </label>
                <Input {...register('name')} autoFocus />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              {/* Optional fields grid */}
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ['company', 'company'],
                    ['linkedin_url', 'linkedinUrl'],
                    ['email', 'email'],
                    ['phone', 'phone'],
                    ['title', 'title'],
                  ] as const
                ).map(([field, labelKey]) => (
                  <div key={field} className="flex flex-col gap-1">
                    <label className="text-sm font-medium">
                      {t(`prospects.fields.${labelKey}`)}
                    </label>
                    <Input
                      {...register(field)}
                      type={field === 'email' ? 'email' : 'text'}
                      placeholder={t(`prospects.placeholders.${labelKey}`)}
                    />
                    {errors[field] && (
                      <p className="text-xs text-destructive">{errors[field]?.message}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t('prospects.fields.notes')}</label>
                <textarea
                  {...register('notes')}
                  rows={3}
                  placeholder={t('prospects.placeholders.notes')}
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
              </div>

              {/* API error */}
              {apiError && <p className="text-sm text-destructive">{apiError}</p>}

              {/* Actions */}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={update.isPending}>
                  {update.isPending ? '...' : t('prospects.editForm.save')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleCancel}
                  aria-label={t('prospects.aria.cancelEdit')}
                >
                  <X className="size-4" />
                  {t('prospects.editForm.cancel')}
                </Button>
              </div>
            </form>
          ) : (
            /* ── READ-ONLY MODE (original content + edit button) ── */
            <>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {hasDetails && (
                    <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      {prospect.company && (
                        <>
                          <dt className="text-muted-foreground">{t('prospects.fields.company')}</dt>
                          <dd>{prospect.company}</dd>
                        </>
                      )}
                      {prospect.linkedinUrl && (
                        <>
                          <dt className="text-muted-foreground">{t('prospects.fields.linkedinUrl')}</dt>
                          <dd>
                            <a
                              href={
                                prospect.linkedinUrl.startsWith('https://') ||
                                prospect.linkedinUrl.startsWith('http://')
                                  ? prospect.linkedinUrl
                                  : '#'
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate text-primary underline-offset-4 hover:underline"
                            >
                              {prospect.linkedinUrl}
                            </a>
                          </dd>
                        </>
                      )}
                      {prospect.email && (
                        <>
                          <dt className="text-muted-foreground">{t('prospects.fields.email')}</dt>
                          <dd>{prospect.email}</dd>
                        </>
                      )}
                      {prospect.phone && (
                        <>
                          <dt className="text-muted-foreground">{t('prospects.fields.phone')}</dt>
                          <dd>{prospect.phone}</dd>
                        </>
                      )}
                      {prospect.title && (
                        <>
                          <dt className="text-muted-foreground">{t('prospects.fields.title')}</dt>
                          <dd>{prospect.title}</dd>
                        </>
                      )}
                      {prospect.notes && (
                        <>
                          <dt className="text-muted-foreground">{t('prospects.fields.notes')}</dt>
                          <dd className="whitespace-pre-wrap">{prospect.notes}</dd>
                        </>
                      )}
                    </dl>
                  )}
                  {/* Interactions — Epic 5 */}
                  <p className="mt-4 text-xs italic text-muted-foreground">
                    {t('prospects.interactionsComingSoon')}
                  </p>
                </div>

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
              </div>
            </>
          )}
        </div>
      )}
    </article>
  )
}
```

**Key decisions:**
- `isEditing` local state — no props required from parent (self-contained like `FunnelStageItem`)
- `reset()` called in `handleEditStart` to re-initialize form with latest `prospect` values (handles case where the prospect was updated externally via query invalidation)
- Edit button as `Button size="icon-sm" variant="ghost"` with `Pencil` icon — matches FunnelStageItem pattern
- In save: convert `""` to `null` (not `undefined`) — backend `updateProspectValidator` accepts null for nullable optional fields
- In `onSuccess`: `setIsEditing(false)` first, then `toast.success()` — the component re-renders with updated data from the invalidated query
- `aria-label` on edit button includes prospect name for screen reader context

**⚠️ IMPORTANT:** The `ProspectRow` now uses `useUpdateProspect` which calls `queryClient.invalidateQueries`. After successful update, TanStack Query will refetch the list and the component will receive updated `prospect` props. The component does NOT need to do anything else — React re-renders automatically.

---

### Task 6: ProspectsPage Update

**File: `apps/frontend/src/features/prospects/ProspectsPage.tsx`** — MODIFY:

```tsx
import { useTranslation } from 'react-i18next'
import { AddProspectDialog } from './components/AddProspectDialog'
import { ProspectsList } from './components/ProspectsList'

export function ProspectsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('prospects.title')}</h1>
          <p className="text-muted-foreground">{t('prospects.description')}</p>
        </div>
        <AddProspectDialog />
      </header>

      <section>
        <ProspectsList />
      </section>
    </div>
  )
}
```

---

### Task 7: i18n Translations

**File: `apps/frontend/public/locales/en.json`** — ADD inside the existing `"prospects"` object:

```json
"addProspect": "Add Prospect",
"createForm": {
  "title": "Add Prospect",
  "description": "Create a new prospect in your pipeline.",
  "submit": "Create Prospect"
},
"editForm": {
  "save": "Save",
  "cancel": "Cancel"
},
"toast": {
  "created": "Prospect created",
  "updated": "Prospect updated",
  "createFailed": "Failed to create prospect.",
  "updateFailed": "Failed to update prospect."
},
"aria": {
  "editProspect": "Edit {{name}}",
  "cancelEdit": "Cancel editing"
},
"placeholders": {
  "name": "Full name",
  "company": "Company name",
  "linkedinUrl": "https://linkedin.com/in/...",
  "email": "email@example.com",
  "phone": "+1 234 567 890",
  "title": "Job title",
  "notes": "Additional notes...",
  "linkedinUrl": "https://linkedin.com/in/..."
},
"fields": {
  "name": "Name",
  "funnelStage": "Funnel Stage"
}
```

**Note:** `fields.name` and `fields.funnelStage` are NEW. The existing `fields.company`, `fields.linkedinUrl`, `fields.email`, `fields.phone`, `fields.title`, `fields.notes` already exist from Story 3.3 — do NOT remove them.

**File: `apps/frontend/public/locales/fr.json`** — ADD inside `"prospects"`:

```json
"addProspect": "Ajouter un prospect",
"createForm": {
  "title": "Ajouter un prospect",
  "description": "Créez un nouveau prospect dans votre pipeline.",
  "submit": "Créer le prospect"
},
"editForm": {
  "save": "Enregistrer",
  "cancel": "Annuler"
},
"toast": {
  "created": "Prospect créé",
  "updated": "Prospect mis à jour",
  "createFailed": "Impossible de créer le prospect.",
  "updateFailed": "Impossible de mettre à jour le prospect."
},
"aria": {
  "editProspect": "Modifier {{name}}",
  "cancelEdit": "Annuler la modification"
},
"placeholders": {
  "name": "Nom complet",
  "company": "Nom de l'entreprise",
  "linkedinUrl": "https://linkedin.com/in/...",
  "email": "email@exemple.com",
  "phone": "+33 1 23 45 67 89",
  "title": "Poste",
  "notes": "Notes supplémentaires..."
},
"fields": {
  "name": "Nom",
  "funnelStage": "Étape du funnel"
}
```

**⚠️ Check `common.cancel`:** Before writing, check if `"common": { "cancel": "Cancel" }` exists in `en.json`. If not, add it. If it does exist, use `t('common.cancel')` in the Dialog footer cancel button instead of the local `editForm.cancel` key.

---

### Architecture Compliance

| Requirement | Implementation |
|-------------|----------------|
| FR1: Create prospects with basic info | POST /api/prospects via `AddProspectDialog` |
| FR3: Update prospect information | PUT /api/prospects/:id via inline edit in `ProspectRow` |
| Feature-based organization | All new files in `features/prospects/` |
| react-hook-form + VineJS | `vineResolver(createProspectSchema)` + `i18nMessagesProvider` |
| Error handling: inline only | `errors.field.message` + apiError — **NO `toast.error()`** |
| Success: toast only | `toast.success(t('prospects.toast.created'))` |
| TanStack Query invalidation | `queryKeys.prospects.all` clears all prospect caches |
| TypeScript strict | All types fully specified, no `any` |
| `credentials: 'include'` | Handled by `fetchApi` automatically |

**Deferred from this story:**
- Archive/delete: Story 3.5
- Funnel stage change inline: Story 3.6
- Positioning variant assignment (FR7): Epic 4 (positionings don't exist yet)

**Anti-patterns to avoid per project-context.md:**
- ❌ `toast.error()` for API failures — use inline `text-destructive` paragraph
- ❌ Hard delete — N/A (not in scope)
- ❌ `any` types — use `FormValues`, `CreateProspectPayload`, `UpdateProspectPayload`
- ❌ Supabase SDK or JWT — N/A
- ❌ Generic `<div>` for semantic contexts — `<article>` preserved in ProspectRow
- ❌ Zod — use VineJS (`@vinejs/vine`)

---

### Previous Story Intelligence (Story 3.3 — done)

**Critical learnings from Story 3.3:**

| Fact | Detail |
|------|--------|
| Import alias | **`@/`** — confirmed used throughout (e.g., `import { fetchApi } from '@/lib/api'`) |
| fetchApi prefix | `/prospects` (no `/api/`) — VITE_API_URL already includes `/api` |
| fetchApi auto-headers | Adds `Content-Type: application/json` + `credentials: 'include'` automatically |
| camelCase API response | `linkedinUrl`, `funnelStageId`, `positioningId`, `deletedAt` — all camelCase from Lucid v3 |
| snake_case request | POST/PUT body uses `linkedin_url`, `funnel_stage_id` — AdonisJS convention |
| `useFunnelStages()` data | Returns `{ data: FunnelStageType[] }` sorted by `position ASC` |
| Biome import sorting | `@` scoped packages before `#` aliases, before relative imports |
| LinkedIn URL security | Check for `http://` or `https://` before rendering as `href` (code review fix from 3.3) |
| `aria-controls` | Already on collapse toggle button: `prospect-panel-{id}` — preserve this |

**Code review fixes from Story 3.3 (PRESERVE ALL):**
1. LinkedIn `href` security check (`startsWith('https://')`)
2. `hasDetails` guard on `<dl>` (don't render empty `<dl>` when all fields null)
3. `aria-controls={prospect-panel-${prospect.id}}` on toggle button
4. `aria-pressed` on filter buttons in ProspectsList (no change needed here)

---

### Git Intelligence

**Recent commits:**
```
049ad4b Merge pull request #14 from RomainSire/Story-3.3
a0f2ca2 feat(prospects): finalize build prospects list view
680ba73 feat(prospects): implement prospects view list
```

**Expected branch:** `story-3.4`
**Expected commit scope:** `feat(prospects):`

---

### Project Structure Notes

**Files to CREATE:**

```
apps/frontend/
└── src/
    └── features/
        └── prospects/
            ├── schemas/
            │   └── prospect.ts          # NEW — VineJS schemas (create + update)
            ├── hooks/
            │   └── useProspectMutations.ts  # NEW — useCreateProspect, useUpdateProspect
            └── components/
                └── AddProspectDialog.tsx    # NEW — Dialog + create form
```

**Files to MODIFY:**

```
apps/frontend/
└── src/
    └── features/
        └── prospects/
            ├── lib/
            │   └── api.ts               # MODIFY — add CreateProspectPayload, UpdateProspectPayload, create(), update()
            ├── components/
            │   └── ProspectRow.tsx      # MODIFY — add isEditing state + edit form
            └── ProspectsPage.tsx        # MODIFY — add AddProspectDialog to header
└── public/
    └── locales/
        ├── en.json                      # MODIFY — add prospects.* keys
        └── fr.json                      # MODIFY — add prospects.* keys
```

**Files NOT to touch:**
- `apps/backend/` — backend is complete
- `apps/frontend/src/features/settings/` — only import from it (never modify)
- `apps/frontend/src/features/prospects/components/ProspectsList.tsx` — no changes needed
- `apps/frontend/src/features/prospects/hooks/useProspects.ts` — no changes needed
- `apps/frontend/src/lib/queryKeys.ts` — no changes needed (queryKeys.prospects.all already usable)

---

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4 — AC1–AC4]
- [Source: _bmad-output/planning-artifacts/epics.md#FR1 — Create prospects]
- [Source: _bmad-output/planning-artifacts/epics.md#FR3 — Update prospect info]
- [Source: _bmad-output/planning-artifacts/epics.md#FR7 — Positioning variant (deferred Epic 4)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Formulaires compacts]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Zero popup sauf confirmation destructive]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture — react-hook-form + VineJS]
- [Source: _bmad-output/planning-artifacts/architecture.md#Error Format — Adonis default]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules — inline errors, toast.success only]
- [Source: _bmad-output/project-context.md#Anti-Patterns — no toast.error, no hard delete]
- [Source: apps/backend/app/validators/prospects.ts — backend VineJS schema reference]
- [Source: apps/backend/app/controllers/prospects_controller.ts — store/update/destroy implemented]
- [Source: apps/frontend/src/features/prospects/components/ProspectRow.tsx — current state + code review fixes]
- [Source: apps/frontend/src/features/prospects/lib/api.ts — existing types + prospectsApi.list pattern]
- [Source: apps/frontend/src/features/settings/components/AddStageForm.tsx — form pattern reference]
- [Source: apps/frontend/src/features/settings/components/FunnelStageItem.tsx — inline edit pattern reference]
- [Source: apps/frontend/src/features/settings/hooks/useFunnelStages.ts — mutation hook pattern]
- [Source: apps/frontend/src/features/settings/schemas/funnelStage.ts — VineJS schema pattern]
- [Source: apps/frontend/src/components/ui/dialog.tsx — Dialog component API]
- [Source: apps/frontend/src/lib/api.ts — fetchApi, ApiError, Content-Type auto-header]
- [Source: apps/frontend/src/lib/queryKeys.ts — queryKeys.prospects.all]
- [Source: _bmad-output/implementation-artifacts/3-3-build-prospects-list-view.md — previous story intelligence]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- **Biome a11y fix:** Labels in ProspectRow edit form required `htmlFor` + matching `id` on inputs/textarea (`noLabelWithoutControl` rule). Fixed by adding `id={`edit-${field}-${prospect.id}`}` to each input and matching `htmlFor` to each label. IDs are unique per row via `prospect.id`.
- **Biome import reorder:** Auto-reordered imports in `AddProspectDialog.tsx`, `useProspectMutations.ts`, `ProspectRow.tsx` (type imports, `@/features` before `@/lib`).
- **Backend tests:** 93/93 passing (up from 89 — Story 3.2 added more tests). No regressions.

### Completion Notes List

- **AC1 (Create form):** `AddProspectDialog` component with Dialog + react-hook-form + VineJS. Fields: name (required), funnel stage select (defaults to first stage via `useEffect`), company, LinkedIn URL, email, phone, title, notes. "Add Prospect" button in `ProspectsPage` header.
- **AC2 (Create submit):** `useCreateProspect` mutation → `POST /api/prospects`. On success: `toast.success()` + dialog closes + query invalidation. On error: inline `text-destructive` paragraph (never `toast.error()`).
- **AC3 (Inline edit):** `ProspectRow` now has `isEditing` local state. Edit button (Pencil icon) in read-only panel → switches to edit form. `useUpdateProspect` mutation → `PUT /api/prospects/:id`. On success: `toast.success()` + `setIsEditing(false)`. On cancel: `reset()` + `setIsEditing(false)`. Funnel stage NOT editable (Story 3.6 scope).
- **AC4 (Positioning — deferred):** No positioning dropdown added. Epic 4 will add this when positionings exist.
- **AC5 (Validation):** VineJS schemas in `schemas/prospect.ts`. Name required + minLength(1). Email validated with `.email()` when provided. Per-field errors inline. API errors shown at form level. `i18nMessagesProvider` for translated error messages.
- **AC6 (Lint + type-check):** `pnpm biome check --write .` — 0 errors. `pnpm --filter @battlecrm/frontend type-check` — 0 errors.
- **Empty string → null/undefined:** In `AddProspectDialog.onSubmit`, empty strings omitted from payload (spread conditionally). In `ProspectRow.onSubmit`, empty strings converted to `null` for nullable backend fields.
- **Stage selector:** Controlled `useState` for stage ID (separate from react-hook-form to avoid `defaultValues` timing issue). `useEffect` initializes to `stages[0].id` on first load.
- **`common.cancel`/`common.save`:** Used from existing i18n keys (already defined in Story 2.x).

### File List

**Created:**
- `apps/frontend/src/features/prospects/schemas/prospect.ts`
- `apps/frontend/src/features/prospects/hooks/useProspectMutations.ts`
- `apps/frontend/src/features/prospects/components/AddProspectDialog.tsx`

**Modified:**
- `apps/frontend/src/features/prospects/lib/api.ts` (added `CreateProspectPayload`, `UpdateProspectPayload`, `prospectsApi.create()`, `prospectsApi.update()`)
- `apps/frontend/src/features/prospects/components/ProspectRow.tsx` (added inline edit mode, edit button, react-hook-form, `useUpdateProspect`)
- `apps/frontend/src/features/prospects/ProspectsPage.tsx` (added `AddProspectDialog` in header)
- `apps/frontend/public/locales/en.json` (added `prospects.addProspect`, `createForm`, `toast`, `aria`, `placeholders`, `fields.name`, `fields.funnelStage`)
- `apps/frontend/public/locales/fr.json` (same keys in French)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (3-4 status: ready-for-dev → in-progress → review)
