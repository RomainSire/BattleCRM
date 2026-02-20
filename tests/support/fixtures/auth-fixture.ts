/**
 * Auth fixture — provides helpers for authenticated and guest test scenarios.
 *
 * BattleCRM uses AdonisJS session auth (httpOnly cookies).
 * IMPORTANT: Use page.context().request (NOT the `request` fixture) so that
 * session cookies are shared with the browser context.
 */

import { test as base } from '@playwright/test'
import { login, logout } from '../helpers/api'

type AuthFixtures = {
  /**
   * Logs in as a specific user via API (sets session cookie in browser context).
   * Useful for tests that need to switch users mid-test.
   */
  loginAs: (email: string, password: string) => Promise<void>

  /** Logs out the current user via API (clears session cookie in browser context). */
  logoutUser: () => Promise<void>
}

export const test = base.extend<AuthFixtures>({
  loginAs: async ({ page }, use) => {
    await use(async (email: string, password: string) => {
      await login(page.context().request, email, password)
    })
  },

  logoutUser: async ({ page }, use) => {
    await use(async () => {
      await logout(page.context().request)
    })
  },
})
