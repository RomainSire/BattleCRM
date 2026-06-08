import vine from '@vinejs/vine'

export const forgotPasswordSchema = vine.create(
  vine.object({
    email: vine.string().email().trim().toLowerCase(),
  }),
)
