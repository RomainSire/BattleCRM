import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Accordion } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { useProspects } from '../hooks/useProspects'
import { ProspectRow } from './ProspectRow'

export function ProspectsList() {
  const { t } = useTranslation()
  const [activeStageFilter, setActiveStageFilter] = useState<string | undefined>(undefined)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const activeFilters = {
    ...(activeStageFilter ? { funnel_stage_id: activeStageFilter } : {}),
    ...(showArchived ? { include_archived: true as const } : {}),
  }

  const {
    data: prospectsData,
    isLoading: prospectsLoading,
    isError: prospectsError,
  } = useProspects(Object.keys(activeFilters).length > 0 ? activeFilters : undefined)

  const { data: stagesData, isLoading: stagesLoading, isError: stagesError } = useFunnelStages()

  const isLoading = prospectsLoading || stagesLoading
  const stages = stagesData?.data ?? []
  const prospects = prospectsData?.data ?? []

  // Client-side name filter
  const filteredProspects = searchQuery.trim()
    ? prospects.filter((p) => p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : prospects

  // O(1) lookup map: funnelStageId -> stage name
  const stageMap = new Map(stages.map((s) => [s.id, s.name]))

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
      {/* Toolbar: two rows */}
      <div className="space-y-2">
        {/* Row 1: Search + Show archived switch */}
        <div className="flex items-center gap-4">
          <Input
            type="search"
            placeholder={t('prospects.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-56 text-sm"
            aria-label={t('prospects.searchPlaceholder')}
          />
          <div className="flex items-center gap-2">
            <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="show-archived" className="cursor-pointer text-sm">
              {t('prospects.showArchived')}
            </Label>
          </div>
        </div>

        {/* Row 2: Funnel stage filters + clear */}
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
                {t('prospects.clearFilter')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {filteredProspects.length === 0 ? (
        <div className="rounded-md border py-12 text-center">
          <p className="text-muted-foreground">
            {searchQuery.trim()
              ? t('prospects.emptySearch')
              : activeStageFilter
                ? t('prospects.emptyFiltered')
                : t('prospects.empty')}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          {/* Column header row */}
          <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{t('prospects.columns.name')}</span>
            <span className="w-40 shrink-0">{t('prospects.columns.company')}</span>
            <span className="w-40 shrink-0">{t('prospects.columns.stage')}</span>
            <span className="w-48 shrink-0">{t('prospects.columns.email')}</span>
          </div>

          <Accordion
            type="single"
            collapsible
            value={expandedId ?? ''}
            onValueChange={(v) => setExpandedId(v || null)}
          >
            {filteredProspects.map((prospect) => (
              <ProspectRow
                key={prospect.id}
                prospect={prospect}
                stageName={stageMap.get(prospect.funnelStageId)}
              />
            ))}
          </Accordion>
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
