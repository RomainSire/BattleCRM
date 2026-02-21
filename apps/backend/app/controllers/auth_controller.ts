import { errors as authErrors } from '@adonisjs/auth'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import { seedDefaultStages } from '#services/funnel_stage_service'
import env from '#start/env'
import { loginValidator, registerValidator } from '#validators/auth'

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

    return response.created({ user: { id: user.id, email: user.email } })
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
      return response.ok({ user: { id: user.id, email: user.email } })
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
    return response.ok({ id: user.id, email: user.email })
  }

  /**
   * Log out the current user by terminating their session
   */
  async logout({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.ok({ message: 'Logged out' })
  }
}
