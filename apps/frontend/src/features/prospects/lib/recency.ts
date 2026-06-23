/**
 * Recency helpers — derive how recently a prospect was interacted with.
 *
 * Single source of truth for the day thresholds used by both the list (sort)
 * and the kanban (colour dot). The backend returns `lastInteractionAt` (ISO UTC
 * or null) and the frontend computes the day count at render time, so the value
 * never goes stale while the page is open and the user's timezone is respected.
 */

export const RECENCY_THRESHOLDS = { warning: 7, danger: 21 } as const

export type RecencyLevel = 'fresh' | 'warning' | 'danger' | 'never'

/**
 * Shared colour mappings per recency level — single source of truth so the
 * kanban dot, the list column and the detail view stay visually consistent.
 * - `*_DOT` → background classes for the round kanban indicator.
 * - `*_TEXT` → foreground classes for emphasised text (list / detail).
 */
export const RECENCY_DOT_COLORS: Record<RecencyLevel, string> = {
  fresh: 'bg-green-500',
  warning: 'bg-orange-500',
  danger: 'bg-red-500',
  never: 'bg-muted-foreground/40',
}

export const RECENCY_TEXT_COLORS: Record<RecencyLevel, string> = {
  fresh: 'text-green-600',
  warning: 'text-orange-600',
  danger: 'text-red-600',
  never: 'text-muted-foreground',
}

const MS_PER_DAY = 86_400_000

/**
 * Full days elapsed since the last interaction, or null if the prospect has
 * never been interacted with.
 */
export function daysSince(lastInteractionAt: string | null, now: Date = new Date()): number | null {
  if (!lastInteractionAt) return null
  const last = new Date(lastInteractionAt).getTime()
  if (Number.isNaN(last)) return null
  return Math.floor((now.getTime() - last) / MS_PER_DAY)
}

/**
 * Maps a day count to a recency level driving the kanban dot colour.
 * - null            → 'never'   (no interaction)
 * - ≤ warning (7)   → 'fresh'
 * - ≤ danger (21)   → 'warning'
 * - > danger (21)   → 'danger'
 */
export function recencyLevel(days: number | null): RecencyLevel {
  if (days === null) return 'never'
  if (days <= RECENCY_THRESHOLDS.warning) return 'fresh'
  if (days <= RECENCY_THRESHOLDS.danger) return 'warning'
  return 'danger'
}
