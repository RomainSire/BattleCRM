/**
 * Type augmentation for adonis-lucid-soft-deletes v2.x
 *
 * The package adds withTrashed(), onlyTrashed(), and withoutTrashed() to the
 * Lucid ModelQueryBuilder at runtime via macros, but does not include these
 * methods in its TypeScript declarations. This file bridges that gap.
 */
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

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
  }
}
