import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

  const hasActiveFilters = !!activeStageFilter || showArchived

  const headerSelectTrigger =
    'h-7 w-full border-input/60 bg-background/60 px-2 text-xs shadow-none focus:ring-0'

  function handleStageFilter(value: string) {
    if (value === 'all') {
      setActiveStageFilter(undefined)
    } else {
      setActiveStageFilter(value)
    }
    setExpandedId(null)
  }

  function clearFilters() {
    setActiveStageFilter(undefined)
    setShowArchived(false)
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
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder={t('prospects.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 w-56 text-sm"
          aria-label={t('prospects.searchPlaceholder')}
        />
        <div className="flex items-center gap-2">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={(checked) => {
              setShowArchived(checked)
              setExpandedId(null)
            }}
          />
          <Label htmlFor="show-archived" className="cursor-pointer text-sm">
            {t('prospects.showArchived')}
          </Label>
        </div>
        {hasActiveFilters && (
          <Button type="button" size="sm" variant="outline" onClick={clearFilters} className="h-8">
            {t('prospects.clearFilter')}
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent align-top">
              <TableHead className="w-8 pr-0" />
              <TableHead>{t('prospects.columns.name')}</TableHead>
              <TableHead>{t('prospects.columns.company')}</TableHead>
              <TableHead>
                <div className="flex flex-col gap-1 py-0.5">
                  <span className="text-xs font-medium">{t('prospects.columns.stage')}</span>
                  <Select value={activeStageFilter ?? 'all'} onValueChange={handleStageFilter}>
                    <SelectTrigger className={headerSelectTrigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('prospects.filters.allStages')}</SelectItem>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TableHead>
              <TableHead>{t('prospects.columns.email')}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProspects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  {searchQuery.trim()
                    ? t('prospects.emptySearch')
                    : activeStageFilter
                      ? t('prospects.emptyFiltered')
                      : t('prospects.empty')}
                </TableCell>
              </TableRow>
            ) : (
              filteredProspects.map((prospect) => (
                <ProspectRow
                  key={prospect.id}
                  prospect={prospect}
                  stageName={stageMap.get(prospect.funnelStageId)}
                  isExpanded={expandedId === prospect.id}
                  onToggle={() => toggleExpanded(prospect.id)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {prospectsData && (
        <p className="text-right text-xs text-muted-foreground">
          {t('prospects.count', { count: prospectsData.meta.total })}
        </p>
      )}
    </div>
  )
}
