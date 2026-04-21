import type { ExtensionLoginResponse } from '@battlecrm/shared'
import { HttpError } from '../../../lib/api'

export const authApi = {
  /**
   * Login — uses explicit params because storage is not yet populated at call time.
   */
  async login(
    baseUrl: string,
    email: string,
    password: string,
    name = 'Extension',
  ): Promise<ExtensionLoginResponse> {
    const res = await fetch(`${baseUrl}/api/extension/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
    if (!res.ok) throw new HttpError(res.status)
    return res.json()
  },

  /**
   * Logout — uses explicit params because it is called from the background service worker
   * outside of any React context.
   */
  async logout(baseUrl: string, token: string): Promise<void> {
    const res = await fetch(`${baseUrl}/api/extension/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new HttpError(res.status)
  },
}
