import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

  const filteredProspects = searchQuery.trim()
    ? prospects.filter((p) => p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : prospects

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

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
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
      {/* Toolbar */}
      <div className="space-y-2">
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 pr-0" />
                <TableHead>{t('prospects.columns.name')}</TableHead>
                <TableHead>{t('prospects.columns.company')}</TableHead>
                <TableHead>{t('prospects.columns.stage')}</TableHead>
                <TableHead>{t('prospects.columns.email')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProspects.map((prospect) => (
                <ProspectRow
                  key={prospect.id}
                  prospect={prospect}
                  stageName={stageMap.get(prospect.funnelStageId)}
                  isExpanded={expandedId === prospect.id}
                  onToggle={() => toggleExpanded(prospect.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {prospectsData && (
        <p className="text-right text-xs text-muted-foreground">
          {t('prospects.count', { count: prospectsData.meta.total })}
        </p>
      )}
    </div>
  )
}
