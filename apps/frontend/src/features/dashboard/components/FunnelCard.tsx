import type {
  BattleType,
  ConversionCellType,
  FunnelStageType,
  PositioningType,
} from '@battlecrm/shared'
import { useTranslation } from 'react-i18next'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getTrafficLight, type TrafficLightColor } from '../lib/trafficLight'

interface FunnelCardProps {
  stage: FunnelStageType
  cells: ConversionCellType[]
  battles: BattleType[]
  positionings: PositioningType[]
}

function getPositioningName(
  id: string,
  cells: ConversionCellType[],
  positionings: PositioningType[],
  fallback: string,
): string {
  const fromCell = cells.find((c) => c.positioningId === id)
  if (fromCell?.positioningName) return fromCell.positioningName
  const fromList = positionings.find((p) => p.id === id)
  if (fromList) return fromList.name
  return fallback
}

const TRAFFIC_CONFIG: Record<TrafficLightColor, { emoji: string; labelKey: string }> = {
  green: { emoji: '🟢', labelKey: 'dashboard.trafficLight.significant' },
  yellow: { emoji: '🟡', labelKey: 'dashboard.trafficLight.trending' },
  red: { emoji: '🔴', labelKey: 'dashboard.trafficLight.needData' },
}

export function FunnelCard({ stage, cells, battles, positionings }: FunnelCardProps) {
  const { t } = useTranslation()

  const stageCells = cells.filter((c) => c.funnelStageId === stage.id)
  const activeBattle = battles.find((b) => b.funnelStageId === stage.id && b.status === 'active')
  const closedBattles = battles
    .filter((b) => b.funnelStageId === stage.id && b.status === 'closed')
    .sort((a, b) => b.battleNumber - a.battleNumber)

  const unknownVariant = t('dashboard.unknownVariant')

  function resolveName(id: string) {
    return getPositioningName(id, cells, positionings, unknownVariant)
  }

  function renderTrafficLight(battle: BattleType) {
    const { color, confidence, leadingVariantId } = getTrafficLight(
      cells,
      battle.variantAId,
      battle.variantBId,
      stage.id,
    )
    const { emoji, labelKey } = TRAFFIC_CONFIG[color]
    const tooltipText =
      confidence === null || leadingVariantId === null
        ? t('dashboard.trafficLight.tooltipNoData')
        : t('dashboard.trafficLight.tooltipWithProb', {
            confidence: Math.round(confidence * 100),
            variant: resolveName(leadingVariantId),
          })
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="cursor-default gap-1 text-xs"
            aria-label={t(labelKey)}
          >
            <span>{emoji}</span>
            <span>{t(labelKey)}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  function renderHeaderBattleInfo() {
    if (activeBattle) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t('dashboard.activeBattle', {
              n: activeBattle.battleNumber,
              a: resolveName(activeBattle.variantAId),
              b: resolveName(activeBattle.variantBId),
            })}
          </span>
          {renderTrafficLight(activeBattle)}
        </div>
      )
    }

    const lastClosed = closedBattles[0]
    if (lastClosed?.winnerId) {
      return (
        <p className="text-sm text-muted-foreground">
          {t('dashboard.battleClosed', { winner: resolveName(lastClosed.winnerId) })}
        </p>
      )
    }

    return <p className="text-sm text-muted-foreground">{t('dashboard.noActiveBattle')}</p>
  }

  function isVariantInActiveBattle(positioningId: string) {
    if (!activeBattle) return false
    return activeBattle.variantAId === positioningId || activeBattle.variantBId === positioningId
  }

  return (
    <AccordionItem value={stage.id} className="border-0">
      <Card className="w-full">
        <CardHeader className="pb-2">
          <AccordionTrigger className="py-0 hover:no-underline">
            <div className="min-w-0 flex-1 space-y-1 text-left">
              <p className="font-semibold leading-tight">{stage.name}</p>
              {renderHeaderBattleInfo()}
            </div>
          </AccordionTrigger>
        </CardHeader>

        <AccordionContent>
          <CardContent className="space-y-4 pt-0">
            {/* Conversion rates */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('dashboard.conversionRates')}
              </h3>
              {stageCells.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('dashboard.noData')}</p>
              ) : (
                <ul className="space-y-3">
                  {stageCells.map((cell) => (
                    <li
                      key={cell.positioningId}
                      className={`space-y-1 rounded-md p-2 ${isVariantInActiveBattle(cell.positioningId) ? 'bg-muted/50 ring-1 ring-primary/20' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {cell.positioningName ?? t('dashboard.deletedPositioning')}
                        </span>
                        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                          {(cell.rate * 100).toFixed(0)}%{' '}
                          <span className="text-xs">
                            ({cell.numerator}/{cell.denominator})
                          </span>
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${(cell.rate * 100).toFixed(1)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Battle history */}
            {closedBattles.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('dashboard.battleHistory')}
                </h3>
                <ul className="space-y-1">
                  {closedBattles.map((battle) => (
                    <li key={battle.id} className="text-sm text-muted-foreground">
                      {t('dashboard.battleHistoryItem', {
                        n: battle.battleNumber,
                        a: resolveName(battle.variantAId),
                        b: resolveName(battle.variantBId),
                        winner: battle.winnerId ? resolveName(battle.winnerId) : '—',
                      })}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </CardContent>
        </AccordionContent>
      </Card>
    </AccordionItem>
  )
}
