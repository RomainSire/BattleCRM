/**
 * Positionings - Archive & Restore E2E tests (Story 4.5 + restore feature)
 *
 * Covers: archive button, confirmation dialog, confirm/cancel archive,
 *         "Show archived" toggle, archived visual indicator (badge, strikethrough),
 *         restore button, restore flow.
 * All tests run as authenticated user.
 *
 * Tests run serially (shared user account — state must be predictable).
 * beforeAll resets positionings and creates 2 known test positionings.
 */

import { expect, test } from '../support/fixtures'
import { createPositioning, hardResetTestData, resetFunnelStages } from '../support/helpers/api'

test.describe('Positionings - Archive & Restore', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    await createPositioning(context.request, { name: 'To Be Archived' })
    await createPositioning(context.request, { name: 'Active Positioning' })
    await context.close()
  })

  // ── Archive button ──────────────────────────────────────────────────────────

  test('expanded active positioning shows Archive button', async ({ page }) => {
    await page.goto('/positionings')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'To Be Archived' })
      .click()
    await expect(page.getByRole('button', { name: /^archive$/i })).toBeVisible()
  })

  test('clicking Archive opens a confirmation dialog', async ({ page }) => {
    await page.goto('/positionings')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'To Be Archived' })
      .click()
    await page.getByRole('button', { name: /^archive$/i }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByRole('alertdialog')).toContainText('To Be Archived')
  })

  test('cancelling the archive dialog keeps the positioning in the list', async ({ page }) => {
    await page.goto('/positionings')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'To Be Archived' })
      .click()
    await page.getByRole('button', { name: /^archive$/i }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
    await expect(page.getByText('To Be Archived')).toBeVisible()
  })

  test('confirming archive removes positioning from active list — toast success', async ({
    page,
  }) => {
    await page.goto('/positionings')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'To Be Archived' })
      .click()
    await page.getByRole('button', { name: /^archive$/i }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()

    const archiveResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/positionings') &&
        resp.request().method() === 'DELETE' &&
        resp.status() === 200,
    )
    await page.getByRole('alertdialog').getByRole('button', { name: /^archive$/i }).click()
    await archiveResponse

    await expect(page.getByText(/positioning archived/i)).toBeVisible()
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
    // Positioning no longer in default (active) list
    await expect(page.locator('table').getByText('To Be Archived')).not.toBeVisible()
    // Other positioning unaffected
    await expect(page.getByText('Active Positioning')).toBeVisible()
  })

  // ── Show archived toggle ────────────────────────────────────────────────────

  test('"Show archived" toggle is visible and OFF by default', async ({ page }) => {
    await page.goto('/positionings')
    const toggle = page.getByRole('switch', { name: /show archived/i })
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('data-state', 'unchecked')
  })

  test('toggling "Show archived" ON reveals archived positioning', async ({ page }) => {
    await page.goto('/positionings')
    await expect(page.getByText('To Be Archived')).not.toBeVisible()
    await page.getByRole('switch', { name: /show archived/i }).click()
    await expect(page.getByText('To Be Archived')).toBeVisible()
  })

  // ── Archived visual indicator ───────────────────────────────────────────────

  test('archived positioning has "Archived" badge in the row', async ({ page }) => {
    await page.goto('/positionings')
    await page.getByRole('switch', { name: /show archived/i }).click()
    const row = page.locator('tr[aria-expanded]').filter({ hasText: 'To Be Archived' })
    await expect(row.getByText('Archived', { exact: true })).toBeVisible()
  })

  // ── Restore ─────────────────────────────────────────────────────────────────

  test('archived positioning shows Restore button (no Archive button)', async ({ page }) => {
    await page.goto('/positionings')
    await page.getByRole('switch', { name: /show archived/i }).click()
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'To Be Archived' })
      .click()
    // Restore visible, Archive not rendered for archived positionings
    await expect(page.getByRole('button', { name: /^restore$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^archive$/i })).not.toBeVisible()
  })

  test('restore brings positioning back to active list — toast success', async ({ page }) => {
    await page.goto('/positionings')
    await page.getByRole('switch', { name: /show archived/i }).click()
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'To Be Archived' })
      .click()

    const restoreResponse = page.waitForResponse(
      (resp) => resp.url().includes('/restore') && resp.status() === 200,
    )
    await page.getByRole('button', { name: /^restore$/i }).click()
    await restoreResponse

    await expect(page.getByText(/positioning restored/i)).toBeVisible()

    // Toggle archived OFF — restored positioning should be visible in active list
    await page.getByRole('switch', { name: /show archived/i }).click()
    await expect(page.getByText('To Be Archived')).toBeVisible()
  })
})
