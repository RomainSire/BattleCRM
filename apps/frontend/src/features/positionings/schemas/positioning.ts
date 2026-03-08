import vine from '@vinejs/vine'

export const createPositioningSchema = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    description: vine.string().trim().optional(),
    content: vine.string().trim().optional(),
  }),
)

export const updatePositioningSchema = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    description: vine.string().trim().optional(),
    content: vine.string().trim().optional(),
  }),
)
