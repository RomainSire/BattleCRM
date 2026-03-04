import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { closestCorners, DndContext, DragOverlay } from '@dnd-kit/core'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { useUpdateProspect } from '../hooks/useProspectMutations'
import { useProspects } from '../hooks/useProspects'
import type { ProspectType } from '../lib/api'
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

export function ProspectsKanbanView() {
  const { t } = useTranslation()
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProspect, setSelectedProspect] = useState<ProspectType | null>(null)
  const [activeProspect, setActiveProspect] = useState<ProspectType | null>(null)
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, string>>({})

  const { data: prospectsData, isLoading: prospectsLoading } = useProspects(
    showArchived ? { include_archived: true } : undefined,
  )
  const { data: stagesData, isLoading: stagesLoading } = useFunnelStages()
  const update = useUpdateProspect()

  const stages = stagesData?.data ?? []
  const allProspects = prospectsData?.data ?? []

  // Clean up optimistic overrides that are now consistent with server data
  useEffect(() => {
    const toRemove = allProspects
      .filter(
        (p) =>
          optimisticOverrides[p.id] !== undefined && optimisticOverrides[p.id] === p.funnelStageId,
      )
      .map((p) => p.id)
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

    // Optimistic move
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
      <div className="flex items-center gap-4">
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
            />
          ))}
        </div>

        <DragOverlay>
          {activeProspect ? (
            <div className="w-64">
              <KanbanCard prospect={activeProspect} onOpenDetail={() => {}} overlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Prospect detail drawer */}
      <Drawer
        direction="right"
        open={!!selectedProspect}
        onOpenChange={(open) => !open && setSelectedProspect(null)}
      >
        <DrawerContent className="overflow-y-auto" style={{ maxWidth: '560px' }}>
          <DrawerHeader>
            <DrawerTitle>{selectedProspect?.name}</DrawerTitle>
          </DrawerHeader>
          {selectedProspect && (
            <ProspectDetail
              key={selectedProspect.id}
              prospect={selectedProspect}
              onClose={() => setSelectedProspect(null)}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
