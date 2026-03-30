import vine from '@vinejs/vine'

export const extensionLoginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().toLowerCase().email(),
    password: vine.string().minLength(1),
    name: vine.string().trim().optional(),
  }),
)
