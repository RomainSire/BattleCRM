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
    // stage_id — optional override for the stage popup use case: the stage change may have already
    // been persisted by the time the user clicks the outcome button, so the caller passes the
    // original stage id to target the correct prospect_positioning record.
    stage_id: vine.string().uuid().optional(),
  }),
)
