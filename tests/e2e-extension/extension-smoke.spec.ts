/**
 * Extension smoke tests — verifies the extension loads and the popup is reachable.
 *
 * ## Before running
 *
 *   1. Build the extension:   pnpm build:extension
 *   2. Start the backend:     cd apps/backend && ENV_PATH=../../ node ace serve --hmr
 *   3. Run:                   pnpm test:e2e:extension
 *
 * ## CI
 *
 *   Extensions require a display server. Wrap with xvfb-run:
 *     xvfb-run pnpm test:e2e:extension
 */

import { expect, test } from '../support/fixtures/extension-fixture'

test.describe.configure({ mode: 'serial' })

test.describe('Extension — smoke', () => {
  test('service worker is registered and extension ID is stable', async ({ extensionId }) => {
    expect(extensionId).toMatch(/^[a-z]{32}$/)
  })

  test('popup page loads with login form', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    // Unauthenticated — should show AuthForm
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
  })
})
