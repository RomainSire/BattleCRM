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

// positioning_id holds either an id or the 'none' sentinel (mapped to null at submit).
// interaction_date is the native date-input string (empty = leave unchanged).
export const updateInteractionSchema = vine.create(
  vine.object({
    positioning_id: vine.string().trim(),
    interaction_date: vine.string().trim().optional(),
    notes: vine.string().trim().optional(),
  }),
)
