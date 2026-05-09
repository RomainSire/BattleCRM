import type { ConversionCellType } from '@battlecrm/shared'

export type TrafficLightColor = 'green' | 'yellow' | 'red'

// Story 6.3 proxy: uses confidenceLevel from performance matrix cells.
// Story 6.4 will replace this with Bayesian P(A > B) calculation.
export function getTrafficLight(
  cells: ConversionCellType[],
  variantAId: string,
  variantBId: string,
  funnelStageId: string,
): TrafficLightColor {
  const cellA = cells.find(
    (c) => c.positioningId === variantAId && c.funnelStageId === funnelStageId,
  )
  const cellB = cells.find(
    (c) => c.positioningId === variantBId && c.funnelStageId === funnelStageId,
  )

  if (!cellA || !cellB) return 'red'

  const levels = { high: 2, medium: 1, low: 0 } as const
  const minLevel = Math.min(levels[cellA.confidenceLevel], levels[cellB.confidenceLevel])

  if (minLevel >= 2) return 'green'
  if (minLevel >= 1) return 'yellow'
  return 'red'
}
