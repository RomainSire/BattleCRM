import vine from '@vinejs/vine'

export const createPositioningValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    funnel_stage_id: vine.string().uuid(),
    description: vine.string().trim().nullable().optional(),
    content: vine.string().trim().nullable().optional(),
  }),
)

export const updatePositioningValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    funnel_stage_id: vine.string().uuid().optional(),
    description: vine.string().trim().nullable().optional(),
    content: vine.string().trim().nullable().optional(),
  }),
)
