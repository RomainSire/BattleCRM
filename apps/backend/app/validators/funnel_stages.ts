import vine from '@vinejs/vine'

export const createFunnelStageValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
  }),
)

export const updateFunnelStageValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
  }),
)

export const reorderFunnelStagesValidator = vine.compile(
  vine.object({
    order: vine.array(vine.string().uuid()).minLength(1),
  }),
)
