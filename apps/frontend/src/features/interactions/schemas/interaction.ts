import vine from '@vinejs/vine'

// Frontend schema — validates text fields only.
// prospect_id, status, positioning_id are managed as React state (not registered in react-hook-form).
export const createInteractionSchema = vine.compile(
  vine.object({
    notes: vine.string().trim().optional(),
  }),
)

export const updateInteractionSchema = vine.compile(
  vine.object({
    notes: vine.string().trim().optional(),
  }),
)
