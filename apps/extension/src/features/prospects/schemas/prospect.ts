import vine from '@vinejs/vine'

// email stays optional without .email() (HTML type="email" handles format) — same
// reasoning as the frontend: VineJS fails empty strings against .email().
export const prospectSchema = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1),
    title: vine.string().trim().optional(),
    company: vine.string().trim().optional(),
    email: vine.string().trim().optional(),
    phone: vine.string().trim().optional(),
  }),
)
