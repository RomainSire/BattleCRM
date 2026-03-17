import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { useInteractions } from '../hooks/useInteractions'
import { StatusIcon } from './StatusIcon'

interface ProspectInteractionsTimelineProps {
  prospectId: string
}

export function ProspectInteractionsTimeline({ prospectId }: ProspectInteractionsTimelineProps) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useInteractions({ prospect_id: prospectId })

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

  if (interactions.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">{t('prospects.interactions.empty')}</p>
    )
  }

  return (
    <ul className="space-y-2">
      {interactions.map((interaction) => (
        <li key={interaction.id} className="flex gap-3 text-sm">
          <StatusIcon status={interaction.status} className="mt-0.5 size-4 shrink-0" />
          <div>
            <span className="text-muted-foreground text-xs">
              {new Date(interaction.interactionDate).toLocaleDateString()}
              {interaction.positioningName && <> · {interaction.positioningName}</>}
            </span>
            {interaction.notes && <p className="line-clamp-2 text-sm">{interaction.notes}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}
