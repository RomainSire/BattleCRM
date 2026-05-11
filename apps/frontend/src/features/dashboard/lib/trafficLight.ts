import type { ConversionCellType } from '@battlecrm/shared'

export type TrafficLightColor = 'green' | 'yellow' | 'red'

export type TrafficLightResult = {
  color: TrafficLightColor
  confidence: number | null
  leadingVariantId: string | null
}

const PRIOR_ALPHA = 1
const PRIOR_BETA = 1
const MIN_SAMPLE_SIZE = 10

// Abramowitz & Stegun approximation (max error ~1.5e-7)
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return sign * (1 - poly * Math.exp(-ax * ax))
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

export function calculatePAGreaterThanB(
  numA: number,
  denomA: number,
  numB: number,
  denomB: number,
): number | null {
  if (denomA < MIN_SAMPLE_SIZE || denomB < MIN_SAMPLE_SIZE) return null
  if (numA > denomA || numB > denomB) return null

  const alphaA = PRIOR_ALPHA + numA
  const betaA = PRIOR_BETA + (denomA - numA)
  const alphaB = PRIOR_ALPHA + numB
  const betaB = PRIOR_BETA + (denomB - numB)

  const nA = alphaA + betaA
  const nB = alphaB + betaB
  const muA = alphaA / nA
  const muB = alphaB / nB
  const varA = (alphaA * betaA) / (nA * nA * (nA + 1))
  const varB = (alphaB * betaB) / (nB * nB * (nB + 1))

  const sigma = Math.sqrt(varA + varB)
  if (sigma === 0) return muA > muB ? 1 : muA < muB ? 0 : 0.5

  return normalCdf((muA - muB) / sigma)
}

export function getTrafficLight(
  cells: ConversionCellType[],
  variantAId: string,
  variantBId: string,
  funnelStageId: string,
): TrafficLightResult {
  const cellA = cells.find(
    (c) => c.positioningId === variantAId && c.funnelStageId === funnelStageId,
  )
  const cellB = cells.find(
    (c) => c.positioningId === variantBId && c.funnelStageId === funnelStageId,
  )

  if (!cellA || !cellB) return { color: 'red', confidence: null, leadingVariantId: null }

  const p = calculatePAGreaterThanB(
    cellA.numerator,
    cellA.denominator,
    cellB.numerator,
    cellB.denominator,
  )
  if (p === null) return { color: 'red', confidence: null, leadingVariantId: null }

  const confidence = Math.max(p, 1 - p)
  const leadingVariantId = p >= 0.5 ? variantAId : variantBId
  const color: TrafficLightColor =
    confidence > 0.95 ? 'green' : confidence >= 0.7 ? 'yellow' : 'red'

  return { color, confidence, leadingVariantId }
}
