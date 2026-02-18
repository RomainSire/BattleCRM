import vine from '@vinejs/vine'

export const loginSchema = vine.compile(
  vine.object({
    email: vine.string().email().trim().toLowerCase(),
    password: vine.string(),
  }),
)
