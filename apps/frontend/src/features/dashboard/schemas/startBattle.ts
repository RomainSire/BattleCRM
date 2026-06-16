import vine from '@vinejs/vine'

// Both variants are required. The "A must differ from B" rule has no Vine built-in
// and is enforced at submit time via form.setError('variant_b_id', ...).
export const startBattleSchema = vine.create(
  vine.object({
    variant_a_id: vine.string().trim().minLength(1),
    variant_b_id: vine.string().trim().minLength(1),
  }),
)
