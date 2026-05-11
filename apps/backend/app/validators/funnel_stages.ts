import vine from '@vinejs/vine'

export const createFunnelStageValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
  }),
)

export const updateFunnelStageValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
  }),
)

export const reorderFunnelStagesValidator = vine.create(
  vine.object({
    order: vine.array(vine.string().uuid()).minLength(1),
  }),
)
