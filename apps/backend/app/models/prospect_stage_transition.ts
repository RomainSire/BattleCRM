import { BaseModel, belongsTo, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import FunnelStage from '#models/funnel_stage'
import Prospect from '#models/prospect'
import User from '#models/user'

export default class ProspectStageTransition extends BaseModel {
  static table = 'prospect_stage_transitions'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare prospectId: string

  @column()
  declare fromStageId: string | null

  @column()
  declare toStageId: string

  @column.dateTime()
  declare transitionedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // Primary user isolation mechanism — mirrors Prospect and FunnelStage scope pattern
  static forUser = scope((query, userId: string) => {
    query.where('user_id', userId)
  })

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Prospect)
  declare prospect: BelongsTo<typeof Prospect>

  @belongsTo(() => FunnelStage, { foreignKey: 'fromStageId' })
  declare fromStage: BelongsTo<typeof FunnelStage>

  @belongsTo(() => FunnelStage, { foreignKey: 'toStageId' })
  declare toStage: BelongsTo<typeof FunnelStage>
}
