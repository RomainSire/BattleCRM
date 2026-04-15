import { Exception } from '@adonisjs/core/exceptions'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'
import {
  type BaseModel,
  beforeFetch,
  beforeFind,
  beforePaginate,
  column,
} from '@adonisjs/lucid/orm'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'

type ModelQueryBuilderWithIgnoreDeleted<
  T extends LucidModel,
  R = InstanceType<T>,
> = ModelQueryBuilderContract<T, R> & {
  ignoreDeleted: boolean
}

export function SoftDeletes<T extends NormalizeConstructor<typeof BaseModel>>(superclass: T) {
  class ModelWithSoftDeletes extends superclass {
    @beforeFind()
    @beforeFetch()
    static ignoreDeleted<Model extends typeof ModelWithSoftDeletes>(
      query: ModelQueryBuilderWithIgnoreDeleted<Model, InstanceType<Model>>,
    ): void {
      if (query.ignoreDeleted === false) {
        return
      }
      const isGroupLimitQuery = query.clone().toQuery().includes('adonis_group_limit_counter')
      const deletedAtColumn = query.model.$getColumn('deletedAt')?.columnName
      // biome-ignore lint/suspicious/noExplicitAny: accessing internal knex query state
      const queryIgnoreDeleted = isGroupLimitQuery ? (query.knexQuery as any)._single.table : query
      queryIgnoreDeleted.whereNull(`${query.model.table}.${deletedAtColumn}`)
    }

    @beforePaginate()
    static ignoreDeletedPaginate<Model extends typeof ModelWithSoftDeletes>([countQuery, query]: [
      ModelQueryBuilderWithIgnoreDeleted<Model, InstanceType<Model>>,
      ModelQueryBuilderWithIgnoreDeleted<Model, InstanceType<Model>>,
    ]): void {
      countQuery.ignoreDeleted = query.ignoreDeleted
      ModelWithSoftDeletes.ignoreDeleted(countQuery)
    }

    static disableIgnore<Model extends typeof ModelWithSoftDeletes, Result = InstanceType<Model>>(
      this: Model,
      query: ModelQueryBuilderWithIgnoreDeleted<Model, Result>,
    ): ModelQueryBuilderWithIgnoreDeleted<Model, Result> {
      if (query.ignoreDeleted === false) {
        return query
      }
      query.ignoreDeleted = false
      return query
    }

    static withTrashed<Model extends typeof ModelWithSoftDeletes>(
      this: Model,
    ): ModelQueryBuilderWithIgnoreDeleted<Model, InstanceType<T>> {
      // biome-ignore lint/complexity/noThisInStatic: `this: Model` is an explicit TS type for subclass caller
      const query = this.query() as ModelQueryBuilderWithIgnoreDeleted<Model, InstanceType<Model>>
      // biome-ignore lint/complexity/noThisInStatic: `this: Model` is an explicit TS type for subclass caller
      return this.disableIgnore(query)
    }

    static onlyTrashed<Model extends typeof ModelWithSoftDeletes>(
      this: Model,
    ): ModelQueryBuilderWithIgnoreDeleted<Model, InstanceType<Model>> {
      // biome-ignore lint/complexity/noThisInStatic: `this: Model` is an explicit TS type for subclass caller
      const query = this.query() as ModelQueryBuilderWithIgnoreDeleted<Model, InstanceType<Model>>
      const deletedAtColumn = query.model.$getColumn('deletedAt')?.columnName
      // biome-ignore lint/complexity/noThisInStatic: `this: Model` is an explicit TS type for subclass caller
      return this.disableIgnore(query).whereNotNull(`${query.model.table}.${deletedAtColumn}`)
    }

    $forceDelete = false

    @column.dateTime()
    declare deletedAt?: DateTime | null

    get trashed(): boolean {
      return this.deletedAt !== null
    }

    $getQueryFor(
      action: 'insert' | 'update' | 'delete' | 'refresh',
      client: QueryClientContract,
      // biome-ignore lint/suspicious/noExplicitAny: return type varies by action (insert vs update/delete)
    ): any {
      const softDelete = async (): Promise<void> => {
        this.deletedAt = DateTime.local()
        await this.save()
      }
      if (action === 'delete' && !this.$forceDelete) {
        return { del: softDelete, delete: softDelete }
      }
      if (action === 'insert') {
        return super.$getQueryFor('insert', client)
      }
      return super.$getQueryFor(action as 'update' | 'delete' | 'refresh', client)
    }

    async delete(): Promise<void> {
      await super.delete()
      this.$isDeleted = this.$forceDelete
    }

    async restore(): Promise<this> {
      if (this.$isDeleted) {
        throw new Exception('Cannot restore a model instance that was force deleted', {
          code: 'E_MODEL_FORCE_DELETED',
          status: 500,
        })
      }
      if (!this.trashed) {
        return this
      }
      this.deletedAt = null
      await this.save()
      return this
    }

    async forceDelete(): Promise<void> {
      this.$forceDelete = true
      await this.delete()
    }
  }

  return ModelWithSoftDeletes
}
