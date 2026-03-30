import { errors as authErrors } from '@adonisjs/auth'
import type { HttpContext } from '@adonisjs/core/http'
import type { ExtensionLoginResponse } from '@battlecrm/shared'
import User from '#models/user'
import { extensionLoginValidator } from '#validators/extension_auth'

export default class ExtensionAuthController {
  async login({ request, response }: HttpContext) {
    const data = await request.validateUsing(extensionLoginValidator)

    let user: User
    try {
      user = await User.verifyCredentials(data.email, data.password)
    } catch (error) {
      if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
        return response.unauthorized({ message: 'Invalid credentials' })
      }
      throw error
    }

    const token = await User.accessTokens.create(user, ['*'], {
      name: data.name ?? 'Extension',
    })

    const body: ExtensionLoginResponse = {
      token: token.value!.release(),
      user: { id: user.id, email: user.email },
    }
    return response.ok(body)
  }

  async logout({ auth, response }: HttpContext) {
    const user = auth.use('extension').user!
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    return response.ok({ message: 'Logged out' })
  }
}
