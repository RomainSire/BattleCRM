import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'
import { useFunnelStages, useReorderFunnelStages } from '../hooks/useFunnelStages'
import type { FunnelStageType } from '../lib/api'
import { AddStageForm } from './AddStageForm'
import { FunnelStageItem } from './FunnelStageItem'

export function FunnelStageList() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useFunnelStages()
  const reorder = useReorderFunnelStages()

  // Local state for optimistic reorder
  const [localStages, setLocalStages] = useState<FunnelStageType[]>([])

  useEffect(() => {
    if (data?.data) {
      setLocalStages(data.data)
    }
  }, [data?.data])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localStages.findIndex((s) => s.id === active.id)
    const newIndex = localStages.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(localStages, oldIndex, newIndex)

    // Optimistic update
    setLocalStages(reordered)

    // Send complete ordered list to backend
    reorder.mutate(
      reordered.map((s) => s.id),
      {
        onError: (error) => {
          // Rollback on error
          setLocalStages(data?.data ?? [])
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          toast.error(message ?? t('funnelStages.toast.reorderFailed'))
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {['skeleton-0', 'skeleton-1', 'skeleton-2'].map((key) => (
          <div key={key} className="h-10 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <p className="text-sm text-destructive">{t('funnelStages.loadError')}</p>
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={localStages.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {localStages.map((stage) => (
              <FunnelStageItem key={stage.id} stage={stage} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="pt-1">
        <AddStageForm />
      </div>
    </div>
  )
}
