import type { InteractionType } from '@battlecrm/shared'
import type { Table } from '@tanstack/react-table'
import { X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { FilterCombobox } from '@/components/ui/filter-combobox'
import { Input } from '@/components/ui/input'

interface InteractionsTableToolbarProps {
  table: Table<InteractionType>
}

export function InteractionsTableToolbar({ table }: InteractionsTableToolbarProps) {
  const { t } = useTranslation()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const dateColumn = table.getColumn('interactionDate')
  const stageColumn = table.getColumn('prospectFunnelStageName')
  const positioningColumn = table.getColumn('positioningName')

  const stageFilterValue = stageColumn?.getFilterValue() as string | undefined
  const positioningFilterValue = positioningColumn?.getFilterValue() as string | undefined

  const stageOptions = Array.from(stageColumn?.getFacetedUniqueValues()?.keys() ?? [])
    .filter(Boolean)
    .sort()
  const positioningOptions = Array.from(positioningColumn?.getFacetedUniqueValues()?.keys() ?? [])
    .filter(Boolean)
    .sort()

  const hasActiveFilters =
    (table.getState().globalFilter ?? '') !== '' ||
    table.getState().columnFilters.length > 0 ||
    dateFrom !== '' ||
    dateTo !== ''

  function handleDateFrom(value: string) {
    setDateFrom(value)
    dateColumn?.setFilterValue(value || dateTo ? [value, dateTo] : undefined)
  }

  function handleDateTo(value: string) {
    setDateTo(value)
    dateColumn?.setFilterValue(dateFrom || value ? [dateFrom, value] : undefined)
  }

  function clearFilters() {
    setDateFrom('')
    setDateTo('')
    table.setGlobalFilter('')
    table.resetColumnFilters()
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder={t('interactions.filters.search')}
        value={table.getState().globalFilter ?? ''}
        onChange={(e) => table.setGlobalFilter(e.target.value)}
        className="h-8 w-full max-w-xs"
      />

      <FilterCombobox
        options={stageOptions}
        value={stageFilterValue}
        onChange={(val) => stageColumn?.setFilterValue(val)}
        placeholder={t('interactions.filters.allStages')}
        emptyLabel={t('table.noResults')}
      />

      <FilterCombobox
        options={positioningOptions}
        value={positioningFilterValue}
        onChange={(val) => positioningColumn?.setFilterValue(val)}
        placeholder={t('interactions.filters.allPositionings')}
        emptyLabel={t('table.noResults')}
      />

      <div className="flex items-center gap-1">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => handleDateFrom(e.target.value)}
          className="h-8 w-[112px] rounded-md border border-input bg-background px-2 text-sm"
          aria-label={t('interactions.filters.dateFrom')}
        />
        <span className="text-xs text-muted-foreground">→</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => handleDateTo(e.target.value)}
          className="h-8 w-[112px] rounded-md border border-input bg-background px-2 text-sm"
          aria-label={t('interactions.filters.dateTo')}
        />
      </div>

      {hasActiveFilters && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={clearFilters}
          className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <X />
          {t('interactions.filters.clearFilters')}
        </Button>
      )}
    </div>
  )
}
