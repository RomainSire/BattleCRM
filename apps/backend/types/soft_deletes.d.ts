/**
 * Type augmentation for adonis-lucid-soft-deletes v2.x
 *
 * The package adds withTrashed(), onlyTrashed(), and withoutTrashed() to the
 * Lucid ModelQueryBuilder at runtime via macros, but does not include these
 * methods in its TypeScript declarations. This file bridges that gap.
 *
 * Also augments forUpdate() which is available at runtime via Knex but is
 * not declared in Lucid's ModelQueryBuilderContract TypeScript interface.
 */
import type { LucidModel } from '@adonisjs/lucid/types/model'

declare module '@adonisjs/lucid/types/model' {
  interface ModelQueryBuilderContract<Model extends LucidModel, Result = InstanceType<Model>> {
    /**
     * Include soft-deleted (trashed) records in query results.
     * Removes the default `WHERE deleted_at IS NULL` scope.
     */
    withTrashed(): this

    /**
     * Return only soft-deleted (trashed) records.
     */
    onlyTrashed(): this

    /**
     * Exclude soft-deleted records (default behavior — explicit opt-in).
     */
    withoutTrashed(): this

    /**
     * Adds a FOR UPDATE row-level lock to the SELECT query (Knex built-in).
     * Use inside a transaction to prevent concurrent reads from racing on the
     * same rows (e.g., computing MAX(position) + 1 concurrently).
     */
    forUpdate(): this
  }
}
