import type { PositioningType } from '@battlecrm/shared'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/ui/data-table'
import { Skeleton } from '@/components/ui/skeleton'
import { usePositionings } from '../hooks/usePositionings'
import { getPositioningsColumns } from './columns'
import { PositioningsTableToolbar } from './PositioningsTableToolbar'

interface Props {
  onOpenDetail: (positioning: PositioningType) => void
}

export function PositioningsList({ onOpenDetail }: Props) {
  const { t } = useTranslation()
  const [showArchived, setShowArchived] = useState(false)

  const {
    data: positioningsData,
    isLoading,
    isError,
  } = usePositionings(showArchived ? { include_archived: true } : undefined)

  const positionings = positioningsData?.data ?? []
  const columns = useMemo(() => getPositioningsColumns(t), [t])

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
    return <p className="text-sm text-destructive">{t('positionings.loadError')}</p>
  }

  return (
    <DataTable
      columns={columns}
      data={positionings}
      onRowClick={onOpenDetail}
      getRowClassName={(p) => (p.deletedAt !== null ? 'opacity-60' : undefined)}
      toolbar={(table) => (
        <PositioningsTableToolbar
          table={table}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
        />
      )}
    />
  )
}
