import { errors as authErrors } from '@adonisjs/auth'
import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import type { AuthResponse, UserType } from '@battlecrm/shared'
import ResetPasswordNotification from '#mails/reset_password_notification'
import User from '#models/user'
import { seedDefaultStages } from '#services/funnel_stage_service'
import { consumeToken, generateResetToken } from '#services/password_reset_service'
import env from '#start/env'
import {
  changePasswordValidator,
  forgotPasswordValidator,
  loginValidator,
  registerValidator,
  resetPasswordValidator,
} from '#validators/auth'

export default class AuthController {
  /**
   * Handle user registration
   * Creates user and seeds default funnel stages atomically in a transaction.
   * @returns Created user data or error if registration fails
   */
  async register({ request, response, auth }: HttpContext) {
    const allowRegistration = env.get('ALLOW_REGISTRATION')
    if (!allowRegistration) {
      return response.forbidden({
        errors: [{ message: 'auth.registrationDisabled.description', rule: 'forbidden' }],
      })
    }

    const data = await request.validateUsing(registerValidator)

    let user: User
    try {
      user = await db.transaction(async (trx) => {
        const newUser = await User.create(
          { email: data.email, password: data.password },
          { client: trx },
        )
        await seedDefaultStages(newUser.id, trx)
        return newUser
      })
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        return response.unprocessableEntity({
          errors: [{ message: 'validation.unique', field: 'email', rule: 'unique' }],
        })
      }
      throw error
    }

    // Session login happens outside the transaction (HTTP layer, not DB layer)
    await auth.use('web').login(user)

    const body: AuthResponse = { user: { id: user.id, email: user.email } }
    return response.created(body)
  }

  /**
   * Handle user login with email and password
   * @returns Authenticated user data or error if credentials are invalid
   */
  async login({ request, response, auth }: HttpContext) {
    const data = await request.validateUsing(loginValidator)

    try {
      const user = await User.verifyCredentials(data.email, data.password)
      await auth.use('web').login(user)
      const body: AuthResponse = { user: { id: user.id, email: user.email } }
      return response.ok(body)
    } catch (error) {
      if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
        return response.badRequest({
          errors: [{ message: 'auth.login.invalidCredentials' }],
        })
      }
      throw error
    }
  }

  /**
   * Check if registration is allowed based on environment variable
   * @returns Object indicating whether registration is allowed
   */
  async registrationStatus({ response }: HttpContext) {
    const allowed = env.get('ALLOW_REGISTRATION')
    return response.ok({ allowed })
  }

  /**
   * Get the currently authenticated user's information
   * Route is protected by auth middleware — user is guaranteed to exist
   */
  async me({ auth, response }: HttpContext) {
    const user = auth.user!
    const body: UserType = { id: user.id, email: user.email }
    return response.ok(body)
  }

  /**
   * Log out the current user by terminating their session
   */
  async logout({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.ok({ message: 'Logged out' })
  }

  /**
   * Change the authenticated user's password
   * Verifies current password before applying the new one
   */
  async changePassword({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const data = await request.validateUsing(changePasswordValidator)

    const isValid = await hash.verify(user.password, data.currentPassword)
    if (!isValid) {
      return response.badRequest({
        errors: [
          {
            message: 'auth.changePassword.invalidCurrentPassword',
            field: 'currentPassword',
            rule: 'invalid',
          },
        ],
      })
    }

    user.password = data.newPassword
    await user.save()

    return response.ok({ message: 'Password changed' })
  }

  /**
   * Request a password-reset email.
   * Always returns a generic success response to prevent account enumeration:
   * the response is identical whether or not the email matches an account.
   */
  async forgotPassword({ request, response }: HttpContext) {
    const { email, locale } = await request.validateUsing(forgotPasswordValidator)

    const user = await User.findBy('email', email)
    if (user) {
      const rawToken = await generateResetToken(user)
      const resetUrl = `${env.get('FRONTEND_URL')}/reset-password?token=${rawToken}`
      await mail.send(new ResetPasswordNotification(user.email, resetUrl, locale))
    }

    return response.ok({ message: 'auth.forgotPassword.emailSent' })
  }

  /**
   * Reset a password using a single-use token received by email.
   * The token is consumed (deleted) on every attempt, valid or not.
   */
  async resetPassword({ request, response }: HttpContext) {
    const data = await request.validateUsing(resetPasswordValidator)

    const userId = await consumeToken(data.token)
    if (!userId) {
      return response.badRequest({
        errors: [{ message: 'auth.resetPassword.invalidToken', rule: 'invalid' }],
      })
    }

    const user = await User.findOrFail(userId)
    user.password = data.password
    await user.save()

    return response.ok({ message: 'auth.resetPassword.success' })
  }
}
