/**
 * Extension smoke tests — verifies the BattleCRM extension loads correctly.
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
 *
 * ## Status
 *
 *   These tests are intentionally minimal skeletons — the extension workspace
 *   (apps/extension/) does not exist yet (Story 7.3). The fixture and project
 *   configuration are ready; tests will be filled in during Story 7.3–7.6.
 *
 *   Story 7.1 — extensionLoginAs becomes usable (Bearer token endpoint)
 *   Story 7.3 — popup/panel pages exist → smoke tests can assert real UI
 *   Story 7.4 — auth UI tests
 *   Story 7.5 — badge tests (requires mock LinkedIn page)
 *   Story 7.6 — panel add/edit form tests
 */

import { test, expect } from '../support/fixtures/extension-fixture'

test.describe.configure({ mode: 'serial' })

test.describe('Extension — load & popup', () => {
  test('extension service worker is registered', async ({ extensionId }) => {
    // If we reach this line the fixture successfully obtained the extension ID
    // from the service worker URL — the extension is loaded.
    expect(extensionId).toMatch(/^[a-z]{32}$/)
  })

  test.skip('popup page loads (Story 7.3)', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup/index.html`)
    // After Story 7.4: unauthenticated state → login form should be visible
    await expect(page.getByRole('button', { name: /connect|login/i })).toBeVisible()
  })

  test.skip('panel page loads (Story 7.3)', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/panel/index.html`)
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Extension — Bearer token auth (Story 7.1)', () => {
  test.skip('login with valid credentials returns token', async ({ extensionLoginAs }) => {
    // Replace with actual E2E worker credentials once Story 7.1 is done
    const token = await extensionLoginAs('e2e-worker-0@battlecrm.test', 'password')
    expect(token).toBeTruthy()
  })

  test.skip('login with invalid credentials throws', async ({ extensionLoginAs }) => {
    await expect(
      extensionLoginAs('invalid@example.com', 'wrong'),
    ).rejects.toThrow('401')
  })
})
