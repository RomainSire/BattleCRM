import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Accordion } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { usePositionings } from '../hooks/usePositionings'
import { PositioningRow } from './PositioningRow'

export function PositioningsList() {
  const { t } = useTranslation()
  const [activeStageFilter, setActiveStageFilter] = useState<string | undefined>(undefined)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const activeFilters = activeStageFilter ? { funnel_stage_id: activeStageFilter } : undefined

  const {
    data: positioningsData,
    isLoading: positioningsLoading,
    isError: positioningsError,
  } = usePositionings(activeFilters)

  const { data: stagesData, isLoading: stagesLoading, isError: stagesError } = useFunnelStages()

  const isLoading = positioningsLoading || stagesLoading
  const stages = stagesData?.data ?? []
  const positionings = positioningsData?.data ?? []

  function handleStageFilter(stageId: string) {
    if (activeStageFilter === stageId) {
      setActiveStageFilter(undefined)
      setExpandedId(null)
      return
    }
    setActiveStageFilter(stageId)
    setExpandedId(null)
  }

  function clearFilter() {
    setActiveStageFilter(undefined)
    setExpandedId(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {['s0', 's1', 's2', 's3', 's4'].map((key) => (
          <Skeleton key={key} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (positioningsError || stagesError) {
    return <p className="text-sm text-destructive">{t('positionings.loadError')}</p>
  }

  return (
    <div className="space-y-4">
      {/* Stage filter pills */}
      {stages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {stages.map((stage) => (
            <Button
              key={stage.id}
              type="button"
              size="sm"
              variant={activeStageFilter === stage.id ? 'default' : 'outline'}
              onClick={() => handleStageFilter(stage.id)}
              aria-pressed={activeStageFilter === stage.id}
              className="rounded-full"
            >
              {stage.name}
            </Button>
          ))}
          {activeStageFilter && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={clearFilter}
              className="rounded-full border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {t('positionings.clearFilter')}
            </Button>
          )}
        </div>
      )}

      {/* Empty state */}
      {positionings.length === 0 ? (
        <div className="rounded-md border py-12 text-center">
          <p className="text-muted-foreground">
            {activeStageFilter ? t('positionings.emptyFiltered') : t('positionings.empty')}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          {/* Column header row */}
          <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{t('positionings.columns.name')}</span>
            <span className="w-40 shrink-0">{t('positionings.columns.stage')}</span>
            <span className="w-64 shrink-0">{t('positionings.columns.description')}</span>
          </div>

          <Accordion
            type="single"
            collapsible
            value={expandedId ?? ''}
            onValueChange={(v) => setExpandedId(v || null)}
          >
            {positionings.map((positioning) => (
              <PositioningRow key={positioning.id} positioning={positioning} />
            ))}
          </Accordion>
        </div>
      )}

      {/* Total count */}
      {positioningsData && (
        <p className="text-right text-xs text-muted-foreground">
          {t('positionings.count', { count: positioningsData.meta.total })}
        </p>
      )}
    </div>
  )
}
