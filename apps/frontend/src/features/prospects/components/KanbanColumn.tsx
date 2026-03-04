import { useDroppable } from '@dnd-kit/core'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { FunnelStageType } from '@/features/settings/lib/api'
import { cn } from '@/lib/utils'
import type { ProspectType } from '../lib/api'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnProps {
  stage: FunnelStageType
  prospects: ProspectType[]
  onOpenDetail: (prospect: ProspectType) => void
}

export function KanbanColumn({ stage, prospects, onOpenDetail }: KanbanColumnProps) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1">
        <span className="truncate text-sm font-medium">{stage.name}</span>
        <Badge variant="secondary" className="shrink-0 text-xs">
          {prospects.length}
        </Badge>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[200px] flex-col gap-2 rounded-md p-2 transition-colors',
          isOver && 'bg-accent/50',
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
            <KanbanCard key={prospect.id} prospect={prospect} onOpenDetail={onOpenDetail} />
          ))
        )}
      </div>
    </div>
  )
}
