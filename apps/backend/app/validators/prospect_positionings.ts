import vine from '@vinejs/vine'

export const assignPositioningValidator = vine.compile(
  vine.object({
    positioning_id: vine.string().uuid(),
  }),
)

export const setOutcomeValidator = vine.compile(
  vine.object({
    // outcome is never null — it's an explicit user action (null is the initial state, never sent by client)
    outcome: vine.enum(['success', 'failed'] as const),
  }),
)
