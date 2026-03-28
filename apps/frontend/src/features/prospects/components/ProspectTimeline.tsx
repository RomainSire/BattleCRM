import type { InteractionType, StageTransitionType } from '@battlecrm/shared'
import { ArrowRight, ChevronDown, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AddInteractionDialog } from '@/features/interactions/components/AddInteractionDialog'
import { TimelineItem } from '@/features/interactions/components/TimelineItem'
import { useInteractions } from '@/features/interactions/hooks/useInteractions'
import { useProspectStageTransitions } from '../hooks/useProspectStageTransitions'

type TimelineEvent =
  | { kind: 'interaction'; date: number; data: InteractionType }
  | { kind: 'transition'; date: number; data: StageTransitionType }

interface ProspectTimelineProps {
  prospectId: string
  isArchived: boolean
}

const PREVIEW_COUNT = 5

export function ProspectTimeline({ prospectId, isArchived }: ProspectTimelineProps) {
  const { t } = useTranslation()
  const [showAll, setShowAll] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const {
    data: interactionsData,
    isLoading: interactionsLoading,
    isError: interactionsError,
  } = useInteractions({ prospect_id: prospectId })

  const {
    data: transitionsData,
    isLoading: transitionsLoading,
    isError: transitionsError,
  } = useProspectStageTransitions(prospectId, { enabled: true })

  const isLoading = interactionsLoading || transitionsLoading
  const isError = interactionsError || transitionsError

  const events: TimelineEvent[] = useMemo(() => {
    const interactions = interactionsData?.data ?? []
    const transitions = transitionsData?.data ?? []

    return [
      ...interactions.map(
        (i): TimelineEvent => ({
          kind: 'interaction',
          date: new Date(i.interactionDate).getTime(),
          data: i,
        }),
      ),
      ...transitions.map(
        (tr): TimelineEvent => ({
          kind: 'transition',
          date: new Date(tr.transitionedAt).getTime(),
          data: tr,
        }),
      ),
    ].sort((a, b) => b.date - a.date)
  }, [interactionsData, transitionsData])

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t('prospects.timeline.title')}
          </p>
        </div>
        {!isArchived && (
          <AddInteractionDialog
            initialProspectId={prospectId}
            trigger={
              <Button type="button" size="sm" variant="outline">
                <Plus className="mr-1 size-3" />
                {t('prospects.interactions.logButton')}
              </Button>
            }
          />
        )}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-2">
          {['s0', 's1', 's2', 's3'].map((key) => (
            <div key={key} className="flex gap-3">
              <Skeleton className="mt-0.5 size-3 shrink-0" />
              <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <p className="text-xs text-destructive">{t('prospects.timeline.loadError')}</p>
      ) : events.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">{t('prospects.timeline.empty')}</p>
      ) : (
        (() => {
          const visibleEvents = showAll ? events : events.slice(0, PREVIEW_COUNT)
          const hiddenCount = events.length - PREVIEW_COUNT
          return (
            <>
              <ul className="space-y-0.5">
                {visibleEvents.map((event) => {
                  if (event.kind === 'interaction') {
                    return (
                      <TimelineItem
                        key={`interaction-${event.data.id}`}
                        interaction={event.data}
                        isExpanded={expandedId === event.data.id}
                        onToggle={() =>
                          setExpandedId((prev) => (prev === event.data.id ? null : event.data.id))
                        }
                      />
                    )
                  }

                  // Stage transition — simple, non-expandable
                  const tr = event.data
                  return (
                    <li
                      key={`transition-${tr.id}`}
                      className="flex items-center gap-3 px-1 py-1 text-xs text-muted-foreground/70"
                    >
                      <span className="size-3 shrink-0" />
                      {/* aligns with ChevronRight in TimelineItem */}
                      <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
                      <span>
                        <span className="mr-2">
                          {new Date(tr.transitionedAt).toLocaleDateString()}
                        </span>
                        {tr.fromStageName ?? t('prospects.initialStage')}
                        {' → '}
                        {tr.toStageName}
                      </span>
                    </li>
                  )
                })}
              </ul>
              {!showAll && hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="size-3" />
                  {t('prospects.timeline.showAll', { count: hiddenCount })}
                </button>
              )}
            </>
          )
        })()
      )}
    </div>
  )
}
