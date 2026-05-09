import { Accordion } from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { usePositionings } from '@/features/positionings/hooks/usePositionings'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { useTranslation } from 'react-i18next'
import { FunnelCard } from './components/FunnelCard'
import { useBattles } from './hooks/useBattles'
import { usePerformanceMatrix } from './hooks/usePerformanceMatrix'

export function DashboardPage() {
  const { t } = useTranslation()

  const { data: stagesData, isLoading: stagesLoading, isError: stagesError } = useFunnelStages()
  const {
    data: matrixData,
    isLoading: matrixLoading,
    isError: matrixError,
  } = usePerformanceMatrix()
  const { data: battlesData, isLoading: battlesLoading, isError: battlesError } = useBattles()
  const {
    data: positioningsData,
    isLoading: positioningsLoading,
    isError: positioningsError,
  } = usePositionings({ include_archived: true })

  const isLoading = stagesLoading || matrixLoading || battlesLoading || positioningsLoading
  const isError = stagesError || matrixError || battlesError || positioningsError

  const stages = stagesData?.data ?? []
  const cells = matrixData?.cells ?? []
  const battles = battlesData?.data ?? []
  const positionings = positioningsData?.data ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <p className="text-sm text-destructive">{t('dashboard.loadError')}</p>
      )}

      {!isLoading && !isError && stages.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('dashboard.noStages')}</p>
      )}

      {!isLoading && !isError && stages.length > 0 && (
        <Accordion type="single" collapsible className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stages.map((stage) => (
            <FunnelCard
              key={stage.id}
              stage={stage}
              cells={cells}
              battles={battles}
              positionings={positionings}
            />
          ))}
        </Accordion>
      )}
    </div>
  )
}
