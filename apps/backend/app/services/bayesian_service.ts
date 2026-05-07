import type { ConfidenceLevel } from '@battlecrm/shared'

const ALPHA_PRIOR = 1
const BETA_PRIOR = 1

// Precondition: 0 ≤ successes ≤ total ≥ 1 — guaranteed by the SQL COUNT() GROUP BY caller.
export function calculateConversionRate(
  successes: number,
  total: number,
): { rate: number; confidenceLevel: ConfidenceLevel } {
  const rate = (ALPHA_PRIOR + successes) / (ALPHA_PRIOR + BETA_PRIOR + total)
  const confidenceLevel: ConfidenceLevel = total >= 20 ? 'high' : total >= 10 ? 'medium' : 'low'
  return { rate, confidenceLevel }
}
