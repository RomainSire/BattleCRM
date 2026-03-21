/**
 * Interactions - List View E2E tests (Story 5.5)
 *
 * Covers: navigation, display, row expand/collapse, edit, archive/restore,
 *         all filter types (status, prospect, stage, positioning, date range),
 *         clear filters, count display (client-side vs server-side filtering).
 *
 * All tests run as authenticated user, serially.
 * beforeAll resets and seeds 2 prospects + 1 positioning + 2 interactions.
 */

import { expect, test } from '../support/fixtures'
import {
  createInteraction,
  createPositioning,
  createProspect,
  getFunnelStages,
  resetFunnelStages,
  resetInteractions,
  resetPositionings,
  resetProspects,
} from '../support/helpers/api'
import { STORAGE_STATE } from '../../playwright.config'

test.describe('Interactions - List View', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE })
    await resetFunnelStages(context.request)
    await resetPositionings(context.request)
    await resetProspects(context.request)
    await resetInteractions(context.request)
    const stages = await getFunnelStages(context.request)

    // Prospect A: Lead qualified (stage 0) — positive interaction + positioning
    // Prospect B: Linkedin connection (stage 1) — negative interaction, no positioning
    const prospectA = await createProspect(context.request, {
      name: 'TL Prospect A',
      funnel_stage_id: stages[0]?.id,
    })
    const prospectB = await createProspect(context.request, {
      name: 'TL Prospect B',
      funnel_stage_id: stages[1]?.id ?? stages[0]?.id,
    })
    const positioning = await createPositioning(context.request, {
      name: 'TL Positioning Alpha',
      funnel_stage_id: stages[0]?.id,
    })

    // Interaction A: known past date — used for client-side date range filter test
    await createInteraction(context.request, {
      prospect_id: prospectA.id,
      status: 'positive',
      notes: 'Went well',
      positioning_id: positioning.id,
      interaction_date: '2024-06-15',
    })
    // Interaction B: today's date (default)
    await createInteraction(context.request, {
      prospect_id: prospectB.id,
      status: 'negative',
      notes: 'No answer',
    })
    await context.close()
  })

  // ── Navigation ──────────────────────────────────────────────────────────────

  test('navigates to /interactions via navbar link', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /interactions/i }).click()
    await expect(page).toHaveURL(/\/interactions/)
  })

  test('shows "Interactions" heading and "Log Interaction" button', async ({ page }) => {
    await page.goto('/interactions')
    await expect(page.getByRole('heading', { name: /^interactions$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /log interaction/i })).toBeVisible()
  })

  // ── List display ────────────────────────────────────────────────────────────

  test('shows seeded interactions in the table', async ({ page }) => {
    await page.goto('/interactions')
    await expect(page.getByText('TL Prospect A')).toBeVisible()
    await expect(page.getByText('TL Prospect B')).toBeVisible()
  })

  test('shows count "2 / 2" with no filters active', async ({ page }) => {
    await page.goto('/interactions')
    await expect(page.getByText('2 / 2')).toBeVisible()
  })

  // ── Row expand / collapse ───────────────────────────────────────────────────

  test('clicking a row expands the detail panel', async ({ page }) => {
    await page.goto('/interactions')
    const row = page.locator('tr[aria-expanded]').filter({ hasText: 'TL Prospect A' })
    await expect(row).toHaveAttribute('aria-expanded', 'false')
    await row.click()
    await expect(row).toHaveAttribute('aria-expanded', 'true')
    // Edit button visible in expanded panel
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  })

  test('clicking an expanded row collapses it', async ({ page }) => {
    await page.goto('/interactions')
    const row = page.locator('tr[aria-expanded]').filter({ hasText: 'TL Prospect A' })
    await row.click()
    await expect(row).toHaveAttribute('aria-expanded', 'true')
    await row.click()
    await expect(row).toHaveAttribute('aria-expanded', 'false')
  })

  test('only one row can be expanded at a time', async ({ page }) => {
    await page.goto('/interactions')
    const rowA = page.locator('tr[aria-expanded]').filter({ hasText: 'TL Prospect A' })
    const rowB = page.locator('tr[aria-expanded]').filter({ hasText: 'TL Prospect B' })
    await rowA.click()
    await expect(rowA).toHaveAttribute('aria-expanded', 'true')
    await rowB.click()
    await expect(rowB).toHaveAttribute('aria-expanded', 'true')
    await expect(rowA).toHaveAttribute('aria-expanded', 'false')
  })

  // ── Edit ─────────────────────────────────────────────────────────────────────

  test('clicking "Edit" enters edit mode with Save/Cancel buttons', async ({ page }) => {
    await page.goto('/interactions')
    const row = page.locator('tr[aria-expanded]').filter({ hasText: 'TL Prospect A' })
    await row.click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })

  test('can update notes and save', async ({ page }) => {
    await page.goto('/interactions')
    const row = page.locator('tr[aria-expanded]').filter({ hasText: 'TL Prospect A' })
    await row.click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.locator('textarea').fill('Updated notes text')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText('Interaction updated.')).toBeVisible()
  })

  test('can cancel edit without saving', async ({ page }) => {
    await page.goto('/interactions')
    const row = page.locator('tr[aria-expanded]').filter({ hasText: 'TL Prospect A' })
    await row.click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.locator('textarea').fill('Unsaved change')
    await page.getByRole('button', { name: /cancel/i }).click()
    // Back to read-only: Edit visible, Save gone
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /save/i })).not.toBeVisible()
  })

  // ── Archive / Restore ────────────────────────────────────────────────────────

  test('clicking "Archive" shows a confirmation dialog', async ({ page }) => {
    await page.goto('/interactions')
    const row = page.locator('tr[aria-expanded]').filter({ hasText: 'TL Prospect B' })
    await row.click()
    await page.getByRole('button', { name: 'Archive', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByText(/archive interaction\?/i)).toBeVisible()
  })

  test('confirming archive removes interaction from default list', async ({ page }) => {
    await page.goto('/interactions')
    const row = page.locator('tr[aria-expanded]').filter({ hasText: 'TL Prospect B' })
    await row.click()
    await page.getByRole('button', { name: 'Archive', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click()
    await expect(page.getByText('Interaction archived.')).toBeVisible()
    await expect(page.getByText('TL Prospect B')).not.toBeVisible()
  })

  test('"Show archived" switch reveals archived interaction with "Archived" badge', async ({
    page,
  }) => {
    await page.goto('/interactions')
    await page.getByRole('switch', { name: /show archived/i }).click()
    const row = page.locator('tr[aria-expanded]').filter({ hasText: 'TL Prospect B' })
    await expect(row).toBeVisible()
    await expect(row.getByText('Archived')).toBeVisible()
  })

  test('archived interaction shows "Restore" button, not Edit or Archive', async ({ page }) => {
    await page.goto('/interactions')
    await page.getByRole('switch', { name: /show archived/i }).click()
    const row = page.locator('tr[aria-expanded]').filter({ hasText: 'TL Prospect B' })
    await row.click()
    await expect(page.getByRole('button', { name: /restore/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).not.toBeVisible()
  })

  test('clicking "Restore" restores the interaction', async ({ page }) => {
    await page.goto('/interactions')
    await page.getByRole('switch', { name: /show archived/i }).click()
    const row = page.locator('tr[aria-expanded]').filter({ hasText: 'TL Prospect B' })
    await row.click()
    await page.getByRole('button', { name: /restore/i }).click()
    await expect(page.getByText('Interaction restored.')).toBeVisible()
    // Interaction visible again in default view
    await page.getByRole('switch', { name: /show archived/i }).click()
    await expect(page.getByText('TL Prospect B')).toBeVisible()
    await expect(page.getByText('2 / 2')).toBeVisible()
  })

  // ── Filters ──────────────────────────────────────────────────────────────────

  test('status filter shows only matching interactions', async ({ page }) => {
    await page.goto('/interactions')
    // Status combobox is uniquely identified by "All statuses" default text
    await page.getByRole('combobox').filter({ hasText: 'All statuses' }).click()
    await page.getByRole('option', { name: /positive/i }).click()
    await expect(page.getByText('TL Prospect A')).toBeVisible()
    await expect(page.getByText('TL Prospect B')).not.toBeVisible()
  })

  test('prospect filter shows only matching interactions', async ({ page }) => {
    await page.goto('/interactions')
    await page.getByRole('combobox').filter({ hasText: 'All prospects' }).click()
    await page.getByRole('option', { name: 'TL Prospect B' }).click()
    await expect(page.getByText('TL Prospect B')).toBeVisible()
    await expect(page.getByText('TL Prospect A')).not.toBeVisible()
  })

  test('stage filter shows only matching interactions', async ({ page }) => {
    await page.goto('/interactions')
    // Lead qualified = stage 0 = TL Prospect A's stage
    await page.getByRole('combobox').filter({ hasText: 'All stages' }).click()
    await page.getByRole('option', { name: 'Lead qualified' }).click()
    await expect(page.getByText('TL Prospect A')).toBeVisible()
    await expect(page.getByText('TL Prospect B')).not.toBeVisible()
  })

  test('positioning filter shows only matching interactions', async ({ page }) => {
    await page.goto('/interactions')
    // Positioning combobox in the top bar
    await page.getByRole('combobox').filter({ hasText: 'All positionings' }).click()
    await page.getByRole('option', { name: 'TL Positioning Alpha' }).click()
    await expect(page.getByText('TL Prospect A')).toBeVisible()
    await expect(page.getByText('TL Prospect B')).not.toBeVisible()
  })

  test('date range filter (client-side) narrows visible rows', async ({ page }) => {
    await page.goto('/interactions')
    // TL Prospect A has interaction_date 2024-06-15; TL Prospect B has today's date
    // Setting a range within 2024 should show only A, but server still returns both (total=2)
    await page.locator('input[type="date"]').first().fill('2024-01-01')
    await page.locator('input[type="date"]').last().fill('2024-12-31')
    await expect(page.getByText('TL Prospect A')).toBeVisible()
    await expect(page.getByText('TL Prospect B')).not.toBeVisible()
    // "1 / 2" — 1 visible after client filter, 2 total from server
    await expect(page.getByText('1 / 2')).toBeVisible()
  })

  test('"Clear filters" button resets all filters', async ({ page }) => {
    await page.goto('/interactions')
    // Apply a server-side filter
    await page.getByRole('combobox').filter({ hasText: 'All statuses' }).click()
    await page.getByRole('option', { name: /positive/i }).click()
    await expect(page.getByRole('button', { name: /clear filters/i })).toBeVisible()
    await page.getByRole('button', { name: /clear filters/i }).click()
    // Both interactions visible again
    await expect(page.getByText('TL Prospect A')).toBeVisible()
    await expect(page.getByText('TL Prospect B')).toBeVisible()
  })

  test('count shows "1 / 1" with server-side filter, "1 / 2" with date range filter', async ({
    page,
  }) => {
    await page.goto('/interactions')
    // Server-side filter (status): API returns 1 → "1 / 1"
    await page.getByRole('combobox').filter({ hasText: 'All statuses' }).click()
    await page.getByRole('option', { name: /positive/i }).click()
    await expect(page.getByText('1 / 1')).toBeVisible()

    // Clear and apply date range (client-side): API returns 2, client shows 1 → "1 / 2"
    await page.getByRole('button', { name: /clear filters/i }).click()
    await page.locator('input[type="date"]').first().fill('2024-01-01')
    await page.locator('input[type="date"]').last().fill('2024-12-31')
    await expect(page.getByText('1 / 2')).toBeVisible()
  })

  // ── Empty state ───────────────────────────────────────────────────────────────

  test('shows "No interactions logged yet." when list is empty', async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE })
    await resetInteractions(context.request)
    const page = await context.newPage()
    await page.goto('/interactions')
    await expect(page.getByText(/no interactions logged yet/i)).toBeVisible()
    await context.close()
  })
})
