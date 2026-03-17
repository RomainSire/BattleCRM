import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useInteractions } from '../hooks/useInteractions'
import { TimelineItem } from './TimelineItem'

interface ProspectInteractionsTimelineProps {
  prospectId: string
}

export function ProspectInteractionsTimeline({ prospectId }: ProspectInteractionsTimelineProps) {
  const { t } = useTranslation()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const { data, isLoading, isError } = useInteractions({
    prospect_id: prospectId,
    ...(showArchived && { include_archived: true }),
  })

  const interactions = data?.data ?? []

  if (isLoading) {
    return (
      <div className="space-y-2">
        {['s0', 's1', 's2'].map((key) => (
          <div key={key} className="flex gap-3">
            <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return <p className="text-xs text-destructive">{t('interactions.loadError')}</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        <Switch
          id="show-archived-timeline"
          checked={showArchived}
          onCheckedChange={(checked) => {
            setShowArchived(checked)
            setExpandedId(null)
          }}
        />
        <Label htmlFor="show-archived-timeline" className="cursor-pointer text-xs">
          {t('interactions.showArchived')}
        </Label>
      </div>
      {interactions.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">{t('prospects.interactions.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {interactions.map((interaction) => (
            <TimelineItem
              key={interaction.id}
              interaction={interaction}
              isExpanded={expandedId === interaction.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === interaction.id ? null : interaction.id))
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}
