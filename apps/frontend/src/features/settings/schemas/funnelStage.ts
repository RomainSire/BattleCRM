import vine from '@vinejs/vine'

export const funnelStageSchema = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
  }),
)
