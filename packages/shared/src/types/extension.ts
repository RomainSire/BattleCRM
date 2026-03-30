import type { UserType } from './auth.js'

export type ExtensionLoginResponse = {
  token: string
  user: UserType
}
