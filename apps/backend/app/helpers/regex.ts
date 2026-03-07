/**
 * UUID v4 regex for validating query params before passing to PostgreSQL uuid columns.
 * PostgreSQL throws a 500 on invalid UUID format — always validate first.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
