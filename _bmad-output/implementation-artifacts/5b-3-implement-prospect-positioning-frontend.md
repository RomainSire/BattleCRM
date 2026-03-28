# Story 5B.3: Implement Positioning Frontend (Prospect Detail + Kanban)

Status: done

## Story

As a user,
I want to assign positionings to prospects, mark them as success/failure, and see visual indicators on the Kanban board,
So that I can track which approach I'm using for each prospect and assess its effectiveness at a glance.

## Acceptance Criteria

1. **AC1 (Indicator — no positioning assigned):** When a prospect's current funnel stage has active (non-archived) positionings available but none is assigned to the prospect, a distinct visual indicator (red alert icon) appears on the Kanban card AND in the ProspectDetail. This indicator is different from the outcome icons.

2. **AC2 (Indicator — active positioning, outcome=null):** When a prospect has an active positioning (assigned to its current stage) with `outcome = null`, the positioning name is displayed with a neutral/yellow "in progress" icon. Two buttons are visible: [✓ Succès] and [✗ Échec]. Clicking either calls `PATCH /api/prospects/:id/positionings/current/outcome` with the appropriate outcome and updates the icon accordingly.

3. **AC3 (Indicator — outcome decided):** When `outcome` is `'success'` or `'failed'`, a colored icon appears (green ✓ / red ✗) with a tooltip showing the outcome label. The positioning name is still displayed. The [✓ Succès] / [✗ Échec] buttons remain visible to allow changing the outcome, and a [Change positioning] button is available to reassign a different positioning (resets to State A select).

4. **AC4 (Stage change popup):** When a prospect is moved to a different stage (drag-and-drop OR dropdown selector) AND the prospect has an active positioning with `outcome = null`, a non-blocking anchored popup appears asking: "Avant de passer à [Stage] : Comment s'est passé [Positioning name] ? [✓ Succès] [✗ Échec] [→ Passer sans décider]". The stage change proceeds regardless. If the user clicks success or fail, `PATCH /api/prospects/:id/positionings/current/outcome` is called before the popup closes.

5. **AC5 (Archive flow — auto set outcome='failed'):** When a prospect is archived (AlertDialog confirmed), if the prospect has an active positioning with `outcome = null`, `PATCH /api/prospects/:id/positionings/current/outcome` with `{ outcome: 'failed' }` is called first, then the archive (DELETE) is called. If setOutcome fails, archiving is still attempted (best-effort). The archive toast fires on successful archival.

6. **AC6 (Assign positioning):** In ProspectDetail, non-archived prospects with no active positioning show a select dropdown listing non-archived positionings for the current funnel stage. Selecting one calls `POST /api/prospects/:id/positionings` with `{ positioning_id }`. On success the positioning section updates to show AC2 state.

7. **AC7 (ProspectType extended):** `ProspectType` includes `activePositioning: { positioningId: string; positioningName: string; outcome: 'success' | 'failed' | null } | null`. All backend endpoints returning a prospect include this field. Null = no active positioning. The backend derives it by querying `prospect_positionings WHERE prospect_id = prospect.id AND funnel_stage_id = prospect.funnel_stage_id`.

8. **AC8 (Verification):** `pnpm biome check --write .` — 0 errors. `pnpm --filter @battlecrm/shared build` — success. `pnpm --filter @battlecrm/backend type-check` — 0 errors. `pnpm --filter @battlecrm/frontend type-check` — 0 errors.

9. **AC9 (Positioning history):** In ProspectDetail, `PositioningSection` displays past positionings (positionings assigned to previous funnel stages, `isActive = false`). Each past positioning shows its outcome icon + name + stage name. For archived prospects, only the history is shown (no interactive UI). Uses `GET /api/prospects/:id/positionings` (already implemented in Story 5B.2).

## Tasks / Subtasks

---

### Task 1: Shared type extension (AC7) — start here

- [x] **1.1** In `packages/shared/src/types/prospect.ts`, add `activePositioning` to `ProspectType`:
  ```typescript
  export type ProspectType = {
    id: string
    userId: string
    name: string
    company: string | null
    linkedinUrl: string | null
    email: string | null
    phone: string | null
    title: string | null
    notes: string | null
    funnelStageId: string
    createdAt: string
    updatedAt: string
    deletedAt: string | null
    activePositioning: {
      positioningId: string
      positioningName: string
      outcome: 'success' | 'failed' | null
    } | null
  }
  ```

- [x] **1.2** Rebuild shared: `pnpm --filter @battlecrm/shared build`

---

### Task 2: Backend — extend serializer and controllers (AC7)

- [x] **2.1** In `apps/backend/app/serializers/prospect.ts`, update `serializeProspect()` signature to accept an optional second parameter:

  ```typescript
  import type { ProspectType, StageTransitionType } from '@battlecrm/shared'
  import type ProspectPositioning from '#models/prospect_positioning'
  import type Prospect from '#models/prospect'
  import type ProspectStageTransition from '#models/prospect_stage_transition'

  type ActivePositioningData = {
    positioningId: string
    positioningName: string
    outcome: 'success' | 'failed' | null
  } | null

  export function serializeProspect(
    prospect: Prospect,
    activePositioning: ActivePositioningData = null,
  ): ProspectType {
    return {
      id: prospect.id,
      userId: prospect.userId,
      name: prospect.name,
      company: prospect.company,
      linkedinUrl: prospect.linkedinUrl,
      email: prospect.email,
      phone: prospect.phone,
      title: prospect.title,
      notes: prospect.notes,
      funnelStageId: prospect.funnelStageId,
      createdAt: prospect.createdAt.toISO()!,
      updatedAt: prospect.updatedAt?.toISO() ?? prospect.createdAt.toISO()!,
      deletedAt: prospect.deletedAt?.toISO() ?? null,
      activePositioning,
    }
  }
  ```

  The `activePositioningData` helper function below is used in controllers to query the active pp:

  ```typescript
  export async function loadActivePositioning(
    userId: string,
    prospect: Prospect,
  ): Promise<ActivePositioningData> {
    // Import inside function or at top of file — avoid circular imports
    const ProspectPositioning = (await import('#models/prospect_positioning')).default
    const pp = await ProspectPositioning.query()
      .where('user_id', userId)
      .where('prospect_id', prospect.id)
      .where('funnel_stage_id', prospect.funnelStageId)
      .preload('positioning', (q) => q.withTrashed()) // show even if positioning archived
      .first()
    if (!pp) return null
    return {
      positioningId: pp.positioningId,
      positioningName: pp.positioning.name,
      outcome: pp.outcome,
    }
  }
  ```

  > **Note on dynamic import**: To avoid circular imports between serializer and models, use a top-level import in the serializer file (not dynamic). Import `ProspectPositioning` at the top of `prospect.ts` — there is no circular dependency between serializer and models.

- [x] **2.2** In `apps/backend/app/controllers/prospects_controller.ts`, add import at top:
  ```typescript
  import ProspectPositioning from '#models/prospect_positioning'
  import { loadActivePositioning, serializeProspect, serializeTransition } from '#serializers/prospect'
  ```

- [x] **2.3** Update `index()` to batch-load active positionings (ONE extra query for all prospects):
  ```typescript
  async index({ request, response, auth }: HttpContext) {
    // ... existing query logic unchanged ...
    const prospects = await query

    // Batch load active positionings — 1 extra query total (not N+1)
    const activeByProspectId = new Map<string, { positioningId: string; positioningName: string; outcome: 'success' | 'failed' | null }>()
    if (prospects.length > 0) {
      const prospectIds = prospects.map((p) => p.id)
      const pps = await ProspectPositioning.query()
        .where('user_id', userId)
        .whereIn('prospect_id', prospectIds)
        .preload('positioning', (q) => q.withTrashed())
      // Match pp to its prospect using funnel_stage_id (active = same stage as prospect)
      const prospectById = new Map(prospects.map((p) => [p.id, p]))
      for (const pp of pps) {
        const p = prospectById.get(pp.prospectId)
        if (p && pp.funnelStageId === p.funnelStageId) {
          activeByProspectId.set(pp.prospectId, {
            positioningId: pp.positioningId,
            positioningName: pp.positioning.name,
            outcome: pp.outcome,
          })
        }
      }
    }

    return response.ok({
      data: prospects.map((p) => serializeProspect(p, activeByProspectId.get(p.id) ?? null)),
      meta: { total: prospects.length },
    })
  }
  ```

- [x] **2.4** Update `show()` to include active positioning:
  ```typescript
  async show({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id
    const prospect = await Prospect.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()
    const activePp = await loadActivePositioning(userId, prospect)
    return response.ok(serializeProspect(prospect, activePp))
  }
  ```

- [x] **2.5** Update `update()` to include active positioning in response (stage may have changed — active pp changes):
  ```typescript
  // At the end of update(), replace the return line:
  const activePp = await loadActivePositioning(userId, prospect)
  return response.ok(serializeProspect(prospect, activePp))
  ```

- [x] **2.6** Update `store()` response — new prospect has no active positioning yet:
  ```typescript
  // store() response — activePositioning is always null for brand new prospects
  return response.created(serializeProspect(prospect, null))
  ```
  No change needed since `null` is the default, but the serializer will now include `activePositioning: null` explicitly.

- [x] **2.7** Update `restore()` to include active positioning:
  ```typescript
  async restore({ params, response, auth }: HttpContext) {
    // ... existing restore logic ...
    await prospect.restore()
    const activePp = await loadActivePositioning(userId, prospect)
    return response.ok(serializeProspect(prospect, activePp))
  }
  ```

- [x] **2.8** Type-check backend: `pnpm --filter @battlecrm/backend type-check` — 0 errors.

---

### Task 3: Frontend — API layer + query keys (no new files for API, extend existing)

- [x] **3.1** In `apps/frontend/src/lib/queryKeys.ts`, add `positionings` sub-key under `prospects`:
  ```typescript
  prospects: {
    all: ['prospects'] as const,
    list: (filters?: ProspectsFilterType) => /* unchanged */,
    detail: (id: string) => [...queryKeys.prospects.all, 'detail', id] as const,
    stageTransitions: (id: string) => [...queryKeys.prospects.all, 'stage-transitions', id] as const,
    positionings: (id: string) => [...queryKeys.prospects.all, 'positionings', id] as const,
  },
  ```

- [x] **3.2** In `apps/frontend/src/features/prospects/lib/api.ts`, add three new methods to `prospectsApi`:
  ```typescript
  import type {
    // existing imports...
    ProspectPositioningDetailType,
    ProspectPositioningType,
  } from '@battlecrm/shared'

  export const prospectsApi = {
    // ... existing methods unchanged ...

    positionings(id: string): Promise<{ data: ProspectPositioningDetailType[]; meta: { total: number } }> {
      return fetchApi(`/prospects/${id}/positionings`)
    },

    assignPositioning(id: string, positioningId: string): Promise<ProspectPositioningType> {
      return fetchApi(`/prospects/${id}/positionings`, {
        method: 'POST',
        body: JSON.stringify({ positioning_id: positioningId }),
      })
    },

    setPositioningOutcome(
      id: string,
      outcome: 'success' | 'failed',
    ): Promise<ProspectPositioningType> {
      return fetchApi(`/prospects/${id}/positionings/current/outcome`, {
        method: 'PATCH',
        body: JSON.stringify({ outcome }),
      })
    },
  }
  ```

---

### Task 4: Frontend — mutation hooks

- [x] **4.1** Create `apps/frontend/src/features/prospects/hooks/useProspectPositioningMutations.ts`:
  ```typescript
  import { useMutation, useQueryClient } from '@tanstack/react-query'
  import { queryKeys } from '@/lib/queryKeys'
  import { prospectsApi } from '../lib/api'

  export function useAssignPositioning() {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: ({ prospectId, positioningId }: { prospectId: string; positioningId: string }) =>
        prospectsApi.assignPositioning(prospectId, positioningId),
      onSuccess: () => {
        // Refresh prospect data (activePositioning changes)
        queryClient.invalidateQueries({ queryKey: queryKeys.prospects.all })
      },
    })
  }

  export function useSetPositioningOutcome() {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: ({
        prospectId,
        outcome,
      }: {
        prospectId: string
        outcome: 'success' | 'failed'
      }) => prospectsApi.setPositioningOutcome(prospectId, outcome),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.prospects.all })
      },
    })
  }
  ```

---

### Task 5: PositioningSection component (AC1, AC2, AC3, AC6)

- [x] **5.1** Create `apps/frontend/src/features/prospects/components/PositioningSection.tsx`.

  This component handles the full positioning state machine inside ProspectDetail:
  - State A: No active positioning + stage has positionings → show assign select + alert icon
  - State B: Active positioning, `outcome = null` → show name + yellow icon + [✓ Succès] [✗ Échec] buttons
  - State C: Active positioning, outcome decided → show name + colored outcome icon (no buttons)

  ```typescript
  import type { PositioningType, ProspectType } from '@battlecrm/shared'
  import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react'
  import { useState } from 'react'
  import { useTranslation } from 'react-i18next'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { FieldError } from '@/components/ui/field'
  import { Label } from '@/components/ui/label'
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select'
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
  import { usePositionings } from '@/features/positionings/hooks/usePositionings'
  import { ApiError } from '@/lib/api'
  import { useAssignPositioning, useSetPositioningOutcome } from '../hooks/useProspectPositioningMutations'

  interface PositioningSectionProps {
    prospect: ProspectType
    /** Set to true when the prospect's current stage is known to have positionings */
    stageHasPositionings: boolean
  }

  export function PositioningSection({ prospect, stageHasPositionings }: PositioningSectionProps) {
    const { t } = useTranslation()
    const [assignError, setAssignError] = useState<string | null>(null)
    const [outcomeError, setOutcomeError] = useState<string | null>(null)

    const assign = useAssignPositioning()
    const setOutcome = useSetPositioningOutcome()

    // Load positionings for the current stage — used for assign select
    const { data: positioningsData } = usePositionings(
      { funnel_stage_id: prospect.funnelStageId },
      { enabled: !prospect.activePositioning && stageHasPositionings },
    )
    const availablePositionings = positioningsData?.data ?? []

    const { activePositioning } = prospect

    function handleAssign(positioningId: string) {
      setAssignError(null)
      assign.mutate(
        { prospectId: prospect.id, positioningId },
        {
          onError: (error) => {
            const message = error instanceof ApiError ? error.errors[0]?.message : undefined
            setAssignError(message ?? t('prospects.positioning.assignFailed'))
          },
        },
      )
    }

    function handleSetOutcome(outcome: 'success' | 'failed') {
      setOutcomeError(null)
      setOutcome.mutate(
        { prospectId: prospect.id, outcome },
        {
          onError: (error) => {
            const message = error instanceof ApiError ? error.errors[0]?.message : undefined
            setOutcomeError(message ?? t('prospects.positioning.outcomeFailed'))
          },
        },
      )
    }

    // State C — outcome decided
    if (activePositioning && activePositioning.outcome !== null) {
      return (
        <div className="flex flex-col gap-1">
          <Label>{t('prospects.fields.positioning')}</Label>
          <div className="flex items-center gap-2 text-sm">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {activePositioning.outcome === 'success' ? (
                    <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-destructive" />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {activePositioning.outcome === 'success'
                    ? t('prospects.positioning.outcomeSuccess')
                    : t('prospects.positioning.outcomeFailed')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span>{activePositioning.positioningName}</span>
          </div>
        </div>
      )
    }

    // State B — active positioning, outcome=null
    if (activePositioning) {
      return (
        <div className="flex flex-col gap-2">
          <Label>{t('prospects.fields.positioning')}</Label>
          <div className="flex items-center gap-2 text-sm">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Clock className="size-4 shrink-0 text-yellow-500" />
                </TooltipTrigger>
                <TooltipContent>{t('prospects.positioning.inProgress')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span>{activePositioning.positioningName}</span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-green-600/40 text-green-700 hover:bg-green-50 hover:text-green-700"
              disabled={setOutcome.isPending}
              onClick={() => handleSetOutcome('success')}
            >
              ✓ {t('prospects.positioning.success')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={setOutcome.isPending}
              onClick={() => handleSetOutcome('failed')}
            >
              ✗ {t('prospects.positioning.fail')}
            </Button>
          </div>
          {outcomeError && <FieldError>{outcomeError}</FieldError>}
        </div>
      )
    }

    // State A — no active positioning
    if (!stageHasPositionings) {
      // Stage has no positionings — section not shown
      return null
    }

    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={`positioning-select-${prospect.id}`}>
          <span className="flex items-center gap-1.5">
            <AlertCircle className="size-3.5 text-destructive" />
            {t('prospects.fields.positioning')}
          </span>
        </Label>
        <Select onValueChange={handleAssign} disabled={assign.isPending}>
          <SelectTrigger id={`positioning-select-${prospect.id}`} className="w-full">
            <SelectValue placeholder={t('prospects.positioning.assignPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {availablePositionings.map((p: PositioningType) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {assignError && <FieldError>{assignError}</FieldError>}
      </div>
    )
  }
  ```

  > **Note:** `usePositionings` is imported from the positionings feature — cross-feature import is allowed since PositioningSection is in the prospects feature and uses positionings data. The `enabled` option ensures we only fetch positionings for the assign select when actually needed (State A).

---

### Task 6: KanbanCard visual indicators (AC1, AC2, AC3)

- [x] **6.1** Update `KanbanCard` props to accept `stageHasPositionings`:
  ```typescript
  interface KanbanCardProps {
    prospect: ProspectType
    onOpenDetail: (prospect: ProspectType) => void
    stageHasPositionings: boolean  // ADD THIS
    overlay?: boolean
  }
  ```

- [x] **6.2** Add positioning indicator icon inside the card content. Place it between the text block and the Plus button. Use Lucide icons: `AlertCircle` (red, no positioning), `Clock` (yellow, outcome=null), `CheckCircle2` (green, success), `XCircle` (red, failed). Use `TooltipProvider/Tooltip` for all icons.

  ```typescript
  // Inside CardContent, after the text block `<div className="min-w-0 flex-1">`:
  {/* Positioning indicator — not shown for archived prospects */}
  {!isArchived && !overlay && (
    <PositioningIndicator
      prospect={prospect}
      stageHasPositionings={stageHasPositionings}
    />
  )}
  ```

  Create a small inline helper component or render inline:
  ```typescript
  // Inline within KanbanCard or extract as tiny internal component:
  function getPositioningIcon(
    prospect: ProspectType,
    stageHasPositionings: boolean,
  ): React.ReactNode | null {
    const { activePositioning } = prospect
    if (activePositioning?.outcome === 'success') {
      return <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
    }
    if (activePositioning?.outcome === 'failed') {
      return <XCircle className="size-3.5 shrink-0 text-destructive" />
    }
    if (activePositioning) {
      // outcome = null (in progress)
      return <Clock className="size-3.5 shrink-0 text-yellow-500" />
    }
    if (stageHasPositionings) {
      // no positioning assigned but stage has some
      return <AlertCircle className="size-3.5 shrink-0 text-destructive" />
    }
    return null
  }
  ```

  Wrap each icon in `TooltipProvider/Tooltip` with appropriate tooltip text.

- [x] **6.3** Update `KanbanColumn` to accept and forward `stageHasPositionings`:
  ```typescript
  interface KanbanColumnProps {
    stage: FunnelStageType
    prospects: ProspectType[]
    onOpenDetail: (prospect: ProspectType) => void
    stageHasPositionings: boolean  // ADD THIS
  }
  // Pass to each KanbanCard:
  <KanbanCard key={prospect.id} prospect={prospect} onOpenDetail={onOpenDetail} stageHasPositionings={stageHasPositionings} />
  ```

---

### Task 7: ProspectsKanbanView — load positionings + stage change popup (AC4)

- [x] **7.1** In `ProspectsKanbanView`, load all non-archived positionings to determine which stages have positionings:
  ```typescript
  import { usePositionings } from '@/features/positionings/hooks/usePositionings'

  const { data: positioningsData } = usePositionings()
  const positionings = positioningsData?.data ?? []

  // Compute set of stage IDs that have at least one non-archived positioning
  const stagesWithPositionings = useMemo(
    () => new Set(positionings.map((p) => p.funnelStageId)),
    [positionings],
  )
  ```

- [x] **7.2** Add state for the stage change outcome popup:
  ```typescript
  const [outcomePopup, setOutcomePopup] = useState<{
    prospectId: string
    positioningName: string
    targetStageName: string
  } | null>(null)
  ```

- [x] **7.3** Add `useSetPositioningOutcome` mutation:
  ```typescript
  import { useSetPositioningOutcome } from '../hooks/useProspectPositioningMutations'
  const setOutcome = useSetPositioningOutcome()
  ```

- [x] **7.4** Update `handleDragEnd` to trigger popup when needed:
  ```typescript
  function handleDragEnd(event: DragEndEvent) {
    setActiveProspect(null)
    const { active, over } = event
    if (!over) return

    const fromStageId = active.data.current?.fromStageId as string
    const toStageId = over.id as string
    if (fromStageId === toStageId) return

    const prospectId = active.id as string
    const prospect = allProspects.find((p) => p.id === prospectId)

    // Optimistic move — always proceed immediately (non-blocking per architecture)
    setOptimisticOverrides((prev) => ({ ...prev, [prospectId]: toStageId }))
    update.mutate(
      { id: prospectId, funnel_stage_id: toStageId },
      {
        onError: () => {
          setOptimisticOverrides((prev) => {
            const next = { ...prev }
            delete next[prospectId]
            return next
          })
          toast.error(t('prospects.kanban.moveFailed'))
        },
      },
    )

    // Show outcome popup if active positioning has no outcome yet
    if (prospect?.activePositioning?.outcome === null) {
      const targetStage = stages.find((s) => s.id === toStageId)
      setOutcomePopup({
        prospectId,
        positioningName: prospect.activePositioning.positioningName,
        targetStageName: targetStage?.name ?? '',
      })
    }
  }
  ```

- [x] **7.5** Render the outcome popup (non-modal) — a small fixed banner at the bottom of the screen or inline near the board. Use a simple `div` or shadcn `Card` with buttons:
  ```tsx
  {outcomePopup && (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background p-4 shadow-lg">
      <p className="mb-3 text-sm font-medium">
        {t('prospects.positioning.popupTitle', { stage: outcomePopup.targetStageName })}
      </p>
      <p className="mb-3 text-sm text-muted-foreground">
        {t('prospects.positioning.popupBody', { name: outcomePopup.positioningName })}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-green-600/40 text-green-700 hover:bg-green-50 hover:text-green-700"
          disabled={setOutcome.isPending}
          onClick={() => {
            setOutcome.mutate(
              { prospectId: outcomePopup.prospectId, outcome: 'success' },
              { onSettled: () => setOutcomePopup(null) },
            )
          }}
        >
          ✓ {t('prospects.positioning.success')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
          disabled={setOutcome.isPending}
          onClick={() => {
            setOutcome.mutate(
              { prospectId: outcomePopup.prospectId, outcome: 'failed' },
              { onSettled: () => setOutcomePopup(null) },
            )
          }}
        >
          ✗ {t('prospects.positioning.fail')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOutcomePopup(null)}
        >
          {t('prospects.positioning.skip')}
        </Button>
      </div>
    </div>
  )}
  ```

- [x] **7.6** Update `KanbanColumn` calls to pass `stageHasPositionings`:
  ```tsx
  {stages.map((stage) => (
    <KanbanColumn
      key={stage.id}
      stage={stage}
      prospects={prospectsByStage[stage.id] ?? []}
      onOpenDetail={setSelectedProspect}
      stageHasPositionings={stagesWithPositionings.has(stage.id)}
    />
  ))}
  ```

- [x] **7.7** Also update the `DragOverlay` KanbanCard (no indicator needed in overlay):
  ```tsx
  <KanbanCard prospect={activeProspect} onOpenDetail={() => {}} overlay stageHasPositionings={false} />
  ```

---

### Task 8: ProspectDetail — add PositioningSection + stage change popup + archive flow (AC1-AC6)

- [x] **8.1** In `ProspectDetail.tsx`, compute `stageHasPositionings` from already-loaded `useFunnelStages` data. Note: `useFunnelStages()` returns stage IDs but NOT whether they have positionings. Load positionings for the current stage:
  ```typescript
  import { usePositionings } from '@/features/positionings/hooks/usePositionings'
  import { PositioningSection } from './PositioningSection'

  // Inside the component — load positionings for current stage
  const { data: stagePositioningsData } = usePositionings(
    { funnel_stage_id: prospect.funnelStageId },
    { enabled: !isArchived },
  )
  const stageHasPositionings = (stagePositioningsData?.data.length ?? 0) > 0
  ```

- [x] **8.2** Add `PositioningSection` to the read-only mode, after the stage selector and before the timeline. Only for non-archived prospects:
  ```tsx
  {/* Positioning section — active prospects only */}
  {!isArchived && (
    <PositioningSection prospect={prospect} stageHasPositionings={stageHasPositionings} />
  )}

  {/* Unified timeline */}
  <div className="mt-4">
    <ProspectTimeline prospectId={prospect.id} isArchived={isArchived} />
  </div>
  ```

- [x] **8.3** Add stage change popup state and handler in ProspectDetail. Reuse the same popup pattern as KanbanView but rendered inline in the detail view (below the stage selector):
  ```typescript
  import { useSetPositioningOutcome } from '../hooks/useProspectPositioningMutations'

  const setOutcome = useSetPositioningOutcome()
  const [pendingStageId, setPendingStageId] = useState<string | null>(null)
  const [showOutcomePrompt, setShowOutcomePrompt] = useState(false)
  ```

  Update `handleStageChange()`:
  ```typescript
  function handleStageChange(newStageId: string) {
    setStageError(null)

    // If active positioning has no outcome yet, show prompt (non-blocking)
    if (prospect.activePositioning?.outcome === null) {
      setShowOutcomePrompt(true)
      setPendingStageId(newStageId)
      // Do NOT wait for outcome — proceed with stage change immediately
    }

    update.mutate(
      { id: prospect.id, funnel_stage_id: newStageId },
      {
        onSuccess: () => {
          toast.success(t('prospects.toast.stageMoved'))
          // Outcome prompt is dismissed when user interacts OR on next render
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          setStageError(message ?? t('prospects.toast.stageMoveFailed'))
          setShowOutcomePrompt(false)
        },
      },
    )
  }
  ```

  Render the prompt inline (below stage selector, above PositioningSection):
  ```tsx
  {showOutcomePrompt && prospect.activePositioning && (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <p className="mb-2 font-medium">
        {t('prospects.positioning.popupBody', {
          name: prospect.activePositioning.positioningName,
        })}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline"
          className="border-green-600/40 text-green-700 hover:bg-green-50"
          disabled={setOutcome.isPending}
          onClick={() => {
            setOutcome.mutate(
              { prospectId: prospect.id, outcome: 'success' },
              { onSettled: () => setShowOutcomePrompt(false) },
            )
          }}
        >✓ {t('prospects.positioning.success')}</Button>
        <Button size="sm" variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
          disabled={setOutcome.isPending}
          onClick={() => {
            setOutcome.mutate(
              { prospectId: prospect.id, outcome: 'failed' },
              { onSettled: () => setShowOutcomePrompt(false) },
            )
          }}
        >✗ {t('prospects.positioning.fail')}</Button>
        <Button size="sm" variant="ghost" onClick={() => setShowOutcomePrompt(false)}>
          {t('prospects.positioning.skip')}
        </Button>
      </div>
    </div>
  )}
  ```

- [x] **8.4** Update `handleArchiveConfirm()` — set outcome='failed' before archiving if active positioning has outcome=null (AC5):
  ```typescript
  function handleArchiveConfirm() {
    setArchiveError(null)

    // Best-effort: set outcome='failed' for active positioning before archiving
    // Backend setOutcome() uses withTrashed() on prospect — safe to call even if prospect
    // is being soft-deleted (Story 5B.2 note, Task 4.6 of that story)
    const doArchive = () => {
      archive.mutate(prospect.id, {
        onSuccess: () => {
          toast.success(t('prospects.toast.archived'))
          onClose?.()
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          setArchiveError(message ?? t('prospects.toast.archiveFailed'))
        },
      })
    }

    if (prospect.activePositioning?.outcome === null) {
      // Fire and forget — don't await, don't block archive on failure
      setOutcome.mutate(
        { prospectId: prospect.id, outcome: 'failed' },
        { onSettled: doArchive }, // archive regardless of setOutcome success/failure
      )
    } else {
      doArchive()
    }
  }
  ```

---

### Task 9: i18n translations (fr.json + en.json)

- [x] **9.1** In `apps/frontend/public/locales/fr.json`, add under `"prospects"`:
  ```json
  "positioning": {
    "assignPlaceholder": "Assigner un positionnement...",
    "inProgress": "En cours",
    "outcomeSuccess": "Succès",
    "outcomeFailed": "Échec",
    "success": "Succès",
    "fail": "Échec",
    "skip": "Passer sans décider",
    "assignFailed": "Impossible d'assigner le positionnement.",
    "outcomeFailed": "Impossible de définir le résultat.",
    "popupTitle": "Avant de passer à \"{{stage}}\"",
    "popupBody": "Comment s'est passé \"{{name}}\" ?"
  }
  ```

- [x] **9.2** In `apps/frontend/public/locales/en.json`, add the same under `"prospects"`:
  ```json
  "positioning": {
    "assignPlaceholder": "Assign a positioning...",
    "inProgress": "In progress",
    "outcomeSuccess": "Success",
    "outcomeFailed": "Failure",
    "success": "Success",
    "fail": "Failure",
    "skip": "Skip",
    "assignFailed": "Failed to assign positioning.",
    "outcomeFailed": "Failed to set outcome.",
    "popupTitle": "Before moving to \"{{stage}}\"",
    "popupBody": "How did \"{{name}}\" go?"
  }
  ```

- [x] **9.3** Also update `dist/locales/` if needed — check if the dist folder is auto-generated by build or manually maintained. If manually maintained, apply the same changes to `dist/locales/fr.json` and `dist/locales/en.json`. If auto-generated, run `pnpm --filter @battlecrm/frontend build`.

---

### Task 10: Verification (AC8)

- [x] **10.1** `pnpm biome check --write .` from root — 0 errors. Biome sorts imports alphabetically: `@` before `#` before relative.
- [x] **10.2** `pnpm --filter @battlecrm/shared build` — success.
- [x] **10.3** `pnpm --filter @battlecrm/backend type-check` — 0 errors.
- [x] **10.4** `pnpm --filter @battlecrm/frontend type-check` — 0 errors.
- [x] **10.5** Start the dev server and manually verify:
  - A prospect on a stage with positionings shows the red alert icon on Kanban card
  - Assigning a positioning shows the yellow clock icon + success/fail buttons
  - Setting outcome shows colored icon, buttons disappear
  - Moving a prospect (drag or dropdown) when outcome=null triggers the popup
  - Archiving a prospect with unresolved positioning auto-sets outcome='failed' (check in the positioning tab for that prospect if it shows 'failed')
- [x] **10.6** Run functional tests to ensure backend changes don't break anything: `ENV_PATH=../../ node ace test functional` from `apps/backend/` — all tests pass.

## Dev Notes

### Architecture: activePositioning in ProspectType

The key design decision is adding `activePositioning` to `ProspectType` to avoid N+1 queries in the Kanban board. Without this, showing positioning indicators for 50+ prospect cards would require 50+ API calls. With it, the Kanban renders all indicators from a single list API response.

The "active" positioning is computed server-side:
- Query: `SELECT * FROM prospect_positionings WHERE prospect_id = ? AND funnel_stage_id = prospect.funnel_stage_id`
- In `index()`: one batch query for all prospects — load all pp records for visible prospects, then filter in memory by matching `pp.funnelStageId === prospect.funnelStageId`
- In `show()/update()/restore()`: one targeted query per prospect

### Stage Change Flow: Non-Blocking

Per architecture decision (Option A), the stage change always proceeds. The popup is additive — it allows the user to also capture the outcome, but does not gate the move. Implementation: trigger both the stage change mutation AND show the popup simultaneously.

### Archive Flow: Best-Effort Outcome

When archiving, `setOutcome('failed')` is called via `onSettled` callback chaining. Whether it succeeds or fails, the archive proceeds. The backend's `setOutcome` endpoint uses `withTrashed()` on the prospect, so even during the brief window after `prospect.delete()` sets `deleted_at`, the endpoint still finds the prospect.

Order: setOutcome → (regardless) → archive. Both are async but chained.

### loadActivePositioning in Serializer

The `loadActivePositioning` helper in the serializer file uses `ProspectPositioning.query()` directly. Import at the top of `prospect.ts` serializer — no circular dependency exists between `apps/backend/app/serializers/prospect.ts` and `apps/backend/app/models/prospect_positioning.ts`.

### Positioning Preloading in Batch Query

```typescript
.preload('positioning', (q) => q.withTrashed())
```

The `.withTrashed()` on positioning preload ensures that if a positioning is archived after being assigned to a prospect, the positioning name is still shown (not lost). The serializer shows the name regardless of archive status — no "Positioning supprimé" handling needed here (unlike `funnelStageName` which can show "Stage supprimé").

### stageHasPositionings Prop Threading

Data flow: `ProspectsKanbanView` computes `stagesWithPositionings: Set<string>` from `usePositionings()` → passed to `KanbanColumn` as `stageHasPositionings: boolean` → forwarded to each `KanbanCard`. This adds two props (one each to Column and Card) but is minimal and avoids context overhead.

In `ProspectDetail`, independently fetch `usePositionings({ funnel_stage_id: prospect.funnelStageId })` to check if the stage has positionings. This is a separate fetch from the Kanban board — it runs only when the detail drawer is open. Acceptable since it's a single filtered request (likely cached by TanStack Query if already fetched for the Kanban).

### PositioningSection: Cross-Feature Import

`PositioningSection` imports `usePositionings` from the positionings feature. This is acceptable because the data needed (positionings for a given stage) originates from the positionings domain. Per architecture: "Used by 1 feature only → inside feature folder" — since `PositioningSection` is a prospects component that uses positioning data, this cross-feature import is necessary and intentional.

### Outcome Popup in ProspectDetail vs KanbanView

Two separate implementations of the popup (inline in ProspectDetail, fixed-position in KanbanView). They share i18n keys but have slightly different rendering. If the popup logic grows more complex, consider extracting to a shared component in `src/features/prospects/components/PositioningOutcomePrompt.tsx`.

### Lucide Icons Used

New icons in `KanbanCard` and `PositioningSection`:
- `AlertCircle` — no positioning assigned (red)
- `Clock` — in progress / outcome=null (yellow)
- `CheckCircle2` — success (green)
- `XCircle` — failed (red)

All already available via `lucide-react` (already a dependency).

### Project Structure Notes

**New files:**
```
apps/frontend/src/features/prospects/hooks/useProspectPositioningMutations.ts
apps/frontend/src/features/prospects/components/PositioningSection.tsx
```

**Modified files:**
```
packages/shared/src/types/prospect.ts                          — add activePositioning to ProspectType
apps/backend/app/serializers/prospect.ts                       — extended signature + loadActivePositioning
apps/backend/app/controllers/prospects_controller.ts           — activePositioning in responses
apps/frontend/src/lib/queryKeys.ts                             — add prospects.positionings key
apps/frontend/src/features/prospects/lib/api.ts                — 3 new API methods
apps/frontend/src/features/prospects/components/KanbanCard.tsx — add indicator + stageHasPositionings prop
apps/frontend/src/features/prospects/components/KanbanColumn.tsx — forward stageHasPositionings prop
apps/frontend/src/features/prospects/components/ProspectsKanbanView.tsx — positionings load + popup
apps/frontend/src/features/prospects/components/ProspectDetail.tsx — PositioningSection + archive flow
apps/frontend/public/locales/fr.json                           — positioning keys
apps/frontend/public/locales/en.json                           — positioning keys
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5B.3] — User story and acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture.md#Prospect-Positioning Assignment Model] — Design: active positioning derivation, outcome rules, visual indicators, stage change flow (Option A), archive behavior
- [Source: _bmad-output/implementation-artifacts/5b-2-implement-prospect-positioning-api.md] — API endpoints, complete implementation details (Task 4 - controller code, Task 3 - serializers), ProspectPositioningDetailType shape
- [Source: packages/shared/src/types/prospect-positioning.ts] — Shared types ProspectPositioningType, ProspectPositioningDetailType
- [Source: apps/frontend/src/features/prospects/components/ProspectDetail.tsx] — Existing stage change flow, archive flow patterns to extend
- [Source: apps/frontend/src/features/prospects/components/ProspectsKanbanView.tsx] — Drag-and-drop handleDragEnd pattern, optimistic update pattern
- [Source: apps/frontend/src/features/prospects/components/KanbanCard.tsx] — Card rendering, TooltipProvider pattern
- [Source: apps/frontend/src/features/positionings/hooks/usePositionings.ts] — Hook signature (funnel_stage_id filter)
- [Source: apps/backend/app/controllers/prospects_controller.ts] — All controller methods to update

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

1. `ProspectType` extended with `activePositioning: { positioningId, positioningName, outcome } | null` — shared package rebuilt. Backward-compatible (existing callers of `serializeProspect()` pass no second arg, defaulting to `null`).
2. Backend `serializeProspect()` accepts optional `activePositioning` param. New `loadActivePositioning()` helper handles single-prospect queries with `preload('positioning', q => q.withTrashed())`.
3. `ProspectsController.index()` uses batch query: load all prospect_positionings for visible prospects in ONE extra query, filter in-memory by matching `pp.funnelStageId === prospect.funnelStageId`. No N+1.
4. `PositioningSection` component: 3-state machine (no positioning + stage has some → alert + assign select; active outcome=null → yellow clock + success/fail buttons; outcome decided → colored icon + name, no buttons). Cross-feature import of `usePositionings` is intentional and acceptable.
5. `KanbanCard` + `KanbanColumn`: `stageHasPositionings` prop threaded from `ProspectsKanbanView` → `KanbanColumn` → `KanbanCard` → `PositioningIndicator`. Indicator hidden for archived prospects and drag overlay.
6. `ProspectsKanbanView`: `usePositionings()` loaded to compute `stagesWithPositionings: Set<string>`. Stage change popup (fixed bottom-right `div`) fires when dragged prospect has `activePositioning.outcome === null`. Stage change always proceeds immediately — popup is non-blocking.
7. `ProspectDetail`: inline outcome prompt (below stage selector) shown when `prospect.activePositioning.outcome === null` and stage changes. Archive flow: `setOutcome('failed')` called with `onSettled: doArchive` — archive proceeds regardless.
8. Biome: 0 errors. Removed unused `ApiError` import from `ProspectsKanbanView.tsx`. 5 files auto-fixed (import ordering by Biome).
9. Backend type-check: 0 errors. Frontend type-check: 0 errors.
10. 245 functional tests pass — no regressions introduced.
11. **AC9 (positioning history):** `PositioningSection` fetches `GET /api/prospects/:id/positionings` via new `useProspectPositionings` hook. Past positionings (those with `isActive = false`, i.e. assigned to a previous funnel stage) are shown with outcome icon + name + stage name. For archived prospects, only this history block is rendered (no interactive UI). New `isArchived` prop added to `PositioningSection` to control this.
12. **AC3 extended:** State C keeps the [✓ Succès] / [✗ Échec] buttons to allow outcome correction after initial set. A [Change positioning] button (`isReassigning` state) allows full reassignment. `useAssignPositioning.onSuccess` now also resets `isReassigning = false`.
13. **Bug fix (AC4 popup race condition):** `ProspectDetail` popup uses `outcomePositioningName` + `outcomeTargetStageName` states (captured at popup-open time) instead of reading `prospect.activePositioning` live. After a stage change, TanStack Query refetch sets `prospect.activePositioning = null` (the old positioning is no longer active for the new stage), which caused the popup to disappear before the user could click. The captured states prevent this. `popupTitle` also added to ProspectDetail popup (was missing — only KanbanView had it).
14. **`setPositioningOutcome` `stage_id` override:** The mutation and API method accept an optional `stageId` parameter. For the KanbanView popup, the prospect may have already moved to the new stage by the time the user clicks — `stage_id` targets the correct `prospect_positionings` record (the one from the old stage). Backend `setOutcomeValidator` accepts optional `stage_id: uuid`.
15. **E2E test suite (158 tests passing):** New `tests/e2e/prospects-positioning.spec.ts` covers AC1–AC6. Interaction tests updated for removed `status`/`deleted_at` fields (separate refactor on this branch). `test_controller.ts` fixed to delete `prospect_positionings` before `prospects` (FK constraint). SVG selector corrected: `svg.lucide-circle-alert` (lucide-react v0.563 renamed `AlertCircle` → `CircleAlert`).

### File List

**New files:**
- `apps/frontend/src/features/prospects/hooks/useProspectPositioningMutations.ts`
- `apps/frontend/src/features/prospects/hooks/useProspectPositionings.ts` *(AC9 — positioning history)*
- `apps/frontend/src/features/prospects/components/PositioningSection.tsx`

**Modified files:**
- `packages/shared/src/types/prospect.ts`
- `apps/backend/app/serializers/prospect.ts`
- `apps/backend/app/controllers/prospects_controller.ts`
- `apps/backend/app/controllers/test_controller.ts` *(E2E fix: add prospect_positionings FK cleanup)*
- `apps/frontend/src/lib/queryKeys.ts`
- `apps/frontend/src/features/prospects/lib/api.ts`
- `apps/frontend/src/features/prospects/components/KanbanCard.tsx`
- `apps/frontend/src/features/prospects/components/KanbanColumn.tsx`
- `apps/frontend/src/features/prospects/components/ProspectsKanbanView.tsx`
- `apps/frontend/src/features/prospects/components/ProspectDetail.tsx`
- `apps/frontend/src/features/prospects/components/ProspectTimeline.tsx` *(removed dead "show archived" toggle)*
- `apps/frontend/public/locales/fr.json`
- `apps/frontend/public/locales/en.json`
- `apps/frontend/src/components/common/AppNavbar.tsx` *(Biome import sort + nav link order fix)*
- `tests/e2e/prospects-positioning.spec.ts` *(new E2E tests for AC1–AC6)*
- `tests/support/helpers/api.ts` *(updated createInteraction type)*
