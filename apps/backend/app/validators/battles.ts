import vine from '@vinejs/vine'

export const createBattleValidator = vine.create(
  vine.object({
    funnel_stage_id: vine.string().uuid(),
    variant_a_id: vine.string().uuid(),
    variant_b_id: vine.string().uuid(),
  }),
)

export const closeBattleValidator = vine.create(
  vine.object({
    winner_id: vine.string().uuid(),
  }),
)
