import vine from '@vinejs/vine'

export const createProspectSchema = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    company: vine.string().trim().optional(),
    linkedin_url: vine.string().trim().optional(),
    email: vine.string().trim().email().optional(),
    phone: vine.string().trim().optional(),
    title: vine.string().trim().optional(),
    notes: vine.string().trim().optional(),
  }),
)

export const updateProspectSchema = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    company: vine.string().trim().optional(),
    linkedin_url: vine.string().trim().optional(),
    email: vine.string().trim().email().optional(),
    phone: vine.string().trim().optional(),
    title: vine.string().trim().optional(),
    notes: vine.string().trim().optional(),
  }),
)
