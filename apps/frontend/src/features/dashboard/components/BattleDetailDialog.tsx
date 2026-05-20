import type { BattleType, ConversionCellType } from '@battlecrm/shared'
import { Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/dates'

interface BattleDetailDialogProps {
  battle: BattleType
  cells: ConversionCellType[]
  resolveName: (id: string) => string
  children: ReactNode
}

export function BattleDetailDialog({
  battle,
  cells,
  resolveName,
  children,
}: BattleDetailDialogProps) {
  const { t } = useTranslation()

  function getCell(positioningId: string) {
    return cells.find(
      (c) => c.positioningId === positioningId && c.funnelStageId === battle.funnelStageId,
    )
  }

  function formatRate(positioningId: string): string {
    const cell = getCell(positioningId)
    if (!cell) return t('dashboard.battleDetailDialog.noData')
    return `${(cell.rate * 100).toFixed(0)}% (${cell.numerator}/${cell.denominator})`
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('dashboard.battleDetailDialog.title', { n: battle.battleNumber })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              {t('dashboard.battleDetailDialog.started', {
                date: formatDate(battle.startedAt),
              })}
            </p>
            {battle.closedAt && (
              <p>
                {t('dashboard.battleDetailDialog.closed', {
                  date: formatDate(battle.closedAt),
                })}
              </p>
            )}
          </div>

          {battle.winnerId && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {t('dashboard.battleDetailDialog.winner')}:
              </span>
              <Badge variant="secondary">{resolveName(battle.winnerId)}</Badge>
            </div>
          )}

          <div className="space-y-2">
            {[battle.variantAId, battle.variantBId].map((variantId) => (
              <div
                key={variantId}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span
                  className={`flex items-center gap-1 text-sm ${variantId === battle.winnerId ? 'font-semibold' : ''}`}
                >
                  {resolveName(variantId)}
                  {variantId === battle.winnerId && (
                    <Trophy className="h-3 w-3 shrink-0" aria-hidden="true" />
                  )}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatRate(variantId)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
