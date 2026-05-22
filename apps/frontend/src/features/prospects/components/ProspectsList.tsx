import type { ProspectType } from '@battlecrm/shared'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/ui/data-table'
import { Skeleton } from '@/components/ui/skeleton'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { useProspects } from '../hooks/useProspects'
import { getProspectsColumns } from './columns'
import { ProspectsTableToolbar } from './ProspectsTableToolbar'

interface ProspectsListProps {
  onOpenDetail: (prospect: ProspectType) => void
}

export function ProspectsList({ onOpenDetail }: ProspectsListProps) {
  const { t } = useTranslation()
  const [showArchived, setShowArchived] = useState(false)

  const {
    data: prospectsData,
    isLoading: prospectsLoading,
    isError: prospectsError,
  } = useProspects(showArchived ? { include_archived: true } : undefined)
  const { data: stagesData, isLoading: stagesLoading, isError: stagesError } = useFunnelStages()

  const stageMap = useMemo(
    () => new Map((stagesData?.data ?? []).map((s) => [s.id, s.name])),
    [stagesData],
  )
  const columns = useMemo(() => getProspectsColumns(t, stageMap), [t, stageMap])
  const prospects = prospectsData?.data ?? []

  if (prospectsLoading || stagesLoading) {
    return (
      <div className="space-y-2">
        {['s0', 's1', 's2', 's3', 's4'].map((key) => (
          <Skeleton key={key} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (prospectsError || stagesError) {
    return <p className="text-sm text-destructive">{t('prospects.loadError')}</p>
  }

  return (
    <DataTable
      columns={columns}
      data={prospects}
      onRowClick={onOpenDetail}
      getRowClassName={(p) => (p.deletedAt !== null ? 'opacity-60' : undefined)}
      toolbar={(table) => (
        <ProspectsTableToolbar
          table={table}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
        />
      )}
    />
  )
}
