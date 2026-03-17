/**
 * Prospects - Archive & Restore E2E tests
 *
 * Covers: archive button, confirmation dialog, confirm/cancel archive,
 *         "Show archived" toggle, archived visual indicator, restore.
 * All tests run as authenticated user.
 *
 * Tests run serially (shared user account — state must be predictable).
 * beforeAll resets active prospects and creates 2 known test prospects.
 */

import { expect, test } from '../support/fixtures'
import { createProspect, resetFunnelStages, resetProspects } from '../support/helpers/api'
import { STORAGE_STATE } from '../../playwright.config'

test.describe('Prospects - Archive & Restore', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE })
    await resetFunnelStages(context.request)
    await resetProspects(context.request)
    await createProspect(context.request, { name: 'To Be Archived' })
    await createProspect(context.request, { name: 'Active Prospect' })
    await context.close()
  })

  // ── Archive button ──────────────────────────────────────────────────────────

  test('expanded active prospect shows Archive button', async ({ page }) => {
    await page.goto('/prospects')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'To Be Archived' })
      .first()
      .click()
    // Archive trigger button has aria-label="Archive To Be Archived" → use /archive/i (substring)
    await expect(page.locator('[aria-label*="Archive"]').first()).toBeVisible()
  })

  test('clicking Archive opens a confirmation dialog', async ({ page }) => {
    await page.goto('/prospects')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'To Be Archived' })
      .first()
      .click()
    await page.locator('[aria-label*="Archive"]').first().click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByRole('alertdialog')).toContainText('To Be Archived')
  })

  test('cancelling the archive dialog keeps the prospect in the list', async ({ page }) => {
    await page.goto('/prospects')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'To Be Archived' })
      .first()
      .click()
    await page.locator('[aria-label*="Archive"]').first().click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
    await expect(page.getByText('To Be Archived')).toBeVisible()
  })

  test('confirming archive removes prospect from active list — toast success', async ({ page }) => {
    await page.goto('/prospects')
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'To Be Archived' })
      .first()
      .click()
    await page.locator('[aria-label*="Archive"]').first().click()
    await expect(page.getByRole('alertdialog')).toBeVisible()

    const archiveResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/prospects') &&
        resp.request().method() === 'DELETE' &&
        resp.status() === 200,
    )
    // Confirm button inside alertdialog has text "Archive" (no aria-label override)
    await page.getByRole('alertdialog').getByRole('button', { name: /^archive$/i }).click()
    await archiveResponse

    await expect(page.getByText(/prospect archived/i)).toBeVisible()
    // Prospect no longer in default (active) list
    await expect(page.getByText('To Be Archived')).not.toBeVisible()
    // Other prospect unaffected
    await expect(page.getByText('Active Prospect')).toBeVisible()
  })

  // ── Show archived toggle ────────────────────────────────────────────────────

  test('"Show archived" toggle is visible and OFF by default', async ({ page }) => {
    await page.goto('/prospects')
    const toggle = page.getByRole('switch', { name: /show archived/i })
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('data-state', 'unchecked')
  })

  test('toggling "Show archived" ON reveals archived prospect', async ({ page }) => {
    await page.goto('/prospects')
    await expect(page.getByText('To Be Archived').first()).not.toBeVisible()
    await page.getByRole('switch', { name: /show archived/i }).click()
    await expect(page.getByText('To Be Archived').first()).toBeVisible()
  })

  // ── Archived visual indicator ───────────────────────────────────────────────

  test('archived prospect has "Archived" badge in the row', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('switch', { name: /show archived/i }).click()
    // The accordion row for "To Be Archived" should contain the badge text
    // exact: true to avoid matching "Archived" inside the prospect name "To Be Archived"
    const row = page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'To Be Archived' })
      .first()
    await expect(row.getByText('Archived', { exact: true })).toBeVisible()
  })

  // ── Restore ─────────────────────────────────────────────────────────────────

  test('archived prospect shows Restore button (no Archive button)', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('switch', { name: /show archived/i }).click()
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'To Be Archived' })
      .first()
      .click()
    // Restore visible, Archive trigger not rendered for archived prospects
    await expect(page.getByRole('button', { name: /^restore$/i })).toBeVisible()
    await expect(page.locator('[aria-label*="Archive"]')).not.toBeVisible()
  })

  test('restore brings prospect back to active list — toast success', async ({ page }) => {
    await page.goto('/prospects')
    await page.locator('#show-archived').click()
    await page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'To Be Archived' })
      .first()
      .click()

    const restoreResponse = page.waitForResponse(
      (resp) => resp.url().includes('/restore') && resp.status() === 200,
    )
    await page.getByRole('button', { name: /^restore$/i }).click()
    await restoreResponse

    await expect(page.getByText(/prospect restored/i)).toBeVisible()

    // Toggle archived OFF — restored prospect should be visible in active list
    await page.locator('#show-archived').click()
    await expect(page.getByText('To Be Archived')).toBeVisible()
  })
})
