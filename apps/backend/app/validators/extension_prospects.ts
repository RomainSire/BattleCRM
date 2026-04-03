import vine from '@vinejs/vine'

export const extensionCheckValidator = vine.compile(
  vine.object({
    linkedin_url: vine.string().trim().url(),
  }),
)

export const extensionCreateProspectValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    linkedin_url: vine.string().trim().url().maxLength(500),
    company: vine.string().trim().maxLength(255).nullable().optional(),
    email: vine.string().trim().email().maxLength(255).nullable().optional(),
    phone: vine.string().trim().maxLength(50).nullable().optional(),
    title: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
  }),
)

export const extensionUpdateProspectValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    company: vine.string().trim().maxLength(255).nullable().optional(),
    email: vine.string().trim().email().maxLength(255).nullable().optional(),
    phone: vine.string().trim().maxLength(50).nullable().optional(),
    title: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
    // linkedin_url intentionally excluded — read-only key for extension-created prospects
    // funnel_stage_id intentionally excluded — stage management is web app only
  }),
)
