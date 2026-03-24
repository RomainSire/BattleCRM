import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, column, hasMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { SoftDeletes } from 'adonis-lucid-soft-deletes'
import type { DateTime } from 'luxon'
import FunnelStage from '#models/funnel_stage'
import Interaction from '#models/interaction'
import User from '#models/user'

export default class Positioning extends compose(BaseModel, SoftDeletes) {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare funnelStageId: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare content: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @column.dateTime()
  declare deletedAt: DateTime | null

  // Primary user isolation mechanism — use in ALL positioning queries
  static forUser = scope((query, userId: string) => {
    query.where('user_id', userId)
  })

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => FunnelStage)
  declare funnelStage: BelongsTo<typeof FunnelStage>

  @hasMany(() => Interaction)
  declare interactions: HasMany<typeof Interaction>
}
