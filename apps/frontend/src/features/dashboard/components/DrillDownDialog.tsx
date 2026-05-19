import type { ConversionCellType } from '@battlecrm/shared'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useDrillDown } from '../hooks/useDrillDown'

interface DrillDownDialogProps {
  cell: ConversionCellType
  children: ReactNode
}

type Outcome = 'success' | 'failed' | null

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const { t } = useTranslation()

  if (outcome === 'success') {
    return (
      <Badge
        variant="secondary"
        className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
      >
        {t('dashboard.drillDown.outcomes.success')}
      </Badge>
    )
  }
  if (outcome === 'failed') {
    return (
      <Badge
        variant="secondary"
        className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
      >
        {t('dashboard.drillDown.outcomes.failed')}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {t('dashboard.drillDown.outcomes.inProgress')}
    </Badge>
  )
}

export function DrillDownDialog({ cell, children }: DrillDownDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const { data, isLoading, isError } = useDrillDown(cell.positioningId, cell.funnelStageId, {
    enabled: open,
  })

  const prospects = data?.data ?? []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('dashboard.drillDown.title', {
              name: cell.positioningName ?? t('dashboard.deletedPositioning'),
              stage: cell.funnelStageName ?? t('dashboard.deletedStage'),
            })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            {t('dashboard.drillDown.rate', {
              rate: (cell.rate * 100).toFixed(0),
              n: cell.numerator,
              total: cell.denominator,
            })}
          </p>

          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}

          {!isLoading && isError && (
            <p className="text-sm text-destructive">{t('dashboard.loadError')}</p>
          )}

          {!isLoading && !isError && prospects.length === 0 && (
            <p className="text-sm italic text-muted-foreground">
              {t('dashboard.drillDown.noProspects')}
            </p>
          )}

          {!isLoading && !isError && prospects.length > 0 && (
            <ul className="space-y-2">
              {prospects.map((prospect) => (
                <li key={prospect.id} className="flex items-center justify-between gap-2">
                  <Link
                    to={`/prospects?prospect=${prospect.id}`}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {prospect.name}
                  </Link>
                  <OutcomeBadge outcome={prospect.outcome} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
