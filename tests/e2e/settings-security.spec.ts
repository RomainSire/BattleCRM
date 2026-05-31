/**
 * Settings - Security (Change Password) E2E tests
 *
 * Covers: dialog open/close, client-side validation, server-side error, success flow.
 * All tests run as authenticated user (storageState from playwright.config.ts),
 * except the success test which uses an isolated session to preserve the shared
 * worker password for other test files.
 */

import { expect, test } from '../support/fixtures'
import { changePassword } from '../support/helpers/api'

const OLD_PASSWORD = process.env.E2E_TEST_PASSWORD || 'E2eTestPwd123!'
const NEW_PASSWORD = 'ChangedPwd999!'

test.describe('Settings - Change Password', () => {
  test('settings page shows the account section with change password button', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('button', { name: /change password/i })).toBeVisible()
  })

  test('clicking the button opens the change password dialog', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /change password/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText(/change password/i)
  })

  test('cancel button closes the dialog without submitting', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /change password/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByRole('button', { name: /cancel/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('shows client-side validation error when passwords do not match', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /change password/i }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/current password/i).fill('anypassword')
    await dialog.getByLabel(/^new password$/i).fill('ValidPass1!')
    await dialog.getByLabel(/confirm new password/i).fill('DifferentPass2!')

    await dialog.getByRole('button', { name: /confirm/i }).click()

    // Error visible, no API call made (client-side validation)
    await expect(dialog.locator('[data-error], .text-destructive').first()).toBeVisible()
    await expect(dialog).toBeVisible()
  })

  test('shows client-side validation error when new password is too short', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /change password/i }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/current password/i).fill('anypassword')
    await dialog.getByLabel(/^new password$/i).fill('short')
    await dialog.getByLabel(/confirm new password/i).fill('short')

    await dialog.getByRole('button', { name: /confirm/i }).click()

    await expect(dialog.locator('[data-error], .text-destructive').first()).toBeVisible()
    await expect(dialog).toBeVisible()
  })

  test('shows server-side error when current password is wrong', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /change password/i }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/current password/i).fill('WrongPassword999!')
    await dialog.getByLabel(/^new password$/i).fill('ValidNewPass1!')
    await dialog.getByLabel(/confirm new password/i).fill('ValidNewPass1!')

    const apiResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/auth/password') &&
        resp.request().method() === 'PUT' &&
        resp.status() !== 200,
    )
    await dialog.getByRole('button', { name: /confirm/i }).click()
    await apiResponse

    // Field error for currentPassword should appear
    await expect(dialog.locator('[data-error], .text-destructive').first()).toBeVisible()
    await expect(dialog).toBeVisible()
  })

  // Uses an isolated session so the shared worker session password is NOT changed.
  // Restores the original password via API after the test.
  test.describe('Success flow', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('changes password successfully and shows success toast', async ({
      page,
      loginAs,
    }) => {
      const workerEmail = `e2e-worker-0@battlecrm.test`
      await loginAs(workerEmail, OLD_PASSWORD)

      await page.goto('/settings')
      await page.getByRole('button', { name: /change password/i }).click()

      const dialog = page.getByRole('dialog')
      await dialog.getByLabel(/current password/i).fill(OLD_PASSWORD)
      await dialog.getByLabel(/^new password$/i).fill(NEW_PASSWORD)
      await dialog.getByLabel(/confirm new password/i).fill(NEW_PASSWORD)

      const apiResponse = page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/auth/password') &&
          resp.request().method() === 'PUT' &&
          resp.status() === 200,
      )
      await dialog.getByRole('button', { name: /confirm/i }).click()
      await apiResponse

      // Dialog should close after success
      await expect(page.getByRole('dialog')).not.toBeVisible()

      // Success toast should appear
      await expect(page.getByText(/password changed successfully/i)).toBeVisible()

      // Restore original password so auth.setup.ts can re-login on next run
      await changePassword(page.context().request, NEW_PASSWORD, OLD_PASSWORD)
    })
  })
})
