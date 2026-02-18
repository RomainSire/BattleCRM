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

/**
 * Validator for user login data
 */
export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().trim().toLowerCase(),
    password: vine.string(),
  }),
)
