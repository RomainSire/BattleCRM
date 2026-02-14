import User from '#models/user'
import env from '#start/env'
import { registerValidator } from '#validators/auth'
import type { HttpContext } from '@adonisjs/core/http'

export default class AuthController {
  /**
   * Handle user registration
   * @returns Created user data or error if registration fails
   */
  async register({ request, response, auth }: HttpContext) {
    const allowRegistration = env.get('ALLOW_REGISTRATION')
    if (!allowRegistration) {
      return response.forbidden({ message: 'Registration is currently disabled' })
    }

    const data = await request.validateUsing(registerValidator)

    let user: User
    try {
      user = await User.create({ email: data.email, password: data.password })
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        return response.unprocessableEntity({
          errors: [{ message: 'This email is already registered', field: 'email' }],
        })
      }
      throw error
    }

    await auth.use('web').login(user)

    return response.created({ user: { id: user.id, email: user.email } })
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
   * @returns User data if authenticated, or an unauthorized error if not authenticated
   */
  async me({ auth, response }: HttpContext) {
    const user = auth.user
    if (!user) {
      return response.unauthorized({ message: 'Not authenticated' })
    }
    return response.ok({ id: user.id, email: user.email })
  }
}
