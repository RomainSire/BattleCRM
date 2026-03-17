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

  // Server-side filters (sent to backend)
  const [filters, setFilters] = useState<InteractionsFilterType>({})
  // Client-side date range (applied after fetch)
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  // Expand state — only one row open at a time
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading, isError } = useInteractions(
    Object.keys(filters).length > 0 ? filters : undefined,
  )
  const { data: stagesData } = useFunnelStages()
  const { data: prospectsData } = useProspects()
  const { data: positioningsData } = usePositionings()

  const stages = stagesData?.data ?? []
  const prospects = prospectsData?.data ?? []
  const positionings = positioningsData?.data ?? []

  // Client-side date range filter applied after fetch
  const allInteractions = data?.data ?? []
  const filtered = allInteractions.filter((i) => {
    const d = new Date(i.interactionDate)
    if (dateFrom && d < new Date(dateFrom)) return false
    if (dateTo && d > new Date(dateTo)) return false
    return true
  })

  const hasActiveFilters = Object.keys(filters).length > 0 || dateFrom !== '' || dateTo !== ''

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
    setDateFrom('')
    setDateTo('')
    setExpandedId(null)
  }

  if (isError) {
    return <p className="text-sm text-destructive">{t('interactions.loadError')}</p>
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Status */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-status" className="text-xs text-muted-foreground">
            {t('interactions.fields.status')}
          </Label>
          <Select value={filters.status ?? 'all'} onValueChange={handleStatusFilter}>
            <SelectTrigger id="filter-status" className="h-8 w-36 text-sm">
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

        {/* Prospect */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-prospect" className="text-xs text-muted-foreground">
            {t('interactions.fields.prospect')}
          </Label>
          <Select value={filters.prospect_id ?? 'all'} onValueChange={handleProspectFilter}>
            <SelectTrigger id="filter-prospect" className="h-8 w-44 text-sm">
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

        {/* Positioning */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-positioning" className="text-xs text-muted-foreground">
            {t('interactions.fields.positioning')}
          </Label>
          <Select value={filters.positioning_id ?? 'all'} onValueChange={handlePositioningFilter}>
            <SelectTrigger id="filter-positioning" className="h-8 w-44 text-sm">
              <SelectValue />
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
        </div>

        {/* Funnel Stage */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-stage" className="text-xs text-muted-foreground">
            {t('prospects.columns.stage')}
          </Label>
          <Select value={filters.funnel_stage_id ?? 'all'} onValueChange={handleStageFilter}>
            <SelectTrigger id="filter-stage" className="h-8 w-36 text-sm">
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

        {/* Date range (client-side) */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-date-from" className="text-xs text-muted-foreground">
            {t('interactions.filters.dateFrom')}
          </Label>
          <input
            id="filter-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setExpandedId(null)
            }}
            className="h-8 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-date-to" className="text-xs text-muted-foreground">
            {t('interactions.filters.dateTo')}
          </Label>
          <input
            id="filter-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setExpandedId(null)
            }}
            className="h-8 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={clearAllFilters}
            className="h-8 self-end"
          >
            {t('interactions.filters.clearFilters')}
          </Button>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="rounded-md border">
          <Table>
            <TableBody>
              {['s0', 's1', 's2', 's3', 's4'].map((key) => (
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="rounded-md border py-12 text-center">
          <p className="text-muted-foreground">{t('interactions.empty')}</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && filtered.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 pr-0" />
                <TableHead>{t('interactions.detail.date')}</TableHead>
                <TableHead>{t('interactions.fields.prospect')}</TableHead>
                <TableHead>{t('prospects.columns.stage')}</TableHead>
                <TableHead>{t('interactions.fields.status')}</TableHead>
                <TableHead>{t('interactions.fields.notes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((interaction) => (
                <InteractionRow
                  key={interaction.id}
                  interaction={interaction}
                  isExpanded={expandedId === interaction.id}
                  onToggle={() => toggleExpanded(interaction.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && !isLoading && (
        <p className="text-right text-xs text-muted-foreground">
          {filtered.length} / {data.meta.total}
        </p>
      )}
    </div>
  )
}
