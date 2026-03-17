import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useInteractions } from '../hooks/useInteractions'
import { StatusIcon } from './StatusIcon'

interface ProspectInteractionsTimelineProps {
  prospectId: string
}

export function ProspectInteractionsTimeline({ prospectId }: ProspectInteractionsTimelineProps) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useInteractions({ prospect_id: prospectId })
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
    <ul className="space-y-1">
      {interactions.map((interaction) => {
        const isExpanded = expandedId === interaction.id
        return (
          <li key={interaction.id}>
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : interaction.id)}
              aria-expanded={isExpanded}
              className="flex w-full items-start gap-3 rounded px-1 py-1 text-left text-sm hover:bg-muted/50"
            >
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  'mt-0.5 size-3 shrink-0 text-muted-foreground transition-transform duration-200',
                  isExpanded && 'rotate-180',
                )}
              />
              <StatusIcon status={interaction.status} className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-muted-foreground text-xs">
                  {new Date(interaction.interactionDate).toLocaleDateString()}
                  {interaction.positioningName && <> · {interaction.positioningName}</>}
                </span>
                {interaction.notes && (
                  <p className={cn('text-sm', !isExpanded && 'line-clamp-2')}>
                    {interaction.notes}
                  </p>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="ml-7 mt-1 mb-2 space-y-1 rounded bg-muted/30 px-3 py-2 text-xs">
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                  <span className="text-muted-foreground">{t('interactions.detail.date')}</span>
                  <span>{new Date(interaction.interactionDate).toLocaleString()}</span>

                  <span className="text-muted-foreground">
                    {t('interactions.detail.positioning')}
                  </span>
                  <span>{interaction.positioningName ?? t('interactions.noPositioning')}</span>
                </div>

                {interaction.notes && (
                  <div className="pt-1">
                    <p className="text-muted-foreground mb-0.5">{t('interactions.fields.notes')}</p>
                    <p className="whitespace-pre-wrap">{interaction.notes}</p>
                  </div>
                )}
                {!interaction.notes && <p className="text-muted-foreground italic">—</p>}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
