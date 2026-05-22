import type { PositioningType } from '@battlecrm/shared'
import type { Table } from '@tanstack/react-table'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { FilterCombobox } from '@/components/ui/filter-combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface PositioningsTableToolbarProps {
  table: Table<PositioningType>
  showArchived: boolean
  onShowArchivedChange: (value: boolean) => void
}

export function PositioningsTableToolbar({
  table,
  showArchived,
  onShowArchivedChange,
}: PositioningsTableToolbarProps) {
  const { t } = useTranslation()

  const stageColumn = table.getColumn('funnelStageName')
  const stageFilterValue = stageColumn?.getFilterValue() as string | undefined
  const stageOptions = Array.from(stageColumn?.getFacetedUniqueValues()?.keys() ?? []).sort()

  const hasActiveFilters =
    (table.getState().globalFilter ?? '') !== '' ||
    table.getState().columnFilters.length > 0 ||
    showArchived

  function clearFilters() {
    table.setGlobalFilter('')
    table.resetColumnFilters()
    onShowArchivedChange(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder={t('positionings.filters.search')}
        value={table.getState().globalFilter ?? ''}
        onChange={(e) => table.setGlobalFilter(e.target.value)}
        className="h-8 w-full max-w-xs"
      />

      <FilterCombobox
        options={stageOptions}
        value={stageFilterValue}
        onChange={(val) => stageColumn?.setFilterValue(val)}
        placeholder={t('positionings.filters.allStages')}
        emptyLabel={t('table.noResults')}
      />

      <div className="flex items-center gap-2">
        <Switch
          id="show-archived-positionings"
          checked={showArchived}
          onCheckedChange={onShowArchivedChange}
        />
        <Label htmlFor="show-archived-positionings" className="cursor-pointer text-sm">
          {t('positionings.showArchived')}
        </Label>
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
          {t('positionings.clearFilters')}
        </Button>
      )}
    </div>
  )
}
