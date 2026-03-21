import type { InteractionStatus, InteractionsFilterType } from '@battlecrm/shared'
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
import { usePositionings } from '@/features/positionings/hooks/usePositionings'
import { useProspects } from '@/features/prospects/hooks/useProspects'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { useInteractions } from '../hooks/useInteractions'
import { InteractionRow } from './InteractionRow'

export function InteractionsList() {
  const { t } = useTranslation()

  const [filters, setFilters] = useState<InteractionsFilterType>({})
  const [showArchived, setShowArchived] = useState(false)
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const activeFilters: InteractionsFilterType = {
    ...filters,
    ...(showArchived && { include_archived: true }),
  }
  const { data, isLoading, isError } = useInteractions(
    Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
  )
  const { data: stagesData } = useFunnelStages()
  const { data: prospectsData } = useProspects()
  const { data: positioningsData } = usePositionings()

  const stages = stagesData?.data ?? []
  const prospects = prospectsData?.data ?? []
  const positionings = positioningsData?.data ?? []

  const allInteractions = data?.data ?? []
  const filtered = allInteractions.filter((i) => {
    // Compare date strings directly (YYYY-MM-DD) to avoid UTC/local timezone ambiguity
    const dateStr = i.interactionDate.slice(0, 10)
    if (dateFrom && dateStr < dateFrom) return false
    if (dateTo && dateStr > dateTo) return false
    return true
  })

  const hasActiveFilters =
    Object.keys(filters).length > 0 || dateFrom !== '' || dateTo !== '' || showArchived

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function handleStatusFilter(value: string) {
    if (value === 'all') {
      const { status: _s, ...rest } = filters
      setFilters(rest)
    } else {
      setFilters((prev) => ({ ...prev, status: value as InteractionStatus }))
    }
    setExpandedId(null)
  }

  function handleProspectFilter(value: string) {
    if (value === 'all') {
      const { prospect_id: _p, ...rest } = filters
      setFilters(rest)
    } else {
      setFilters((prev) => ({ ...prev, prospect_id: value }))
    }
    setExpandedId(null)
  }

  function handlePositioningFilter(value: string) {
    if (value === 'all') {
      const { positioning_id: _p, ...rest } = filters
      setFilters(rest)
    } else {
      setFilters((prev) => ({ ...prev, positioning_id: value }))
    }
    setExpandedId(null)
  }

  function handleStageFilter(value: string) {
    if (value === 'all') {
      const { funnel_stage_id: _s, ...rest } = filters
      setFilters(rest)
    } else {
      setFilters((prev) => ({ ...prev, funnel_stage_id: value }))
    }
    setExpandedId(null)
  }

  function clearAllFilters() {
    setFilters({})
    setShowArchived(false)
    setDateFrom('')
    setDateTo('')
    setExpandedId(null)
  }

  if (isError) {
    return <p className="text-sm text-destructive">{t('interactions.loadError')}</p>
  }

  // Shared style for compact header selects
  const headerSelectTrigger =
    'h-7 w-full border-input/60 bg-background/60 px-2 text-xs shadow-none focus:ring-0'

  return (
    <div className="space-y-3">
      {/* Slim top bar: Show Archived + Positioning filter + Clear */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="show-archived-interactions"
            checked={showArchived}
            onCheckedChange={(checked) => {
              setShowArchived(checked)
              setExpandedId(null)
            }}
          />
          <Label htmlFor="show-archived-interactions" className="cursor-pointer text-sm">
            {t('interactions.showArchived')}
          </Label>
        </div>

        {/* Positioning — secondary filter, no dedicated column */}
        <Select value={filters.positioning_id ?? 'all'} onValueChange={handlePositioningFilter}>
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue placeholder={t('interactions.filters.allPositionings')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('interactions.filters.allPositionings')}</SelectItem>
            {positionings.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={clearAllFilters}
            className="h-8"
          >
            {t('interactions.filters.clearFilters')}
          </Button>
        )}
      </div>

      {/* Table — always rendered, skeleton during loading */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent align-top">
              <TableHead className="w-8 pr-0" />

              {/* Date + date range filter */}
              <TableHead className="min-w-[210px]">
                <div className="flex flex-col gap-1 py-0.5">
                  <span className="text-xs font-medium">{t('interactions.detail.date')}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value)
                        setExpandedId(null)
                      }}
                      className="h-7 w-[96px] rounded-md border border-input/60 bg-background/60 px-2 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value)
                        setExpandedId(null)
                      }}
                      className="h-7 w-[96px] rounded-md border border-input/60 bg-background/60 px-2 text-xs"
                    />
                  </div>
                </div>
              </TableHead>

              {/* Prospect filter */}
              <TableHead>
                <div className="flex flex-col gap-1 py-0.5">
                  <span className="text-xs font-medium">{t('interactions.fields.prospect')}</span>
                  <Select value={filters.prospect_id ?? 'all'} onValueChange={handleProspectFilter}>
                    <SelectTrigger className={headerSelectTrigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('interactions.filters.allProspects')}</SelectItem>
                      {prospects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TableHead>

              {/* Stage filter */}
              <TableHead>
                <div className="flex flex-col gap-1 py-0.5">
                  <span className="text-xs font-medium">{t('prospects.columns.stage')}</span>
                  <Select
                    value={filters.funnel_stage_id ?? 'all'}
                    onValueChange={handleStageFilter}
                  >
                    <SelectTrigger className={headerSelectTrigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('interactions.filters.allStages')}</SelectItem>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TableHead>

              {/* Status filter */}
              <TableHead className="w-28">
                <div className="flex flex-col gap-1 py-0.5">
                  <span className="text-xs font-medium">{t('interactions.fields.status')}</span>
                  <Select value={filters.status ?? 'all'} onValueChange={handleStatusFilter}>
                    <SelectTrigger className={headerSelectTrigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('interactions.filters.allStatuses')}</SelectItem>
                      <SelectItem value="positive">{t('interactions.status.positive')}</SelectItem>
                      <SelectItem value="pending">{t('interactions.status.pending')}</SelectItem>
                      <SelectItem value="negative">{t('interactions.status.negative')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TableHead>

              <TableHead>{t('interactions.fields.notes')}</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              ['s0', 's1', 's2', 's3', 's4'].map((key) => (
                <TableRow key={key}>
                  <TableCell>
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  {t('interactions.empty')}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((interaction) => (
                <InteractionRow
                  key={interaction.id}
                  interaction={interaction}
                  isExpanded={expandedId === interaction.id}
                  onToggle={() => toggleExpanded(interaction.id)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && !isLoading && (
        <p className="text-right text-xs text-muted-foreground">
          {filtered.length} / {data.meta.total}
        </p>
      )}
    </div>
  )
}
