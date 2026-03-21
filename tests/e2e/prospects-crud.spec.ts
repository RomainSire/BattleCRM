/**
 * Prospects - Create & Edit E2E tests
 *
 * Covers: "Add Prospect" dialog, create form validation, create success,
 *         inline edit form (open, pre-fill, cancel, save).
 * All tests run as authenticated user.
 *
 * Tests run serially (shared user account — state must be predictable).
 * beforeAll resets prospects and creates one initial prospect for edit tests.
 */

import { expect, test } from '../support/fixtures'
import { createProspect, hardResetTestData, resetFunnelStages } from '../support/helpers/api'

test.describe('Prospects - Create & Edit', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    // Seed one prospect for edit tests
    await createProspect(context.request, {
      name: 'Initial Prospect',
      company: 'Test Corp',
      email: 'initial@test.com',
    })
    await context.close()
  })

  // ── Dialog open / close ─────────────────────────────────────────────────────

  test('"Add Prospect" button opens the create dialog', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('button', { name: /add prospect/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: /add prospect/i })).toBeVisible()
  })

  test('dialog closes on Cancel without creating a prospect', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('button', { name: /add prospect/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  // ── Validation ──────────────────────────────────────────────────────────────

  test('submitting create form without a name shows a validation error', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('button', { name: /add prospect/i }).click()
    // Submit immediately without filling name
    await page.getByRole('button', { name: /create prospect/i }).click()
    // FieldError renders as role="alert"
    await expect(page.getByRole('alert').first()).toBeVisible()
    // Dialog stays open
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  // ── Create ──────────────────────────────────────────────────────────────────

  test('creates a prospect with name only — toast success, appears in list', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('button', { name: /add prospect/i }).click()

    const dialog = page.getByRole('dialog')
    // Use id selector — label has aria-hidden "*" span which may interfere with getByLabel
    await dialog.locator('#prospect-name').fill('New Prospect E2E')

    await dialog.getByRole('button', { name: /create prospect/i }).click()

    // Dialog closes on success
    await expect(page.getByRole('dialog')).not.toBeVisible()
    // Toast success
    await expect(page.getByText(/prospect created/i)).toBeVisible()
    // New prospect appears in list
    await expect(page.getByText('New Prospect E2E')).toBeVisible()
  })

  test('created prospect is assigned to a funnel stage by default', async ({ page }) => {
    await page.goto('/prospects')
    // "New Prospect E2E" was created in previous test — it should show a stage name (not "—")
    const row = page.locator('tr[aria-expanded]').filter({ hasText: 'New Prospect E2E' })
    // The row should show a stage name — beforeAll seeds "Lead qualified" as the first stage
    await expect(row).toContainText('Lead qualified')
  })

  // ── Edit ────────────────────────────────────────────────────────────────────

  test('expanded active prospect shows "Edit" button', async ({ page }) => {
    await page.goto('/prospects')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'Initial Prospect' })
      .click()
    await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible()
  })

  test('clicking Edit opens inline form pre-filled with current values', async ({ page }) => {
    await page.goto('/prospects')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'Initial Prospect' })
      .click()
    await page.getByRole('button', { name: /^edit$/i }).click()

    // Save button appears (edit mode active)
    await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible()
    // Name field is pre-filled
    const nameInput = page.getByRole('textbox', { name: /^name/i })
    await expect(nameInput).toHaveValue('Initial Prospect')
  })

  test('cancel edit returns to read-only without saving changes', async ({ page }) => {
    await page.goto('/prospects')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'Initial Prospect' })
      .click()
    await page.getByRole('button', { name: /^edit$/i }).click()

    const nameInput = page.getByRole('textbox', { name: /^name/i })
    await nameInput.clear()
    await nameInput.fill('Should Not Be Saved')

    await page.getByRole('button', { name: /cancel/i }).click()

    // Edit form gone, original name still shown
    await expect(page.getByRole('button', { name: /^save$/i })).not.toBeVisible()
    await expect(page.getByText('Initial Prospect')).toBeVisible()
    await expect(page.getByText('Should Not Be Saved')).not.toBeVisible()
  })

  test('saving edit updates the prospect name — toast success', async ({ page }) => {
    await page.goto('/prospects')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'Initial Prospect' })
      .click()
    await page.getByRole('button', { name: /^edit$/i }).click()

    const nameInput = page.getByRole('textbox', { name: /^name/i })
    await nameInput.clear()
    await nameInput.fill('Updated Prospect Name')

    const updateResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/prospects') &&
        resp.request().method() === 'PUT' &&
        resp.status() === 200,
    )
    await page.getByRole('button', { name: /^save$/i }).click()
    await updateResponse

    // Toast success
    await expect(page.getByText(/prospect updated/i)).toBeVisible()
    // Read-only view restored with new name
    await expect(page.getByText('Updated Prospect Name')).toBeVisible()
    await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible()
  })
})
