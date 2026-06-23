import type { ProspectType } from '@battlecrm/shared'
import type { ColumnDef } from '@tanstack/react-table'
import type { TFunction } from 'i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SortableHeader } from '@/components/ui/data-table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AddInteractionDialog } from '@/features/interactions/components/AddInteractionDialog'
import { cn } from '@/lib/utils'
import { daysSince, RECENCY_TEXT_COLORS, recencyLevel } from '../lib/recency'

export function getProspectsColumns(
  t: TFunction,
  stageMap: Map<string, string>,
): ColumnDef<ProspectType>[] {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <SortableHeader column={column} label={t('prospects.columns.name')} />
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
      accessorKey: 'company',
      header: ({ column }) => (
        <SortableHeader column={column} label={t('prospects.columns.company')} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.company ?? '—'}</span>
      ),
      enableGlobalFilter: true,
    },
    {
      id: 'stage',
      accessorFn: (row) => stageMap.get(row.funnelStageId) ?? '',
      header: ({ column }) => (
        <SortableHeader column={column} label={t('prospects.columns.stage')} />
      ),
      cell: ({ row }) => {
        const isArchived = row.original.deletedAt !== null
        if (isArchived) {
          return (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {t('prospects.archived')}
            </span>
          )
        }
        return <span>{stageMap.get(row.original.funnelStageId) ?? '—'}</span>
      },
      filterFn: 'equalsString',
      enableGlobalFilter: false,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <SortableHeader column={column} label={t('prospects.columns.email')} />
      ),
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.email ?? '—'}</span>,
      enableGlobalFilter: true,
    },
    {
      accessorKey: 'neededRole',
      header: ({ column }) => (
        <SortableHeader column={column} label={t('prospects.columns.neededRole')} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.neededRole ?? '—'}</span>
      ),
      enableGlobalFilter: true,
    },
    {
      id: 'lastInteraction',
      accessorFn: (row) => daysSince(row.lastInteractionAt),
      header: ({ column }) => (
        <SortableHeader column={column} label={t('prospects.columns.lastInteraction')} />
      ),
      cell: ({ row }) => {
        const days = daysSince(row.original.lastInteractionAt)
        const level = recencyLevel(days)
        if (days === null) {
          return (
            <span className="font-semibold text-muted-foreground">
              {t('prospects.lastInteraction.never')}
            </span>
          )
        }
        return (
          <span className={cn('font-semibold', RECENCY_TEXT_COLORS[level])}>
            {t('prospects.lastInteraction.daysAgo', { count: days })}
          </span>
        )
      },
      // Treat "never" (null) as the smallest value so that, sorted descending,
      // the oldest interactions float to the top and "Jamais" sinks to the bottom.
      sortingFn: (a, b) => {
        const daysA = daysSince(a.original.lastInteractionAt) ?? -1
        const daysB = daysSince(b.original.lastInteractionAt) ?? -1
        return daysA - daysB
      },
      enableGlobalFilter: false,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const isArchived = row.original.deletedAt !== null
        if (isArchived) return null
        return (
          <TooltipProvider>
            <Tooltip>
              <AddInteractionDialog
                initialProspectId={row.original.id}
                trigger={
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label={t('interactions.addInteraction')}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                }
              />
              <TooltipContent>{t('interactions.addInteraction')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
      enableSorting: false,
      enableGlobalFilter: false,
    },
  ]
}
