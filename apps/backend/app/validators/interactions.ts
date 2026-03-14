import vine from '@vinejs/vine'

export const createInteractionValidator = vine.compile(
  vine.object({
    prospect_id: vine.string().uuid(),
    positioning_id: vine.string().uuid().nullable().optional(),
    status: vine.enum(['positive', 'pending', 'negative']),
    notes: vine.string().trim().nullable().optional(),
    interaction_date: vine.string().optional(), // ISO 8601 — used as-is in DateTime.fromISO()
  }),
)

export const updateInteractionValidator = vine.compile(
  vine.object({
    status: vine.enum(['positive', 'pending', 'negative']).optional(),
    notes: vine.string().trim().nullable().optional(),
    positioning_id: vine.string().uuid().nullable().optional(),
    interaction_date: vine.string().optional(),
  }),
)
