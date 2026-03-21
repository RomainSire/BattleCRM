/**
 * Interactions - Pre-fill & Quick Actions E2E tests (Story 5.4)
 *
 * Covers:
 *   AC3 — localStorage context saved after successful interaction creation
 *   AC2 — last positioning pre-filled on dialog re-open (per funnel stage)
 *   AC4 — quick-action "+" button visible on active rows, opens dialog with prospect pre-selected,
 *          does NOT expand the row, absent on archived rows
 *   AC5 — interaction can be logged in 3 clicks from list view
 *
 * AC1 (generic last-prospect pre-fill) is covered implicitly via AC3 localStorage check.
 * All tests run as authenticated user, serially.
 */

import { expect, test } from '../support/fixtures'
import {
  createPositioning,
  createProspect,
  getFunnelStages,
  hardResetTestData,
  resetFunnelStages,
} from '../support/helpers/api'
import { STORAGE_STATE } from '../../playwright.config'

test.describe('Interactions - Pre-fill & Quick Actions', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    const stages = await getFunnelStages(context.request)
    // Prospect in first stage (Lead qualified)
    await createProspect(context.request, {
      name: 'Pre-fill Prospect',
      funnel_stage_id: stages[0]?.id,
    })
    // Positioning for that same stage
    await createPositioning(context.request, {
      name: 'Pre-fill Positioning',
      funnel_stage_id: stages[0]?.id,
    })
    await context.close()
  })

  // ── AC4: Quick-action button presence ──────────────────────────────────────

  test('quick-action "Log Interaction" button is visible on each active prospect row', async ({
    page,
  }) => {
    await page.goto('/prospects')
    await expect(page.getByRole('button', { name: 'Log Interaction' }).first()).toBeVisible()
  })

  test('clicking "+" opens dialog with the prospect already pre-selected', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('button', { name: 'Log Interaction' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    // The prospect select should show the prospect's name (not the placeholder)
    await expect(page.getByRole('dialog')).toContainText('Pre-fill Prospect')
  })

  test('"+" button does NOT expand the prospect row', async ({ page }) => {
    await page.goto('/prospects')
    const row = page.locator('tr[aria-expanded]').filter({ hasText: 'Pre-fill Prospect' })
    await expect(row).toHaveAttribute('aria-expanded', 'false')
    await page.getByRole('button', { name: 'Log Interaction' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    // Row must still be collapsed
    await expect(row).toHaveAttribute('aria-expanded', 'false')
    await page.keyboard.press('Escape')
  })

  // ── AC5: 3-click interaction logging ───────────────────────────────────────

  test('can log an interaction in 3 clicks from list view', async ({ page }) => {
    await page.goto('/prospects')
    // Click 1: quick-action button
    await page.getByRole('button', { name: 'Log Interaction' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    // Click 2: select status
    await page.getByRole('radio', { name: 'Positive' }).click()
    // Click 3: save
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Interaction logged.')).toBeVisible()
  })

  // ── AC3: localStorage context saved after success ──────────────────────────

  test('saving an interaction stores lastProspectId in localStorage', async ({ page }) => {
    await page.goto('/prospects')
    // Clear localStorage before test
    await page.evaluate(() => {
      localStorage.removeItem('battlecrm_last_prospect_id')
      localStorage.removeItem('battlecrm_last_positioning_by_stage')
    })
    await page.getByRole('button', { name: 'Log Interaction' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('radio', { name: 'Positive' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Interaction logged.')).toBeVisible()

    const lastProspectId = await page.evaluate(() =>
      localStorage.getItem('battlecrm_last_prospect_id'),
    )
    expect(lastProspectId).toBeTruthy()
  })

  // ── AC2: positioning pre-fill on second open ───────────────────────────────

  test('positioning is pre-filled on dialog re-open after previous selection', async ({ page }) => {
    await page.goto('/prospects')
    // Clear localStorage to start fresh
    await page.evaluate(() => {
      localStorage.removeItem('battlecrm_last_prospect_id')
      localStorage.removeItem('battlecrm_last_positioning_by_stage')
    })

    // First interaction: select positioning explicitly, then save
    await page.getByRole('button', { name: 'Log Interaction' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Open the positioning select and choose "Pre-fill Positioning"
    await page.locator('#interaction-positioning').click()
    await page.getByRole('option', { name: 'Pre-fill Positioning' }).click()

    // Select status and save
    await page.getByRole('radio', { name: 'Positive' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Interaction logged.')).toBeVisible()

    // Second open: positioning should be pre-filled
    await page.getByRole('button', { name: 'Log Interaction' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.locator('#interaction-positioning')).toContainText('Pre-fill Positioning')
  })

  // ── AC4: archived prospects have no quick-action button ───────────────────

  test('archived prospect row does not show the quick-action button', async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    const stages = await getFunnelStages(context.request)
    const archived = await createProspect(context.request, {
      name: 'Archived Quick Action',
      funnel_stage_id: stages[0]?.id,
    })
    // Archive the prospect
    await context.request.delete(`http://localhost:3333/api/prospects/${archived.id}`)

    const page = await context.newPage()
    await page.goto('/prospects')
    await page.getByRole('switch', { name: /show archived/i }).click()

    const archivedRow = page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'Archived Quick Action' })
    await expect(archivedRow).toBeVisible()
    await expect(
      archivedRow.getByRole('button', { name: 'Log Interaction' }),
    ).not.toBeVisible()

    await context.close()
  })
})
