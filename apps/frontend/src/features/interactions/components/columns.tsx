import type { InteractionType } from '@battlecrm/shared'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import type { TFunction } from 'i18next'
import { Badge } from '@/components/ui/badge'
import { SortableHeader } from '@/components/ui/data-table'
import { formatDate, getTimestamp, toLocalDateInput } from '@/lib/dates'

const dateRangeFilter: FilterFn<InteractionType> = (row, _columnId, filterValue: unknown) => {
  const [from, to] = filterValue as [string, string]
  if (!from && !to) return true
  const dateStr = toLocalDateInput(row.original.interactionDate)
  if (from && dateStr < from) return false
  if (to && dateStr > to) return false
  return true
}
dateRangeFilter.autoRemove = (val: unknown) => {
  const [from, to] = (val ?? ['', '']) as [string, string]
  return !from && !to
}

export function getInteractionsColumns(t: TFunction): ColumnDef<InteractionType>[] {
  return [
    {
      accessorKey: 'interactionDate',
      header: ({ column }) => (
        <SortableHeader column={column} label={t('interactions.detail.date')} />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.interactionDate)}
        </span>
      ),
      sortingFn: (rowA, rowB) =>
        getTimestamp(rowA.original.interactionDate) - getTimestamp(rowB.original.interactionDate),
      filterFn: dateRangeFilter,
      enableGlobalFilter: false,
    },
    {
      accessorKey: 'prospectName',
      header: ({ column }) => (
        <SortableHeader column={column} label={t('interactions.fields.prospect')} />
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.prospectName}</span>,
      filterFn: 'equalsString',
      enableGlobalFilter: true,
    },
    {
      accessorKey: 'prospectFunnelStageName',
      header: ({ column }) => (
        <SortableHeader column={column} label={t('prospects.columns.stage')} />
      ),
      cell: ({ row }) => <Badge variant="outline">{row.original.prospectFunnelStageName}</Badge>,
      filterFn: 'equalsString',
      enableGlobalFilter: false,
    },
    {
      id: 'positioningName',
      accessorFn: (row) => row.positioningName ?? '',
      header: ({ column }) => (
        <SortableHeader column={column} label={t('interactions.fields.positioning')} />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.positioningName ?? '—'}</span>
      ),
      filterFn: 'equalsString',
      enableGlobalFilter: false,
    },
    {
      accessorKey: 'notes',
      header: t('interactions.fields.notes') as string,
      cell: ({ row }) => {
        const notes = row.original.notes
        const preview = notes && notes.length > 80 ? `${notes.slice(0, 80)}…` : (notes ?? '—')
        return <span className="text-sm text-muted-foreground">{preview}</span>
      },
      enableSorting: false,
      enableGlobalFilter: true,
    },
  ]
}
