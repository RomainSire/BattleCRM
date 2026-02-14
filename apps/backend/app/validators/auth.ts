import vine from '@vinejs/vine'

/**
 * Validator for user registration data
 */
export const registerValidator = vine.compile(
  vine.object({
    email: vine.string().email().trim().toLowerCase(),
    password: vine.string().minLength(8),
  }),
)
