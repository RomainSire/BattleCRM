import vine from '@vinejs/vine'

export const loginSchema = vine.create(
  vine.object({
    email: vine.string().email().trim().toLowerCase(),
    password: vine.string(),
  }),
)
