import type { ConversionCellType, DashboardSummaryType } from '@battlecrm/shared'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface DashboardSummaryProps {
  summary: DashboardSummaryType
  cells: ConversionCellType[]
  isLoading: boolean
  isError?: boolean
}

export function DashboardSummary({ summary, cells, isLoading, isError }: DashboardSummaryProps) {
  const { t } = useTranslation()

  const bestCell = useMemo(
    () =>
      cells
        .filter((c) => c.numerator > 0 && c.confidenceLevel !== 'low')
        .sort((a, b) => b.rate - a.rate)[0] ?? null,
    [cells],
  )

  const maxCount = useMemo(
    () => Math.max(...summary.prospectsByStage.map((s) => s.count), 1),
    [summary.prospectsByStage],
  )

  const showEmptyProspects = summary.totalActiveProspects === 0
  const showEmptyPositionings = summary.totalActiveProspects > 0 && cells.length === 0
  const showEmptyInteractions =
    summary.totalActiveProspects > 0 && summary.interactionsThisMonth === 0

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <p className="text-sm text-destructive">{t('dashboard.summary.loadError')}</p>
  }

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">
              {t('dashboard.summary.totalActiveProspects')}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{summary.totalActiveProspects}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">
              {t('dashboard.summary.interactionsThisWeek')}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{summary.interactionsThisWeek}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">
              {t('dashboard.summary.interactionsThisMonth')}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{summary.interactionsThisMonth}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{t('dashboard.summary.bestPerforming')}</p>
            {bestCell ? (
              <div className="mt-1">
                <p className="truncate text-sm font-semibold">
                  {bestCell.positioningName ?? t('dashboard.deletedPositioning')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {bestCell.funnelStageName ?? t('dashboard.deletedStage')} —{' '}
                  {(bestCell.rate * 100).toFixed(0)}%
                </p>
              </div>
            ) : (
              <p className="mt-1 text-2xl font-bold text-muted-foreground">
                {t('dashboard.summary.bestPerformingNone')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty state guidance */}
      {(showEmptyProspects || showEmptyPositionings || showEmptyInteractions) && (
        <div className="flex flex-wrap gap-2">
          {showEmptyProspects && (
            <Link to="/prospects">
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="pt-3 pb-3">
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.summary.emptyProspects')}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )}
          {showEmptyPositionings && (
            <Link to="/positionings">
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="pt-3 pb-3">
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.summary.emptyPositionings')}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )}
          {showEmptyInteractions && (
            <Card>
              <CardContent className="pt-3 pb-3">
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.summary.emptyInteractions')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Funnel overview */}
      {summary.prospectsByStage.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('dashboard.summary.funnelOverview')}
          </h3>
          <ul className="space-y-2">
            {summary.prospectsByStage.map((stage) => (
              <li key={stage.stageId} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate text-muted-foreground">{stage.stageName}</span>
                  <span className="tabular-nums">{stage.count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${((stage.count / maxCount) * 100).toFixed(0)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
