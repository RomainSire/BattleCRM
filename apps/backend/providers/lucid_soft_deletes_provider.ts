import { Exception } from '@adonisjs/core/exceptions'
import type { ApplicationService } from '@adonisjs/core/types'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

export default class LucidSoftDeletesProvider {
  constructor(protected app: ApplicationService) {}

  async boot() {
    const { ModelQueryBuilder } = await this.app.import('@adonisjs/lucid/orm')

    function ensureModelWithSoftDeletes(model: LucidModel) {
      if (!('ignoreDeleted' in model && 'ignoreDeletedPaginate' in model)) {
        throw new Exception(`${model.name} model doesn't support Soft Deletes`, {
          code: 'E_MODEL_SOFT_DELETE',
          status: 500,
        })
      }
    }

    ModelQueryBuilder.macro(
      'restore',
      async function (this: ModelQueryBuilderContract<LucidModel>) {
        ensureModelWithSoftDeletes(this.model)
        const deletedAtColumn = this.model.$getColumn('deletedAt')?.columnName
        if (!deletedAtColumn) return
        await this.update({ [deletedAtColumn]: null })
      },
    )

    // biome-ignore lint/suspicious/noExplicitAny: SoftDeletes mixin methods not in LucidModel type
    ModelQueryBuilder.macro('withTrashed', function (this: ModelQueryBuilderContract<any>) {
      ensureModelWithSoftDeletes(this.model)
      // biome-ignore lint/suspicious/noExplicitAny: disableIgnore is added by SoftDeletes mixin
      return (this.model as any).disableIgnore(this)
    })

    // biome-ignore lint/suspicious/noExplicitAny: SoftDeletes mixin methods not in LucidModel type
    ModelQueryBuilder.macro('onlyTrashed', function (this: ModelQueryBuilderContract<any>) {
      ensureModelWithSoftDeletes(this.model)
      const deletedAtColumn = this.model.$getColumn('deletedAt')?.columnName
      // biome-ignore lint/suspicious/noExplicitAny: disableIgnore is added by SoftDeletes mixin
      return (this.model as any)
        .disableIgnore(this)
        .whereNotNull(`${this.model.table}.${deletedAtColumn}`)
    })
  }
}
