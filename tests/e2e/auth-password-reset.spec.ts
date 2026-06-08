/**
 * Password-reset E2E tests — "forgot password" + "reset password" guest flows.
 *
 * These cover everything that does NOT require capturing the emailed token:
 *  - the link from the login page
 *  - the generic anti-enumeration confirmation
 *  - the reset page with a missing token
 *  - the reset page with an invalid/expired token
 *
 * The full happy path (mint token → reset → login with new password) would need
 * a test-only route to expose a raw reset token; intentionally left out here.
 *
 * All flows are guest flows, so we override the global storageState.
 */

import { expect, test } from '../support/fixtures'
import { createPasswordResetToken } from '../support/helpers/api'

test.describe('Password reset (guest)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('login page links to the forgot-password page', async ({ page }) => {
    await page.goto('/login')

    // i18n-safe: en="Forgot password?", fr="Mot de passe oublié ?"
    await page.getByRole('link', { name: /forgot password|mot de passe oublié/i }).click()

    await expect(page).toHaveURL(/\/forgot-password/)
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('submitting an email shows the generic confirmation', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.locator('input[type="email"]').fill('nobody@battlecrm.test')

    const response = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/forgot-password') && resp.status() === 200,
    )
    await page.locator('button[type="submit"]').click()
    await response

    // Generic confirmation (en/fr) — identical whether or not the account exists
    await expect(
      page.getByText(/reset email|e-mail de réinitialisation|account exists|compte existe/i),
    ).toBeVisible()
  })

  test('reset page without a token shows the missing-token message', async ({ page }) => {
    await page.goto('/reset-password')

    await expect(
      page.getByText(/invalid or incomplete|invalide ou incomplet/i),
    ).toBeVisible()
    // No password field is rendered without a token
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })

  test('reset page with an invalid token shows an error on submit', async ({ page }) => {
    await page.goto('/reset-password?token=invalid-token-value')

    await page.locator('input[type="password"]').first().fill('NewPassword2@')
    await page.locator('input[type="password"]').nth(1).fill('NewPassword2@')

    const response = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/reset-password') && resp.status() === 400,
    )
    await page.locator('button[type="submit"]').click()
    await response

    await expect(
      page.locator('[role="alert"], .text-destructive').first(),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/reset-password/)
  })

  test('full happy path: minted token → reset → login with new password', async ({ page }) => {
    // Dedicated throwaway account so the shared worker users are never touched.
    const email = 'reset-flow-e2e@battlecrm.test'
    const newPassword = 'ResetFlowE2E123!'

    // Mint a real reset token via the test-only route (no inbox needed).
    const token = await createPasswordResetToken(page.context().request, email)

    await page.goto(`/reset-password?token=${token}`)
    await page.locator('input[type="password"]').first().fill(newPassword)
    await page.locator('input[type="password"]').nth(1).fill(newPassword)

    const resetResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/reset-password') && resp.status() === 200,
    )
    await page.locator('button[type="submit"]').click()
    await resetResponse

    // Redirected to login after a successful reset
    await expect(page).toHaveURL(/\/login/)

    // The new password works
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(newPassword)

    const loginResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/login') && resp.status() === 200,
    )
    await page.locator('button[type="submit"]').click()
    await loginResponse

    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
  })
})
