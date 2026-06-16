import vine from '@vinejs/vine'

export const createPositioningSchema = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1),
    funnel_stage_id: vine.string().trim().minLength(1),
    description: vine.string().trim().optional(),
    content: vine.string().trim().optional(),
  }),
)

export const updatePositioningSchema = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1),
    funnel_stage_id: vine.string().trim().minLength(1),
    description: vine.string().trim().optional(),
    content: vine.string().trim().optional(),
  }),
)
