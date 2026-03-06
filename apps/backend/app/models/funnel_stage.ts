import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, column, hasMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { SoftDeletes } from 'adonis-lucid-soft-deletes'
import type { DateTime } from 'luxon'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import User from '#models/user'

export default class FunnelStage extends compose(BaseModel, SoftDeletes) {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare name: string

  @column()
  declare position: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @column.dateTime()
  declare deletedAt: DateTime | null

  // Primary user isolation mechanism — use in ALL funnel stage queries
  static forUser = scope((query, userId: string) => {
    query.where('user_id', userId)
  })

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => Positioning)
  declare positionings: HasMany<typeof Positioning>

  @hasMany(() => Prospect)
  declare prospects: HasMany<typeof Prospect>
}
