import type { ProspectType } from '@battlecrm/shared'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { closestCorners, DndContext, DragOverlay } from '@dnd-kit/core'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { usePositionings } from '@/features/positionings/hooks/usePositionings'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { useUpdateProspect } from '../hooks/useProspectMutations'
import { useSetPositioningOutcome } from '../hooks/useProspectPositioningMutations'
import { useProspects } from '../hooks/useProspects'
import { KanbanCard } from './KanbanCard'
import { KanbanColumn } from './KanbanColumn'
import { ProspectDetail } from './ProspectDetail'

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = key(item)
      acc[k] = [...(acc[k] ?? []), item]
      return acc
    },
    {} as Record<string, T[]>,
  )
}

interface OutcomePopupState {
  prospectId: string
  positioningName: string
  targetStageName: string
  fromStageId: string
}

export function ProspectsKanbanView() {
  const { t } = useTranslation()
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProspect, setSelectedProspect] = useState<ProspectType | null>(null)
  const [activeProspect, setActiveProspect] = useState<ProspectType | null>(null)
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, string>>({})
  const [outcomePopup, setOutcomePopup] = useState<OutcomePopupState | null>(null)

  const { data: prospectsData, isLoading: prospectsLoading } = useProspects(
    showArchived ? { include_archived: true } : undefined,
  )
  const { data: stagesData, isLoading: stagesLoading } = useFunnelStages()
  const { data: positioningsData } = usePositionings()
  const update = useUpdateProspect()
  const setOutcome = useSetPositioningOutcome()

  const stages = stagesData?.data ?? []
  const allProspects = prospectsData?.data ?? []
  const allPositionings = positioningsData?.data ?? []

  // Compute set of stage IDs that have at least one non-archived positioning
  const stagesWithPositionings = useMemo(
    () => new Set(allPositionings.map((p) => p.funnelStageId)),
    [allPositionings],
  )

  // Clean up optimistic overrides that are resolved (server caught up) or orphaned (prospect archived/gone)
  useEffect(() => {
    const prospectMap = new Map(allProspects.map((p) => [p.id, p]))
    const toRemove = Object.keys(optimisticOverrides).filter((id) => {
      const prospect = prospectMap.get(id)
      return !prospect || prospect.funnelStageId === optimisticOverrides[id]
    })
    if (toRemove.length === 0) return
    setOptimisticOverrides((prev) => {
      const next = { ...prev }
      for (const id of toRemove) delete next[id]
      return next
    })
  }, [allProspects, optimisticOverrides])

  // Apply optimistic overrides on top of server data
  const prospectsWithOverrides = useMemo(
    () =>
      allProspects.map((p) =>
        optimisticOverrides[p.id] ? { ...p, funnelStageId: optimisticOverrides[p.id] } : p,
      ),
    [allProspects, optimisticOverrides],
  )

  // Keep selectedProspect in sync with live server data so ProspectDetail always sees fresh
  // funnelStageId + activePositioning after a stage change or positioning mutation.
  const liveSelectedProspect = useMemo(
    () =>
      selectedProspect
        ? (prospectsWithOverrides.find((p) => p.id === selectedProspect.id) ?? selectedProspect)
        : null,
    [selectedProspect, prospectsWithOverrides],
  )

  // Client-side search filter (name + company per AC5)
  const filteredProspects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return prospectsWithOverrides
    return prospectsWithOverrides.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.company?.toLowerCase().includes(q) ?? false),
    )
  }, [prospectsWithOverrides, searchQuery])

  // Group prospects by funnel stage
  const prospectsByStage = useMemo(
    () => groupBy(filteredProspects, (p) => p.funnelStageId),
    [filteredProspects],
  )

  function handleDragStart(event: DragStartEvent) {
    const prospect = event.active.data.current?.prospect as ProspectType | undefined
    setActiveProspect(prospect ?? null)
  }

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

    // API call — intentional toast.error exception per AC3 (no form to show inline error on)
    update.mutate(
      { id: prospectId, funnel_stage_id: toStageId },
      {
        onError: () => {
          // Revert optimistic update
          setOptimisticOverrides((prev) => {
            const next = { ...prev }
            delete next[prospectId]
            return next
          })
          toast.error(t('prospects.kanban.moveFailed'))
        },
      },
    )

    // Show outcome popup if active positioning has no outcome yet (non-blocking)
    if (prospect?.activePositioning?.outcome === null) {
      const targetStage = stages.find((s) => s.id === toStageId)
      setOutcomePopup({
        prospectId,
        positioningName: prospect.activePositioning.positioningName,
        targetStageName: targetStage?.name ?? '',
        fromStageId,
      })
    }
  }

  function handleOutcomeChoice(outcome: 'success' | 'failed') {
    if (!outcomePopup) return
    setOutcome.mutate(
      { prospectId: outcomePopup.prospectId, outcome, stageId: outcomePopup.fromStageId },
      { onSettled: () => setOutcomePopup(null) },
    )
  }

  if (prospectsLoading || stagesLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {['s0', 's1', 's2', 's3'].map((key) => (
          <Skeleton key={key} className="h-48 w-64 shrink-0" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: search + archived toggle */}
      <div className="flex items-center gap-3">
        <Input
          type="search"
          placeholder={t('prospects.kanban.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 w-56 text-sm"
          aria-label={t('prospects.kanban.searchPlaceholder')}
        />
        <div className="flex items-center gap-2">
          <Switch
            id="kanban-show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <Label htmlFor="kanban-show-archived" className="cursor-pointer text-sm">
            {t('prospects.kanban.showArchived')}
          </Label>
        </div>
      </div>

      {/* Kanban board */}
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              prospects={prospectsByStage[stage.id] ?? []}
              onOpenDetail={setSelectedProspect}
              stageHasPositionings={stagesWithPositionings.has(stage.id)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeProspect ? (
            <div className="w-64">
              <KanbanCard
                prospect={activeProspect}
                onOpenDetail={() => {}}
                stageHasPositionings={false}
                overlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Non-blocking outcome popup — appears after stage change when active positioning has no outcome */}
      {outcomePopup && (
        <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background p-4 shadow-lg">
          <p className="mb-1 text-sm font-medium">
            {t('prospects.positioning.popupTitle', { stage: outcomePopup.targetStageName })}
          </p>
          <p className="mb-3 text-sm text-muted-foreground">
            {t('prospects.positioning.popupBody', { name: outcomePopup.positioningName })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-green-600/40 text-green-700 hover:bg-green-50 hover:text-green-700"
              disabled={setOutcome.isPending}
              onClick={() => handleOutcomeChoice('success')}
            >
              ✓ {t('prospects.positioning.success')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={setOutcome.isPending}
              onClick={() => handleOutcomeChoice('failed')}
            >
              ✗ {t('prospects.positioning.fail')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOutcomePopup(null)}>
              {t('prospects.positioning.skip')}
            </Button>
          </div>
        </div>
      )}

      {/* Prospect detail drawer */}
      <Drawer
        direction="right"
        open={!!selectedProspect}
        onOpenChange={(open) => !open && setSelectedProspect(null)}
      >
        <DrawerContent className="overflow-y-auto" style={{ maxWidth: '560px' }}>
          <DrawerHeader>
            <DrawerTitle>{liveSelectedProspect?.name}</DrawerTitle>
          </DrawerHeader>
          {liveSelectedProspect && (
            <ProspectDetail
              key={selectedProspect!.id}
              prospect={liveSelectedProspect}
              onClose={() => setSelectedProspect(null)}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
