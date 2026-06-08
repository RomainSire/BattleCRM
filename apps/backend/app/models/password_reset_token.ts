import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from '#models/user'

export default class PasswordResetToken extends BaseModel {
  static table = 'password_reset_tokens'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  // SHA-256 hash of the raw token (the raw token only lives in the email link)
  @column()
  declare token: string

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  get isExpired(): boolean {
    return this.expiresAt < DateTime.now()
  }
}
