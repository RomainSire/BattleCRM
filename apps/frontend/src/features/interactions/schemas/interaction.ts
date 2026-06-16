import vine from '@vinejs/vine'

// Frontend schema for creating an interaction.
// prospect_id is required; positioning_id holds either an id or the 'none' sentinel
// (mapped to null at submit time). Both are wired into react-hook-form via SelectField.
export const createInteractionSchema = vine.create(
  vine.object({
    prospect_id: vine.string().trim().minLength(1),
    positioning_id: vine.string().trim(),
    notes: vine.string().trim().optional(),
  }),
)

export const updateInteractionSchema = vine.create(
  vine.object({
    notes: vine.string().trim().optional(),
  }),
)
