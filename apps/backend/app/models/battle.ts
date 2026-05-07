import { BaseModel, belongsTo, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import User from '#models/user'

export default class Battle extends BaseModel {
  static table = 'battles'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare funnelStageId: string

  @column()
  declare variantAId: string

  @column()
  declare variantBId: string

  // Application-managed — computed as MAX(battle_number) + 1 per (user_id, funnel_stage_id) at creation
  @column()
  declare battleNumber: number

  @column()
  declare status: 'active' | 'closed'

  // null until battle is closed and winner is confirmed
  @column()
  declare winnerId: string | null

  @column.dateTime()
  declare startedAt: DateTime

  @column.dateTime()
  declare closedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // No SoftDeletes — battles are definitively closed, not archived

  // Primary user isolation mechanism — use in ALL Battle queries
  static forUser = scope((query, userId: string) => {
    query.where('user_id', userId)
  })

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => FunnelStage)
  declare funnelStage: BelongsTo<typeof FunnelStage>

  // Three FK to positionings — explicit foreignKey required to disambiguate
  @belongsTo(() => Positioning, { foreignKey: 'variantAId' })
  declare variantA: BelongsTo<typeof Positioning>

  @belongsTo(() => Positioning, { foreignKey: 'variantBId' })
  declare variantB: BelongsTo<typeof Positioning>

  @belongsTo(() => Positioning, { foreignKey: 'winnerId' })
  declare winner: BelongsTo<typeof Positioning>
}
