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
import { Switch } from '@/components/ui/switch'
import type { PositioningType } from '@battlecrm/shared'
import type { Table } from '@tanstack/react-table'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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

      <Select
        value={stageFilterValue ?? 'all'}
        onValueChange={(value) => stageColumn?.setFilterValue(value === 'all' ? undefined : value)}
      >
        <SelectTrigger className="h-8 w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('positionings.filters.allStages')}</SelectItem>
          {stageOptions.map((stage) => (
            <SelectItem key={stage} value={stage}>
              {stage}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
        <Button type="button" size="sm" variant="ghost" onClick={clearFilters} className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10">
          <X />
          {t('positionings.clearFilters')}
        </Button>
      )}
    </div>
  )
}
