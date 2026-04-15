import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, column, hasMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import { SoftDeletes } from '#mixins/soft_deletes'
import FunnelStage from '#models/funnel_stage'
import Interaction from '#models/interaction'
import ProspectStageTransition from '#models/prospect_stage_transition'
import User from '#models/user'

export default class Prospect extends compose(BaseModel, SoftDeletes) {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare funnelStageId: string

  @column()
  declare name: string

  @column()
  declare company: string | null

  @column()
  declare linkedinUrl: string | null

  @column()
  declare email: string | null

  @column()
  declare phone: string | null

  @column()
  declare title: string | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @column.dateTime()
  declare deletedAt: DateTime | null

  // Primary user isolation mechanism — use in ALL prospect queries (NFR11, NFR12, FR54, FR56)
  static forUser = scope((query, userId: string) => {
    query.where('user_id', userId)
  })

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => FunnelStage)
  declare funnelStage: BelongsTo<typeof FunnelStage>

  @hasMany(() => ProspectStageTransition)
  declare stageTransitions: HasMany<typeof ProspectStageTransition>

  @hasMany(() => Interaction)
  declare interactions: HasMany<typeof Interaction>
}
