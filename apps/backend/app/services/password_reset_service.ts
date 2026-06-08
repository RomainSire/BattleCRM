import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import PasswordResetToken from '#models/password_reset_token'
import type User from '#models/user'

/** How long a password-reset link stays valid. */
export const TOKEN_TTL_MINUTES = 60

/** SHA-256 hash of a raw token — only the hash is ever persisted. */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/**
 * Create a single-use password-reset token for a user.
 * Any pre-existing tokens for that user are purged first (one active token at a time).
 * @returns the RAW token to embed in the email link (never persisted as-is).
 */
export async function generateResetToken(user: User): Promise<string> {
  await PasswordResetToken.query().where('user_id', user.id).delete()

  const rawToken = randomBytes(32).toString('hex')

  await PasswordResetToken.create({
    userId: user.id,
    token: hashToken(rawToken),
    expiresAt: DateTime.now().plus({ minutes: TOKEN_TTL_MINUTES }),
  })

  return rawToken
}

/**
 * Validate and consume a raw reset token.
 * The token is always deleted (single-use), even when expired.
 * @returns the owning user id when valid and unexpired, otherwise null.
 */
export async function consumeToken(rawToken: string): Promise<string | null> {
  const record = await PasswordResetToken.findBy('token', hashToken(rawToken))
  if (!record) {
    return null
  }

  const userId = record.userId
  const expired = record.isExpired

  // Single-use: remove the token whether or not it was still valid.
  await record.delete()

  return expired ? null : userId
}
