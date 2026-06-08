import vine from '@vinejs/vine'

export const resetPasswordSchema = vine.create(
  vine.object({
    password: vine.string().minLength(8),
    passwordConfirmation: vine.string().sameAs('password'),
  }),
)
