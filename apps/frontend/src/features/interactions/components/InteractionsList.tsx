import type { InteractionType } from '@battlecrm/shared'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/ui/data-table'
import { Skeleton } from '@/components/ui/skeleton'
import { useInteractions } from '../hooks/useInteractions'
import { getInteractionsColumns } from './columns'
import { InteractionsTableToolbar } from './InteractionsTableToolbar'

interface Props {
  onOpenDetail: (interaction: InteractionType) => void
}

export function InteractionsList({ onOpenDetail }: Props) {
  const { t } = useTranslation()

  const { data, isLoading, isError } = useInteractions()

  const interactions = data?.data ?? []
  const columns = useMemo(() => getInteractionsColumns(t), [t])

  if (isLoading) {
    return (
      <div className="space-y-2">
        {['s0', 's1', 's2', 's3', 's4'].map((key) => (
          <Skeleton key={key} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <p className="text-sm text-destructive">{t('interactions.loadError')}</p>
  }

  return (
    <DataTable
      columns={columns}
      data={interactions}
      onRowClick={onOpenDetail}
      toolbar={(table) => <InteractionsTableToolbar table={table} />}
    />
  )
}
