/**
 * Settings - Funnel Configuration E2E tests
 *
 * Covers: navigation, list display, add stage, inline edit, delete with confirmation.
 * All tests run as authenticated user (storageState from playwright.config.ts).
 * Drag-and-drop reorder is not covered (hard to automate reliably with DnD).
 *
 * Tests run serially (shared user account — state must be predictable).
 * beforeAll resets funnel stages to a known 3-stage set before the suite runs.
 */

import { expect, test } from '../support/fixtures'
import { resetFunnelStages } from '../support/helpers/api'
import { STORAGE_STATE } from '../../playwright.config'

test.describe('Settings - Funnel Configuration', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    // Use a fresh browser context with the E2E auth session to reset stages via API
    const context = await browser.newContext({ storageState: STORAGE_STATE })
    await resetFunnelStages(context.request)
    await context.close()
  })

  test('navigates to settings page via navbar', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /user menu/i }).click()
    await page.getByRole('menuitem', { name: /settings/i }).click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
  })

  test('settings page shows funnel configuration section', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /funnel configuration/i })).toBeVisible()
  })

  test('shows default funnel stages seeded on registration', async ({ page }) => {
    await page.goto('/settings')
    // Default stages are seeded when a new user registers (Story 2.1)
    await expect(page.getByText('Lead qualified')).toBeVisible()
  })

  test('can add a new stage', async ({ page }) => {
    await page.goto('/settings')

    await page.getByRole('button', { name: /add stage/i }).click()

    const stageName = `Test Stage ${Date.now()}`
    await page.getByPlaceholder(/stage name/i).fill(stageName)

    // Intercept BEFORE submit (network-first pattern)
    const addResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/funnel_stages') && resp.status() === 201,
    )
    await page.getByRole('button', { name: /^add$/i }).click()
    await addResponse

    await expect(page.getByText(stageName)).toBeVisible()
  })

  test('can cancel adding a stage with Escape', async ({ page }) => {
    await page.goto('/settings')

    await page.getByRole('button', { name: /add stage/i }).click()
    await page.getByPlaceholder(/stage name/i).fill('Should not be saved')
    await page.keyboard.press('Escape')

    // The "Add Stage" button should be visible again (form closed)
    await expect(page.getByRole('button', { name: /add stage/i })).toBeVisible()
    await expect(page.getByText('Should not be saved')).not.toBeVisible()
  })

  test('can edit a stage name inline', async ({ page }) => {
    await page.goto('/settings')

    // Click edit on the first stage
    await page.locator('[aria-label="Edit stage"]').first().click()

    const input = page.locator('input[aria-label="Stage name"]').first()
    await input.clear()
    await input.fill('Renamed Stage')

    const updateResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/funnel_stages') &&
        resp.request().method() === 'PUT' &&
        resp.status() === 200,
    )
    await page.locator('[aria-label="Save stage name"]').first().click()
    await updateResponse

    await expect(page.getByText('Renamed Stage')).toBeVisible()
  })

  test('can cancel inline edit with Escape', async ({ page }) => {
    await page.goto('/settings')

    // Get the name of the first stage before editing
    const firstStageName = await page.locator('[data-stage-name]').first().getAttribute('data-stage-name')

    await page.locator('[aria-label="Edit stage"]').first().click()

    const input = page.locator('input[aria-label="Stage name"]').first()
    await input.clear()
    await input.fill('This change should be discarded')
    await page.keyboard.press('Escape')

    // Original name should still be visible
    if (firstStageName) {
      await expect(page.getByText(firstStageName)).toBeVisible()
    }
    await expect(page.getByText('This change should be discarded')).not.toBeVisible()
  })

  test('can delete a stage with confirmation dialog', async ({ page }) => {
    await page.goto('/settings')

    // Create a dedicated stage to delete (avoids test interdependence)
    const stageName = `Delete Me ${Date.now()}`
    await page.getByRole('button', { name: /add stage/i }).click()
    await page.getByPlaceholder(/stage name/i).fill(stageName)

    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/funnel_stages') && resp.status() === 201,
    )
    await page.getByRole('button', { name: /^add$/i }).click()
    await createResponse

    await expect(page.getByText(stageName)).toBeVisible()

    // Click delete on the newly created stage row
    const stageRow = page.locator(`[data-stage-name="${stageName}"]`)
    await stageRow.getByRole('button', { name: /delete stage/i }).click()

    // Confirmation dialog should appear
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByRole('alertdialog')).toContainText(stageName)

    const deleteResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/funnel_stages') && resp.request().method() === 'DELETE',
    )
    await page.getByRole('button', { name: /^delete$/i }).click()
    await deleteResponse

    await expect(page.locator(`[data-stage-name="${stageName}"]`)).not.toBeVisible()
  })

  test('cancel delete confirmation keeps the stage', async ({ page }) => {
    await page.goto('/settings')

    // Use the first stage row
    const firstStageRow = page.locator('[data-stage-name]').first()
    const stageName = await firstStageRow.getAttribute('data-stage-name')

    await firstStageRow.getByRole('button', { name: /delete stage/i }).click()

    // Confirmation dialog appears
    await expect(page.getByRole('alertdialog')).toBeVisible()

    // Cancel — stage should NOT be deleted
    await page.getByRole('button', { name: /cancel/i }).click()

    // Wait for dialog to close, then check the stage row is still present
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
    if (stageName) {
      await expect(page.locator(`[data-stage-name="${stageName}"]`)).toBeVisible()
    }
  })
})
