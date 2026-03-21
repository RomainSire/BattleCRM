/**
 * Positionings - Create & Edit E2E tests (Story 4.4)
 *
 * Covers: "Add Positioning" dialog (open/close, validation, create success),
 *         inline edit form (open, pre-fill, cancel, save).
 * All tests run as authenticated user.
 *
 * Tests run serially (shared user account — state must be predictable).
 * beforeAll resets positionings and creates one initial positioning for edit tests.
 */

import { expect, test } from '../support/fixtures'
import { createPositioning, hardResetTestData, resetFunnelStages } from '../support/helpers/api'
import { STORAGE_STATE } from '../../playwright.config'

test.describe('Positionings - Create & Edit', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    // Seed one positioning for edit tests
    await createPositioning(context.request, {
      name: 'Initial Positioning',
      description: 'Initial description',
    })
    await context.close()
  })

  // ── Dialog open / close ─────────────────────────────────────────────────────

  test('"Add Positioning" button opens the create dialog', async ({ page }) => {
    await page.goto('/positionings')
    await page.getByRole('button', { name: /add positioning/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: /add positioning/i })).toBeVisible()
  })

  test('dialog closes on Cancel without creating a positioning', async ({ page }) => {
    await page.goto('/positionings')
    await page.getByRole('button', { name: /add positioning/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  // ── Validation ──────────────────────────────────────────────────────────────

  test('submitting create form without a name shows a validation error', async ({ page }) => {
    await page.goto('/positionings')
    await page.getByRole('button', { name: /add positioning/i }).click()
    // Clear the name field and submit
    await page.locator('#positioning-name').clear()
    await page.getByRole('button', { name: /^create$/i }).click()
    // FieldError renders as role="alert"
    await expect(page.getByRole('alert').first()).toBeVisible()
    // Dialog stays open
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  // ── Create ──────────────────────────────────────────────────────────────────

  test('creates a positioning with name only — toast success, appears in list', async ({
    page,
  }) => {
    await page.goto('/positionings')
    await page.getByRole('button', { name: /add positioning/i }).click()

    const dialog = page.getByRole('dialog')
    await dialog.locator('#positioning-name').fill('New Positioning E2E')

    await dialog.getByRole('button', { name: /^create$/i }).click()

    // Dialog closes on success
    await expect(page.getByRole('dialog')).not.toBeVisible()
    // Toast success
    await expect(page.getByText(/positioning created/i)).toBeVisible()
    // New positioning appears in list
    await expect(page.getByText('New Positioning E2E')).toBeVisible()
  })

  test('created positioning is assigned to a funnel stage by default', async ({ page }) => {
    await page.goto('/positionings')
    const row = page.locator('tr[aria-expanded]').filter({ hasText: 'New Positioning E2E' })
    await expect(row).toContainText('Lead qualified')
  })

  // ── Edit ────────────────────────────────────────────────────────────────────

  test('expanded active positioning shows "Edit" button', async ({ page }) => {
    await page.goto('/positionings')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'Initial Positioning' })
      .click()
    await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible()
  })

  test('clicking Edit opens inline form pre-filled with current values', async ({ page }) => {
    await page.goto('/positionings')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'Initial Positioning' })
      .click()
    await page.getByRole('button', { name: /^edit$/i }).click()

    // Save button appears (edit mode active)
    await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible()
    // Name field is pre-filled
    const nameInput = page.locator('input[id^="edit-name-"]')
    await expect(nameInput).toHaveValue('Initial Positioning')
  })

  test('cancel edit returns to read-only without saving changes', async ({ page }) => {
    await page.goto('/positionings')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'Initial Positioning' })
      .click()
    await page.getByRole('button', { name: /^edit$/i }).click()

    const nameInput = page.locator('input[id^="edit-name-"]')
    await nameInput.clear()
    await nameInput.fill('Should Not Be Saved')

    await page.getByRole('button', { name: /cancel/i }).click()

    // Edit form gone, original name still shown
    await expect(page.getByRole('button', { name: /^save$/i })).not.toBeVisible()
    await expect(page.getByText('Initial Positioning')).toBeVisible()
    await expect(page.getByText('Should Not Be Saved')).not.toBeVisible()
  })

  test('saving edit updates the positioning name — toast success', async ({ page }) => {
    await page.goto('/positionings')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'Initial Positioning' })
      .click()
    await page.getByRole('button', { name: /^edit$/i }).click()

    const nameInput = page.locator('input[id^="edit-name-"]')
    await nameInput.clear()
    await nameInput.fill('Updated Positioning Name')

    const updateResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/positionings') &&
        resp.request().method() === 'PUT' &&
        resp.status() === 200,
    )
    await page.getByRole('button', { name: /^save$/i }).click()
    await updateResponse

    // Toast success
    await expect(page.getByText(/positioning updated/i)).toBeVisible()
    // Read-only view restored with new name
    await expect(page.getByText('Updated Positioning Name')).toBeVisible()
    await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible()
  })
})
