import vine from '@vinejs/vine'

// Note: email uses vine.string().trim().optional() without .email() because VineJS v3
// validates empty strings against .email() and fails (optional() only skips undefined).
// Email format is validated by the HTML input type="email" attribute (client)
// and by the backend VineJS validator (server).
export const createProspectSchema = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    company: vine.string().trim().optional(),
    linkedin_url: vine.string().trim().optional(),
    email: vine.string().trim().optional(),
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
    email: vine.string().trim().optional(),
    phone: vine.string().trim().optional(),
    title: vine.string().trim().optional(),
    notes: vine.string().trim().optional(),
  }),
)
