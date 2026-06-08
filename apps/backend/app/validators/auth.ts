import vine from '@vinejs/vine'

/**
 * Validator for user registration data
 */
export const registerValidator = vine.create(
  vine.object({
    email: vine.string().email().trim().toLowerCase(),
    password: vine.string().minLength(8),
  }),
)

/**
 * Validator for user login data
 */
export const loginValidator = vine.create(
  vine.object({
    email: vine.string().email().trim().toLowerCase(),
    password: vine.string(),
  }),
)

/**
 * Validator for password change
 */
export const changePasswordValidator = vine.create(
  vine.object({
    currentPassword: vine.string(),
    newPassword: vine.string().minLength(8),
    newPasswordConfirmation: vine.string().sameAs('newPassword'),
  }),
)

/**
 * Validator for requesting a password-reset email
 */
export const forgotPasswordValidator = vine.create(
  vine.object({
    email: vine.string().email().trim().toLowerCase(),
  }),
)

/**
 * Validator for resetting a password from a reset token
 */
export const resetPasswordValidator = vine.create(
  vine.object({
    token: vine.string(),
    password: vine.string().minLength(8),
    passwordConfirmation: vine.string().sameAs('password'),
  }),
)
