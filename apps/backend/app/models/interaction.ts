import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { SoftDeletes } from 'adonis-lucid-soft-deletes'
import type { DateTime } from 'luxon'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import User from '#models/user'

export default class Interaction extends compose(BaseModel, SoftDeletes) {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare prospectId: string

  @column()
  declare positioningId: string | null

  @column()
  declare status: 'positive' | 'pending' | 'negative'

  @column()
  declare notes: string | null

  @column.dateTime()
  declare interactionDate: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @column.dateTime()
  declare deletedAt: DateTime | null

  // User isolation — obligatoire sur toutes les requêtes
  static forUser = scope((query, userId: string) => {
    query.where('user_id', userId)
  })

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Prospect)
  declare prospect: BelongsTo<typeof Prospect>

  @belongsTo(() => Positioning)
  declare positioning: BelongsTo<typeof Positioning>
}
