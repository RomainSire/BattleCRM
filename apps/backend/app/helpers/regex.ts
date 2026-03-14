/**
 * UUID v4 regex for validating query params before passing to PostgreSQL uuid columns.
 * PostgreSQL throws a 500 on invalid UUID format — always validate first.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * ISO 8601 date/datetime regex for validating interaction_date before passing to DateTime.fromISO().
 * Accepts date-only (2024-01-15) and datetime (2024-01-15T10:30:00Z, with offset, etc.).
 * DateTime.fromISO() silently produces an invalid DateTime on malformed strings.
 */
export const ISO_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/
