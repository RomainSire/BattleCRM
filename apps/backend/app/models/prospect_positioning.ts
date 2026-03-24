import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import { BaseModel, belongsTo, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'

export default class ProspectPositioning extends BaseModel {
  static table = 'prospect_positionings'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare prospectId: string

  @column()
  declare positioningId: string

  // Denormalized from positioning.funnel_stage_id — used for UNIQUE constraint and active lookup
  @column()
  declare funnelStageId: string

  // null = in-progress | 'success' | 'failed' — always set explicitly by user, never automatic
  @column()
  declare outcome: 'success' | 'failed' | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // No SoftDeletes — junction table uses hard delete on replacement:
  // Assigning a new positioning for a stage already covered → delete old row + insert new row
  // This avoids violating the UNIQUE constraint on re-insert.

  // Primary user isolation mechanism — use in ALL ProspectPositioning queries
  static forUser = scope((query, userId: string) => {
    query.where('user_id', userId)
  })

  @belongsTo(() => Prospect)
  declare prospect: BelongsTo<typeof Prospect>

  @belongsTo(() => Positioning)
  declare positioning: BelongsTo<typeof Positioning>

  @belongsTo(() => FunnelStage)
  declare funnelStage: BelongsTo<typeof FunnelStage>
}
