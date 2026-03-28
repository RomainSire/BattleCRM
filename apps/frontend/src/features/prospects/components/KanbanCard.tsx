import type { ProspectType } from '@battlecrm/shared'
import { useDraggable } from '@dnd-kit/core'
import { AlertCircle, CheckCircle2, Clock, GripVertical, Plus, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AddInteractionDialog } from '@/features/interactions/components/AddInteractionDialog'
import { cn } from '@/lib/utils'

interface KanbanCardProps {
  prospect: ProspectType
  onOpenDetail: (prospect: ProspectType) => void
  /** True when the prospect's current stage has at least one non-archived positioning */
  stageHasPositionings: boolean
  /** True when rendered inside DragOverlay — applies tilt + shadow effect */
  overlay?: boolean
}

function PositioningIndicator({
  prospect,
  stageHasPositionings,
}: {
  prospect: ProspectType
  stageHasPositionings: boolean
}) {
  const { t } = useTranslation()
  const { activePositioning } = prospect

  let icon: React.ReactNode = null
  let tooltipText = ''

  if (activePositioning?.outcome === 'success') {
    icon = <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
    tooltipText = t('prospects.positioning.outcomeSuccess')
  } else if (activePositioning?.outcome === 'failed') {
    icon = <XCircle className="size-3.5 shrink-0 text-destructive" />
    tooltipText = t('prospects.positioning.outcomeFailedLabel')
  } else if (activePositioning) {
    // outcome = null (in progress)
    icon = <Clock className="size-3.5 shrink-0 text-yellow-500" />
    tooltipText = t('prospects.positioning.inProgress')
  } else if (stageHasPositionings) {
    // no positioning assigned but stage has some — alert
    icon = <AlertCircle className="size-3.5 shrink-0 text-destructive" />
    tooltipText = t('prospects.positioning.assignPlaceholder')
  }

  if (!icon) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center" aria-hidden="true">
            {icon}
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function KanbanCard({
  prospect,
  onOpenDetail,
  stageHasPositionings,
  overlay = false,
}: KanbanCardProps) {
  const { t } = useTranslation()
  const isArchived = prospect.deletedAt !== null

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: prospect.id,
    data: { prospect, fromStageId: prospect.funnelStageId },
    disabled: isArchived || overlay, // overlay clone must not register as a second draggable
  })

  return (
    <Card
      className={cn(
        'cursor-pointer gap-0 border-l-[3px] border-l-primary py-0 transition-shadow hover:shadow-md',
        isArchived && 'opacity-50 border-l-muted-foreground',
        isDragging && 'opacity-0',
        overlay && 'rotate-2 shadow-lg',
      )}
      onClick={() => !isDragging && onOpenDetail(prospect)}
    >
      <CardContent className="flex items-start gap-2 p-3">
        {/* Drag handle — hidden for archived prospects */}
        {/* dnd-kit spreads role="button" + keyboard listeners via ...attributes/...listeners at runtime */}
        {!isArchived && (
          // biome-ignore lint/a11y/noStaticElementInteractions: role="button" injected by dnd-kit ...attributes
          // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard events handled by dnd-kit ...listeners
          // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role="button" injected by dnd-kit at runtime
          <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            aria-label={t('prospects.aria.dragHandle', { name: prospect.name })}
            className="mt-0.5 cursor-grab touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="size-4 text-muted-foreground" />
          </div>
        )}

        {/* Card content */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{prospect.name}</p>
          {prospect.company && (
            <p className="truncate text-xs text-muted-foreground">{prospect.company}</p>
          )}
          {prospect.email && (
            <p className="truncate text-xs text-muted-foreground">{prospect.email}</p>
          )}
          {isArchived && (
            <Badge variant="secondary" className="mt-1 text-xs">
              {t('prospects.archived')}
            </Badge>
          )}
        </div>

        {/* Positioning indicator — shown for non-archived prospects, not in drag overlay */}
        {!isArchived && !overlay && (
          <PositioningIndicator prospect={prospect} stageHasPositionings={stageHasPositionings} />
        )}

        {/* Quick-add interaction — hidden for archived prospects and drag overlay */}
        {!isArchived && !overlay && (
          <TooltipProvider>
            <Tooltip>
              <AddInteractionDialog
                initialProspectId={prospect.id}
                trigger={
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0"
                      aria-label={t('interactions.addInteraction')}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                }
              />
              <TooltipContent>{t('interactions.addInteraction')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  )
}
