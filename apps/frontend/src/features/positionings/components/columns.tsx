import type { PositioningType } from '@battlecrm/shared'
import type { ColumnDef } from '@tanstack/react-table'
import type { TFunction } from 'i18next'
import { Badge } from '@/components/ui/badge'
import { SortableHeader } from '@/components/ui/data-table'
import { formatDate, getTimestamp } from '@/lib/dates'
import { cn } from '@/lib/utils'

export function getPositioningsColumns(t: TFunction): ColumnDef<PositioningType>[] {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <SortableHeader column={column} label={t('positionings.columns.name')} />
      ),
      cell: ({ row }) => {
        const isArchived = row.original.deletedAt !== null
        return (
          <span className={cn('font-medium', isArchived && 'text-muted-foreground line-through')}>
            {row.original.name}
          </span>
        )
      },
      enableGlobalFilter: true,
    },
    {
      accessorKey: 'funnelStageName',
      header: ({ column }) => (
        <SortableHeader column={column} label={t('positionings.columns.stage')} />
      ),
      cell: ({ row }) => {
        const isArchived = row.original.deletedAt !== null
        return isArchived ? (
          <Badge variant="outline" className="text-muted-foreground">
            {t('positionings.archivedBadge')}
          </Badge>
        ) : (
          <Badge variant="secondary">{row.original.funnelStageName}</Badge>
        )
      },
      filterFn: 'equalsString',
      enableGlobalFilter: false,
    },
    {
      accessorKey: 'description',
      header: t('positionings.columns.description') as string,
      cell: ({ row }) => (
        <span className="block max-w-64 truncate text-sm text-muted-foreground">
          {row.original.description ?? '—'}
        </span>
      ),
      enableSorting: false,
      enableGlobalFilter: true,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <SortableHeader column={column} label={t('positionings.columns.createdAt')} />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
      sortingFn: (rowA, rowB) =>
        getTimestamp(rowA.original.createdAt) - getTimestamp(rowB.original.createdAt),
      enableGlobalFilter: false,
    },
  ]
}
