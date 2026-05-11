import vine from '@vinejs/vine'

export const funnelStageSchema = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1),
  }),
)
