import vine from '@vinejs/vine'

export const authSchema = vine.create(
  vine.object({
    baseUrl: vine.string().trim().minLength(1),
    email: vine.string().trim().email(),
    password: vine.string().minLength(1),
  }),
)
