import vine from '@vinejs/vine'

export const createProspectValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    company: vine.string().trim().maxLength(255).nullable().optional(),
    linkedin_url: vine.string().trim().maxLength(500).nullable().optional(),
    email: vine.string().trim().email().maxLength(255).nullable().optional(),
    phone: vine.string().trim().maxLength(50).nullable().optional(),
    title: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
    funnel_stage_id: vine.string().uuid().optional(),
  }),
)

export const updateProspectValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    company: vine.string().trim().maxLength(255).nullable().optional(),
    linkedin_url: vine.string().trim().maxLength(500).nullable().optional(),
    email: vine.string().trim().email().maxLength(255).nullable().optional(),
    phone: vine.string().trim().maxLength(50).nullable().optional(),
    title: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
    funnel_stage_id: vine.string().uuid().optional(),
  }),
)
