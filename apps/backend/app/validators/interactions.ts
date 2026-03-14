import vine from '@vinejs/vine'
import { ISO_DATE_REGEX } from '#helpers/regex'

export const createInteractionValidator = vine.compile(
  vine.object({
    prospect_id: vine.string().uuid(),
    positioning_id: vine.string().uuid().nullable().optional(),
    status: vine.enum(['positive', 'pending', 'negative']),
    notes: vine.string().trim().nullable().optional(),
    interaction_date: vine.string().regex(ISO_DATE_REGEX).optional(),
  }),
)

export const updateInteractionValidator = vine.compile(
  vine.object({
    status: vine.enum(['positive', 'pending', 'negative']).optional(),
    notes: vine.string().trim().nullable().optional(),
    positioning_id: vine.string().uuid().nullable().optional(),
    interaction_date: vine.string().regex(ISO_DATE_REGEX).optional(),
  }),
)
