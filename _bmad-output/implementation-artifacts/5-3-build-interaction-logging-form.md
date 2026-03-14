# Story 5.3: Build Interaction Logging Form

Status: review

## Story

As a user,
I want to log interactions quickly with minimal fields,
so that capturing data doesn't slow down my prospecting workflow.

## Acceptance Criteria

1. **AC1 (Form fields):** `AddInteractionDialog` renders a form with exactly 4 visible fields: Prospect (Select), Status (3-button ToggleGroup), Positioning (Select, optional), Notes (Textarea, optional). The selected prospect's current funnel stage name is displayed as context below the prospect selector. (FR20, FR22, FR23, FR24)

2. **AC2 (Prospect Select):** The prospect dropdown lists all the user's active prospects. When `initialProspectId` prop is provided (opened from ProspectDetail), the field is pre-filled with that prospect. When prospect changes, the positioning field resets to "no positioning".

3. **AC3 (Status ToggleGroup):** Three mutually exclusive buttons — Positive, Pending, Negative — using shadcn `ToggleGroup` (type="single"). No status selected on open (unless explicitly defaulted). Submitting without a status shows an inline error.

4. **AC4 (Positioning Select filtered by funnel stage):** Positioning dropdown only shows positionings for the selected prospect's funnel stage (using `?funnel_stage_id=` filter). A "No positioning" option allows clearing the selection. Disabled / shows skeleton while positionings load. When no prospect is selected, the positioning field is disabled.

5. **AC5 (Validation):** `createInteractionSchema` (VineJS, frontend) validates `notes` (optional string trim). Prospect and status are validated manually (state-based), showing `FieldError` inline if missing on submit attempt.

6. **AC6 (Create interaction):** On submit → `POST /api/interactions` with `{ prospect_id, status, positioning_id?, notes? }`. On success: `toast.success`, close dialog, reset form, invalidate `queryKeys.interactions.all`. On error: inline `FieldError` (never `toast.error()`). (FR18, FR19)

7. **AC7 (Pre-fill from ProspectDetail):** The existing "Log Interaction" button placeholder in `ProspectDetail` is wired to open `AddInteractionDialog` with `initialProspectId={prospect.id}`. The "coming soon" text is removed. (FR27)

8. **AC8 (queryKeys):** `queryKeys.interactions` added to `src/lib/queryKeys.ts`:
   - `interactions.all: ['interactions']`
   - `interactions.list(filters?)` with `InteractionsFilterType`

9. **AC9 (i18n):** `interactions` namespace added to both `en.json` and `fr.json`. `nav.interactions` key added (for Story 5.5 nav entry).

10. **AC10 (Lint + type-check):** `pnpm biome check --write .` from root — 0 errors. `pnpm type-check` — 0 errors.

## Tasks / Subtasks

- [x] **Task 1: Feature scaffolding** (AC6, AC8)
  - [x] 1.1 Create `apps/frontend/src/features/interactions/lib/api.ts` — `interactionsApi.create(payload: CreateInteractionPayload): Promise<InteractionType>`
  - [x] 1.2 Create `apps/frontend/src/features/interactions/schemas/interaction.ts` — `createInteractionSchema` (VineJS, notes field only)
  - [x] 1.3 Create `apps/frontend/src/features/interactions/hooks/useInteractionMutations.ts` — `useCreateInteraction()`
  - [x] 1.4 Update `apps/frontend/src/lib/queryKeys.ts` — add `interactions` group

- [x] **Task 2: Build AddInteractionDialog** (AC1–AC6)
  - [x] 2.1 Create `apps/frontend/src/features/interactions/components/AddInteractionDialog.tsx`
  - [x] 2.2 Props: `interface AddInteractionDialogProps { initialProspectId?: string; trigger?: React.ReactNode }`
  - [x] 2.3 State: `selectedProspectId`, `selectedStatus`, `selectedPositioningId`, `prospectError`, `statusError`
  - [x] 2.4 react-hook-form for `notes` only (vineResolver + `createInteractionSchema`)
  - [x] 2.5 Prospect Select: `useProspects()` + `useFunnelStages()` to display stage name as context text
  - [x] 2.6 Status ToggleGroup: `type="single"`, 3 options, inline error if empty on submit
  - [x] 2.7 Positioning Select: `usePositionings({ funnel_stage_id })` filtered by selected prospect, disabled if no prospect, "none" value for no positioning
  - [x] 2.8 Notes Textarea: `register('notes')`, optional
  - [x] 2.9 Submit: validate state fields manually, call `create.mutate()`, handle success/error
  - [x] 2.10 `handleOpenChange`: reset all state + form on close

- [x] **Task 3: Wire up ProspectDetail** (AC7)
  - [x] 3.1 Read `apps/frontend/src/features/prospects/components/ProspectDetail.tsx` — located the interactions section placeholder (disabled button + "coming soon" aria-label)
  - [x] 3.2 Replace disabled button with `<AddInteractionDialog initialProspectId={prospect.id} trigger={...} />`
  - [x] 3.3 Keep the existing `t('prospects.interactions.logButton')` translation key for the trigger button label

- [x] **Task 4: Translations** (AC9)
  - [x] 4.1 Add `interactions` namespace to `apps/frontend/public/locales/en.json`
  - [x] 4.2 Add `interactions` namespace to `apps/frontend/public/locales/fr.json`
  - [x] 4.3 Add `nav.interactions` key to both files

- [x] **Task 5: Lint + type-check** (AC10)
  - [x] 5.1 `pnpm biome check --write .` from root — 0 errors (2 auto-fixes style)
  - [x] 5.2 `pnpm type-check` from root — 0 errors (shared, backend, frontend)

## Dev Notes

### CRITICAL: Form State Architecture

**Do NOT use react-hook-form Controller for Select/ToggleGroup fields.** Follow the existing codebase pattern (`AddProspectDialog`, `AddPositioningDialog`): manage all dropdown/toggle state with React state, use react-hook-form only for text inputs (`notes`).

```tsx
// State for non-text fields
const [selectedProspectId, setSelectedProspectId] = useState(initialProspectId ?? '')
const [selectedStatus, setSelectedStatus] = useState<string>('')
const [selectedPositioningId, setSelectedPositioningId] = useState<string>('')
const [prospectError, setProspectError] = useState<string | null>(null)
const [statusError, setStatusError] = useState<string | null>(null)

// react-hook-form for notes only
const { register, handleSubmit, reset, formState: { errors } } = useForm<{ notes: string }>({
  resolver: vineResolver(createInteractionSchema, { messagesProvider: i18nMessagesProvider }),
  defaultValues: { notes: '' },
})
```

---

### Task 1: API, Schema, Mutations, QueryKeys

**`apps/frontend/src/features/interactions/lib/api.ts`** (NEW):

```typescript
import type { CreateInteractionPayload, InteractionType } from '@battlecrm/shared'
import { fetchApi } from '@/lib/api'

export const interactionsApi = {
  create(payload: CreateInteractionPayload): Promise<InteractionType> {
    return fetchApi<InteractionType>('/interactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
```

**`apps/frontend/src/features/interactions/schemas/interaction.ts`** (NEW):

```typescript
import vine from '@vinejs/vine'

// Frontend schema — validates text fields only.
// prospect_id, status, positioning_id managed as React state (not in form).
export const createInteractionSchema = vine.compile(
  vine.object({
    notes: vine.string().trim().optional(),
  }),
)
```

**`apps/frontend/src/features/interactions/hooks/useInteractionMutations.ts`** (NEW):

```typescript
import type { CreateInteractionPayload } from '@battlecrm/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { interactionsApi } from '../lib/api'

export function useCreateInteraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateInteractionPayload) => interactionsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interactions.all })
    },
  })
}
```

**`apps/frontend/src/lib/queryKeys.ts`** (MODIFIED — add interactions):

```typescript
import type { InteractionsFilterType, PositioningsFilterType, ProspectsFilterType } from '@battlecrm/shared'

// Add to existing queryKeys object:
interactions: {
  all: ['interactions'] as const,
  list: (filters?: InteractionsFilterType) =>
    filters && Object.keys(filters).length > 0
      ? ([...queryKeys.interactions.all, 'list', filters] as const)
      : ([...queryKeys.interactions.all, 'list'] as const),
},
```

Biome import order: `@battlecrm/shared` types in alphabetical order — `InteractionsFilterType` goes before `PositioningsFilterType`.

---

### Task 2: AddInteractionDialog

**`apps/frontend/src/features/interactions/components/AddInteractionDialog.tsx`** (NEW):

```tsx
import { vineResolver } from '@hookform/resolvers/vine'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { InteractionStatus } from '@battlecrm/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { usePositionings } from '@/features/positionings/hooks/usePositionings'
import { useProspects } from '@/features/prospects/hooks/useProspects'
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { useCreateInteraction } from '../hooks/useInteractionMutations'
import { createInteractionSchema } from '../schemas/interaction'

interface AddInteractionDialogProps {
  initialProspectId?: string
  trigger?: React.ReactNode
}

interface FormValues {
  notes: string
}

export function AddInteractionDialog({ initialProspectId, trigger }: AddInteractionDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [selectedProspectId, setSelectedProspectId] = useState(initialProspectId ?? '')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedPositioningId, setSelectedPositioningId] = useState<string>('')
  const [prospectError, setProspectError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const create = useCreateInteraction()
  const { data: prospectsData } = useProspects()
  const prospects = prospectsData?.data ?? []
  const selectedProspect = prospects.find((p) => p.id === selectedProspectId)

  const { data: positioningsData, isLoading: positioningsLoading } = usePositionings(
    selectedProspect?.funnelStageId
      ? { funnel_stage_id: selectedProspect.funnelStageId }
      : undefined,
  )
  const positionings = positioningsData?.data ?? []

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: vineResolver(createInteractionSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: { notes: '' },
  })

  function onSubmit(values: FormValues) {
    let valid = true
    if (!selectedProspectId) {
      setProspectError(t('validation.required', { field: t('interactions.fields.prospect') }))
      valid = false
    } else {
      setProspectError(null)
    }
    if (!selectedStatus) {
      setStatusError(t('validation.required', { field: t('interactions.fields.status') }))
      valid = false
    } else {
      setStatusError(null)
    }
    if (!valid) return

    setApiError(null)
    create.mutate(
      {
        prospect_id: selectedProspectId,
        status: selectedStatus as InteractionStatus,
        positioning_id: selectedPositioningId || null,
        notes: values.notes.trim() || null,
      },
      {
        onSuccess: () => {
          resetAll()
          setOpen(false)
          toast.success(t('interactions.toast.created'))
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          setApiError(message ?? t('interactions.toast.createFailed'))
        },
      },
    )
  }

  function resetAll() {
    reset()
    setSelectedProspectId(initialProspectId ?? '')
    setSelectedStatus('')
    setSelectedPositioningId('')
    setProspectError(null)
    setStatusError(null)
    setApiError(null)
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) resetAll()
    setOpen(newOpen)
  }

  function handleProspectChange(value: string) {
    setSelectedProspectId(value)
    setSelectedPositioningId('') // reset when prospect changes
    setProspectError(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm">{t('interactions.addInteraction')}</Button>}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('interactions.createForm.title')}</DialogTitle>
          <DialogDescription>{t('interactions.createForm.description')}</DialogDescription>
        </DialogHeader>

        <form id="create-interaction-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Prospect — required */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="interaction-prospect">
              {t('interactions.fields.prospect')}{' '}
              <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Select value={selectedProspectId} onValueChange={handleProspectChange}>
              <SelectTrigger id="interaction-prospect" className="w-full">
                <SelectValue placeholder={t('interactions.placeholders.selectProspect')} />
              </SelectTrigger>
              <SelectContent>
                {prospects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProspect && (
              <p className="text-xs text-muted-foreground">
                {selectedProspect.funnelStageName}
              </p>
            )}
            <FieldError>{prospectError}</FieldError>
          </div>

          {/* Status — required, ToggleGroup */}
          <div className="flex flex-col gap-1">
            <Label>
              {t('interactions.fields.status')}{' '}
              <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <ToggleGroup
              type="single"
              value={selectedStatus}
              onValueChange={(value) => {
                setSelectedStatus(value)
                setStatusError(null)
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="positive" aria-label={t('interactions.status.positive')}>
                ✅ {t('interactions.status.positive')}
              </ToggleGroupItem>
              <ToggleGroupItem value="pending" aria-label={t('interactions.status.pending')}>
                ⏳ {t('interactions.status.pending')}
              </ToggleGroupItem>
              <ToggleGroupItem value="negative" aria-label={t('interactions.status.negative')}>
                ❌ {t('interactions.status.negative')}
              </ToggleGroupItem>
            </ToggleGroup>
            <FieldError>{statusError}</FieldError>
          </div>

          {/* Positioning — optional, filtered by prospect's funnel stage */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="interaction-positioning">
              {t('interactions.fields.positioning')}
            </Label>
            {positioningsLoading && selectedProspect ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select
                value={selectedPositioningId}
                onValueChange={setSelectedPositioningId}
                disabled={!selectedProspect}
              >
                <SelectTrigger id="interaction-positioning" className="w-full">
                  <SelectValue placeholder={t('interactions.placeholders.selectPositioning')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('interactions.noPositioning')}</SelectItem>
                  {positionings.map((pos) => (
                    <SelectItem key={pos.id} value={pos.id}>
                      {pos.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Notes — optional */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="interaction-notes">{t('interactions.fields.notes')}</Label>
            <Textarea
              id="interaction-notes"
              {...register('notes')}
              placeholder={t('interactions.placeholders.notes')}
              rows={3}
            />
            <FieldError errors={[errors.notes]} />
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
            form="create-interaction-form"
            disabled={create.isPending}
          >
            {create.isPending ? '...' : t('interactions.createForm.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Task 3: Wiring ProspectDetail

**Read `ProspectDetail.tsx` first** to understand the current placeholder structure.

The current placeholder uses `t('prospects.interactions.comingSoon')`. Replace the "coming soon" content with:

```tsx
import { AddInteractionDialog } from '@/features/interactions/components/AddInteractionDialog'

// Inside the interactions section, replace the placeholder with:
<AddInteractionDialog
  initialProspectId={prospect.id}
  trigger={
    <Button size="sm" variant="outline">
      {t('prospects.interactions.logButton')}
    </Button>
  }
/>
```

Keep the `t('prospects.interactions.logButton')` translation key — it already exists in both locale files.

---

### Task 4: Translations

**Add to both `en.json` and `fr.json`:**

```json
// en.json — add at top level alongside existing keys:
"interactions": {
  "title": "Interactions",
  "addInteraction": "Log Interaction",
  "noPositioning": "No positioning",
  "fields": {
    "prospect": "Prospect",
    "status": "Status",
    "positioning": "Positioning",
    "notes": "Notes"
  },
  "status": {
    "positive": "Positive",
    "pending": "Pending",
    "negative": "Negative"
  },
  "placeholders": {
    "selectProspect": "Select a prospect...",
    "selectPositioning": "Select a positioning...",
    "notes": "Notes on this interaction..."
  },
  "createForm": {
    "title": "Log Interaction",
    "description": "Capture an interaction with a prospect.",
    "submit": "Save"
  },
  "toast": {
    "created": "Interaction logged.",
    "createFailed": "Failed to log interaction."
  },
  "loadError": "Failed to load interactions.",
  "empty": "No interactions logged yet."
},

// Also add to "nav" section:
"nav": {
  "interactions": "Interactions"
  // ... (keep all existing keys)
}
```

```json
// fr.json — add at top level:
"interactions": {
  "title": "Interactions",
  "addInteraction": "Journaliser une interaction",
  "noPositioning": "Sans positionnement",
  "fields": {
    "prospect": "Prospect",
    "status": "Statut",
    "positioning": "Positionnement",
    "notes": "Notes"
  },
  "status": {
    "positive": "Positif",
    "pending": "En attente",
    "negative": "Négatif"
  },
  "placeholders": {
    "selectProspect": "Sélectionner un prospect...",
    "selectPositioning": "Sélectionner un positionnement...",
    "notes": "Notes sur cette interaction..."
  },
  "createForm": {
    "title": "Journaliser une interaction",
    "description": "Capturez une interaction avec un prospect.",
    "submit": "Enregistrer"
  },
  "toast": {
    "created": "Interaction enregistrée.",
    "createFailed": "Impossible d'enregistrer l'interaction."
  },
  "loadError": "Impossible de charger les interactions.",
  "empty": "Aucune interaction enregistrée."
},

// Also add to "nav" section:
"nav": {
  "interactions": "Interactions"
}
```

---

### Pièges connus

1. **Biome import order in AddInteractionDialog** — `@battlecrm/shared` (`@` scope) → shadcn `@/components/ui/*` (alphabetical) → `@/features/*` (alphabetical: positionings, prospects) → `@/lib/*` → relative `../hooks/*`, `../schemas/*`. The `ToggleGroup` import comes from `@/components/ui/toggle-group` (already installed per MEMORY.md).

2. **`selectedPositioningId` empty string vs null** — shadcn Select uses string values. The "No positioning" option uses value `""`. In the submit handler: `positioning_id: selectedPositioningId || null` converts `""` to `null` for the API payload.

3. **`usePositionings` with `undefined` filters** — When no prospect is selected, pass `undefined` to `usePositionings()`. The query is still enabled but returns all positionings, which is OK since the select is `disabled` anyway. Alternatively pass `undefined` to skip the query entirely if performance is a concern.

4. **`ProspectType.funnelStageId` and `funnelStageName`** — From the shared type and Lucid camelCase serialization: `prospect.funnelStageId` and `prospect.funnelStageName` are the camelCase response fields (NOT `funnel_stage_id`). This is a known divergence from architecture docs (see project-context.md).

5. **`ToggleGroup` uncontrolled → controlled** — When `onValueChange` returns an empty string (user clicks same item twice to deselect), keep the current selection. The epics require exactly one status selected. Use: `onValueChange={(value) => { if (value) setSelectedStatus(value) }}`.

6. **No E2E tests for this story** — The full interaction flow test (open dialog → submit → see in timeline) requires the timeline page from Story 5.5. The form is still manually testable via ProspectDetail. E2E coverage deferred to Story 5.5.

---

### Project Structure Notes

**New directory: `apps/frontend/src/features/interactions/`**
```
interactions/
├── components/
│   └── AddInteractionDialog.tsx        (new)
├── hooks/
│   └── useInteractionMutations.ts      (new)
├── lib/
│   └── api.ts                          (new)
└── schemas/
    └── interaction.ts                  (new)
```

**No `InteractionsPage.tsx` in this story** — that's Story 5.5. No route added to `routes.tsx`.

**No new shadcn components needed** — `ToggleGroup` is already installed (confirmed in MEMORY.md).

---

### Previous Story Intelligence (5.2)

- `InteractionType`, `CreateInteractionPayload`, `UpdateInteractionPayload`, `InteractionsFilterType` — all in `packages/shared/src/types/interaction.ts`, exported from `index.ts`
- API endpoint: `POST /api/interactions` → returns `InteractionType` (camelCase fields from Lucid)
- `interactionDate` defaults to `now()` server-side if absent from payload
- `positioning_id: null` is valid — interaction without positioning is OK
- API response fields are camelCase: `prospectId`, `prospectName`, `prospectFunnelStageId`, `prospectFunnelStageName`, `positioningId`, `positioningName`, `status`, `notes`, `interactionDate`, `createdAt`, `updatedAt`, `deletedAt`

---

### Git Intelligence Summary

Commits récents :
- `c8013b7` Merge PR #27 — Story 5.2 interactions CRUD API merged
- `50f5393` feat(interactions): enhance interactions API — code review fixes (H1 ownership, M1 withTrashed, M2 forUser, M3 ISO regex, 3 new tests)
- `cc64f27` feat(interactions): implement interactions CRUD API

Pattern confirmés frontend :
- Dialog form: `AddProspectDialog` / `AddPositioningDialog` exact pattern
- React state for Select/ToggleGroup, react-hook-form for text inputs
- VineJS + `vineResolver` + `i18nMessagesProvider` for validation
- `credentials: 'include'` on all fetch (via `fetchApi` helper)
- `toast.success()` on success, inline `FieldError` on error (never `toast.error()`)
- `queryClient.invalidateQueries({ queryKey: queryKeys.X.all })` on mutation success

---

### References

- [Source: apps/frontend/src/features/positionings/components/AddPositioningDialog.tsx] — Dialog form pattern with Select + Skeleton loading
- [Source: apps/frontend/src/features/prospects/components/AddProspectDialog.tsx] — Dialog form pattern with ToggleGroup and state management
- [Source: apps/frontend/src/lib/queryKeys.ts] — QueryKeys pattern (add `interactions` group)
- [Source: apps/frontend/src/features/positionings/lib/api.ts] — fetchApi call pattern
- [Source: apps/frontend/src/features/positionings/hooks/usePositioningMutations.ts] — Mutation hook pattern
- [Source: apps/frontend/src/features/positionings/hooks/usePositionings.ts] — Query hook pattern
- [Source: packages/shared/src/types/interaction.ts] — InteractionType, CreateInteractionPayload
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.3] — ACs and FRs (FR18, FR19, FR20, FR22, FR23, FR24, FR27)
- [Source: _bmad-output/project-context.md] — Error handling rules (inline FieldError, toast.success only)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `AddInteractionDialog` uses React state for all dropdowns/toggles (pattern matching AddProspectDialog/AddPositioningDialog). VineJS schema validates `notes` only; `prospect_id` and `status` validated manually on submit.
- `ProspectType` does not include `funnelStageName` — stage name resolved via `useFunnelStages()` by matching `selectedProspect.funnelStageId`.
- Positioning filtered by selected prospect's `funnelStageId` via `usePositionings({ funnel_stage_id })`. "No positioning" uses special value `"none"` (converted to `null` in submit handler). Empty string avoided in shadcn Select.
- ToggleGroup `onValueChange` guards against empty string (fired when user clicks same item twice) — only updates state if `value` is truthy.
- Biome auto-fixed 2 files (style: import block formatting in queryKeys.ts, label whitespace in AddInteractionDialog.tsx).
- 205/205 backend tests pass — 0 regressions.
- ProspectDetail: removed `disabled` attribute from "Log Interaction" button, replaced with `<AddInteractionDialog trigger={...} />`. `Plus` icon kept in trigger.

### File List

- `apps/frontend/src/features/interactions/lib/api.ts` (created)
- `apps/frontend/src/features/interactions/schemas/interaction.ts` (created)
- `apps/frontend/src/features/interactions/hooks/useInteractionMutations.ts` (created)
- `apps/frontend/src/features/interactions/components/AddInteractionDialog.tsx` (created)
- `apps/frontend/src/lib/queryKeys.ts` (modified — added `interactions` group + `InteractionsFilterType` import)
- `apps/frontend/src/features/prospects/components/ProspectDetail.tsx` (modified — wired "Log Interaction" button to AddInteractionDialog)
- `apps/frontend/public/locales/en.json` (modified — added `interactions` namespace + `nav.interactions`)
- `apps/frontend/public/locales/fr.json` (modified — added `interactions` namespace + `nav.interactions`)
