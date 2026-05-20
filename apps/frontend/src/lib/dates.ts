import i18next from 'i18next'

function parseApiDate(isoString: string): Date {
  if (!isoString) return new Date(Number.NaN)
  const hasOffset = isoString.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(isoString)
  return new Date(hasOffset ? isoString : `${isoString}Z`)
}

/** Format a date for display: "20/05/2024" (respects the user's chosen i18next language). */
export function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat(i18next.language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseApiDate(isoString))
}

/** Format a datetime for display: "20/05/2024, 10:30" (respects the user's chosen i18next language). */
export function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat(i18next.language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parseApiDate(isoString))
}

/**
 * Convert an API date to a YYYY-MM-DD string for <input type="date">.
 * Uses the browser's LOCAL timezone so the displayed date matches
 * what the user perceives as "today".
 */
export function toLocalDateInput(isoString: string): string {
  const d = parseApiDate(isoString)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Convert a YYYY-MM-DD string from <input type="date"> to a full UTC ISO string.
 * Interprets the date as midnight in the browser's LOCAL timezone, then converts to UTC.
 */
export function localDateInputToISO(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0).toISOString()
}

/**
 * Get a timestamp (ms since epoch) from an API date string.
 * Used for sorting/comparing dates.
 */
export function getTimestamp(isoString: string): number {
  return parseApiDate(isoString).getTime()
}
