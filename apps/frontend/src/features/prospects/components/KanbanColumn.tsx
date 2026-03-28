import type { FunnelStageType, ProspectType } from '@battlecrm/shared'
import { useDroppable } from '@dnd-kit/core'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnProps {
  stage: FunnelStageType
  prospects: ProspectType[]
  onOpenDetail: (prospect: ProspectType) => void
  stageHasPositionings: boolean
}

export function KanbanColumn({
  stage,
  prospects,
  onOpenDetail,
  stageHasPositionings,
}: KanbanColumnProps) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1">
        <span className="truncate text-sm font-medium">{stage.name}</span>
        <Badge
          variant="default"
          className="shrink-0 bg-brand-gradient text-xs text-white shadow-none"
        >
          {prospects.length}
        </Badge>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[200px] flex-col gap-2 rounded-md p-2 transition-colors',
          isOver && 'bg-primary/10 ring-1 ring-dashed ring-primary/40',
        )}
      >
        {prospects.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <p className="text-xs italic text-muted-foreground">
              {t('prospects.kanban.noProspects')}
            </p>
          </div>
        ) : (
          prospects.map((prospect) => (
            <KanbanCard
              key={prospect.id}
              prospect={prospect}
              onOpenDetail={onOpenDetail}
              stageHasPositionings={stageHasPositionings}
            />
          ))
        )}
      </div>
    </div>
  )
}
