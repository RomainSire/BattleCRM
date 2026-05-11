import vine from '@vinejs/vine'

export const startBattleSchema = vine.create(
  vine.object({
    variant_a_id: vine.string().uuid(),
    variant_b_id: vine.string().uuid(),
  }),
)
