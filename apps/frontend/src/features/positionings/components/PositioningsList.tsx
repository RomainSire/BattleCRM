import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
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
import { usePositionings } from '../hooks/usePositionings'
import { PositioningRow } from './PositioningRow'

export function PositioningsList() {
  const { t } = useTranslation()
  const [activeStageFilter, setActiveStageFilter] = useState<string | undefined>(undefined)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const activeFilters = {
    ...(activeStageFilter ? { funnel_stage_id: activeStageFilter } : {}),
    ...(showArchived ? { include_archived: true as const } : {}),
  }

  const {
    data: positioningsData,
    isLoading: positioningsLoading,
    isError: positioningsError,
  } = usePositionings(Object.keys(activeFilters).length > 0 ? activeFilters : undefined)

  const { data: stagesData, isLoading: stagesLoading, isError: stagesError } = useFunnelStages()

  const isLoading = positioningsLoading || stagesLoading
  const stages = stagesData?.data ?? []
  const positionings = positioningsData?.data ?? []

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

  if (positioningsError || stagesError) {
    return <p className="text-sm text-destructive">{t('positionings.loadError')}</p>
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="show-archived-positionings"
            checked={showArchived}
            onCheckedChange={(checked) => {
              setShowArchived(checked)
              setExpandedId(null)
            }}
          />
          <Label htmlFor="show-archived-positionings" className="cursor-pointer text-sm">
            {t('positionings.showArchived')}
          </Label>
        </div>
        {hasActiveFilters && (
          <Button type="button" size="sm" variant="outline" onClick={clearFilters} className="h-8">
            {t('positionings.clearFilter')}
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent align-top">
              <TableHead className="w-8 pr-0" />
              <TableHead>{t('positionings.columns.name')}</TableHead>
              <TableHead className="w-40">
                <div className="flex flex-col gap-1 py-0.5">
                  <span className="text-xs font-medium">{t('positionings.columns.stage')}</span>
                  <Select value={activeStageFilter ?? 'all'} onValueChange={handleStageFilter}>
                    <SelectTrigger className={headerSelectTrigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('positionings.filters.allStages')}</SelectItem>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TableHead>
              <TableHead className="w-64">{t('positionings.columns.description')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positionings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                  {activeStageFilter ? t('positionings.emptyFiltered') : t('positionings.empty')}
                </TableCell>
              </TableRow>
            ) : (
              positionings.map((positioning) => (
                <PositioningRow
                  key={positioning.id}
                  positioning={positioning}
                  isExpanded={expandedId === positioning.id}
                  onToggle={() => toggleExpanded(positioning.id)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {positioningsData && (
        <p className="text-right text-xs text-muted-foreground">
          {t('positionings.count', { count: positioningsData.meta.total })}
        </p>
      )}
    </div>
  )
}
