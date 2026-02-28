import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { useProspects } from '../hooks/useProspects'
import { ProspectRow } from './ProspectRow'

export function ProspectsList() {
  const { t } = useTranslation()
  const [activeStageFilter, setActiveStageFilter] = useState<string | undefined>(undefined)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const {
    data: prospectsData,
    isLoading: prospectsLoading,
    isError: prospectsError,
  } = useProspects(activeStageFilter ? { funnel_stage_id: activeStageFilter } : undefined)

  const { data: stagesData, isLoading: stagesLoading, isError: stagesError } = useFunnelStages()

  const isLoading = prospectsLoading || stagesLoading
  const stages = stagesData?.data ?? []
  const prospects = prospectsData?.data ?? []

  // O(1) lookup map: funnelStageId -> stage name
  const stageMap = new Map(stages.map((s) => [s.id, s.name]))

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function handleStageFilter(stageId: string) {
    if (activeStageFilter === stageId) {
      clearFilter()
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

  if (prospectsError || stagesError) {
    return <p className="text-sm text-destructive">{t('prospects.loadError')}</p>
  }

  return (
    <div className="space-y-4">
      {/* Funnel stage filter buttons */}
      {stages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {stages.map((stage) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => handleStageFilter(stage.id)}
              aria-pressed={activeStageFilter === stage.id}
              className={
                activeStageFilter === stage.id
                  ? 'rounded-full border border-primary bg-primary px-3 py-1 text-sm font-medium text-primary-foreground'
                  : 'rounded-full border px-3 py-1 text-sm hover:bg-accent'
              }
            >
              {stage.name}
            </button>
          ))}
          {activeStageFilter && (
            <button
              type="button"
              onClick={clearFilter}
              className="rounded-full border border-destructive px-3 py-1 text-sm text-destructive hover:bg-destructive/10"
            >
              {t('prospects.clearFilter')}
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {prospects.length === 0 ? (
        <div className="rounded-md border py-12 text-center">
          <p className="text-muted-foreground">
            {activeStageFilter ? t('prospects.emptyFiltered') : t('prospects.empty')}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          {/* Column header row */}
          <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{t('prospects.columns.name')}</span>
            <span className="w-40 shrink-0">{t('prospects.columns.company')}</span>
            <span className="w-40 shrink-0">{t('prospects.columns.stage')}</span>
            <span className="w-48 shrink-0">{t('prospects.columns.email')}</span>
          </div>

          {prospects.map((prospect) => (
            <ProspectRow
              key={prospect.id}
              prospect={prospect}
              stageName={stageMap.get(prospect.funnelStageId)}
              isExpanded={expandedId === prospect.id}
              onToggle={() => handleToggle(prospect.id)}
            />
          ))}
        </div>
      )}

      {/* Total count */}
      {prospectsData && (
        <p className="text-right text-xs text-muted-foreground">
          {t('prospects.count', { count: prospectsData.meta.total })}
        </p>
      )}
    </div>
  )
}
