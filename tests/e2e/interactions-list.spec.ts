/**
 * Interactions - List View E2E tests (Story 5.5)
 *
 * Covers: navigation, display, row click opens drawer, edit, delete,
 *         all filter types (prospect, stage, positioning, date range),
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
  hardResetTestData,
  resetFunnelStages,
} from '../support/helpers/api'
test.describe('Interactions - List View', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    const stages = await getFunnelStages(context.request)

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

    await createInteraction(context.request, {
      prospect_id: prospectA.id,
      notes: 'Went well',
      positioning_id: positioning.id,
      interaction_date: '2024-06-15',
    })
    await createInteraction(context.request, {
      prospect_id: prospectB.id,
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

  test('shows count with no filters active', async ({ page }) => {
    await page.goto('/interactions')
    await expect(page.getByText('2 result(s)')).toBeVisible()
  })

  // ── Row click opens drawer ───────────────────────────────────────────────────

  test('clicking a row opens the detail drawer', async ({ page }) => {
    await page.goto('/interactions')
    await page.locator('tr').filter({ hasText: 'TL Prospect A' }).click()
    await expect(page).toHaveURL(/[?&]interaction=/)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  })

  test('pressing Escape closes the detail drawer', async ({ page }) => {
    await page.goto('/interactions')
    await page.locator('tr').filter({ hasText: 'TL Prospect A' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('clicking another row updates the drawer content', async ({ page }) => {
    await page.goto('/interactions')
    await page.locator('tr').filter({ hasText: 'TL Prospect A' }).click()
    await expect(page.locator('[data-slot="drawer-title"]')).toContainText('TL Prospect A')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await page.locator('tr').filter({ hasText: 'TL Prospect B' }).click()
    await expect(page.locator('[data-slot="drawer-title"]')).toContainText('TL Prospect B')
  })

  // ── Edit ─────────────────────────────────────────────────────────────────────

  test('clicking "Edit" enters edit mode with Save/Cancel buttons', async ({ page }) => {
    await page.goto('/interactions')
    await page.locator('tr').filter({ hasText: 'TL Prospect A' }).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })

  test('can update notes and save', async ({ page }) => {
    await page.goto('/interactions')
    await page.locator('tr').filter({ hasText: 'TL Prospect A' }).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.locator('textarea').fill('Updated notes text')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText('Interaction updated.')).toBeVisible()
  })

  test('can cancel edit without saving', async ({ page }) => {
    await page.goto('/interactions')
    await page.locator('tr').filter({ hasText: 'TL Prospect A' }).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.locator('textarea').fill('Unsaved change')
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /save/i })).not.toBeVisible()
  })

  // ── Delete ───────────────────────────────────────────────────────────────────

  test('clicking "Delete" shows a confirmation dialog', async ({ page }) => {
    await page.goto('/interactions')
    await page.locator('tr').filter({ hasText: 'TL Prospect B' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByText(/delete interaction\?/i)).toBeVisible()
  })

  // ── Filters ──────────────────────────────────────────────────────────────────

  test('stage filter shows only matching interactions', async ({ page }) => {
    await page.goto('/interactions')
    await page.getByPlaceholder(/all stages/i).click()
    await page.getByRole('option', { name: 'Prospect → À contacter' }).click()
    await expect(page.getByText('TL Prospect A')).toBeVisible()
    await expect(page.getByText('TL Prospect B')).not.toBeVisible()
  })

  test('positioning filter shows only matching interactions', async ({ page }) => {
    await page.goto('/interactions')
    await page.getByPlaceholder(/all positionings/i).click()
    await page.getByRole('option', { name: 'TL Positioning Alpha' }).click()
    await expect(page.getByText('TL Prospect A')).toBeVisible()
    await expect(page.getByText('TL Prospect B')).not.toBeVisible()
  })

  test('date range filter (client-side) narrows visible rows', async ({ page }) => {
    await page.goto('/interactions')
    await page.locator('input[type="date"]').first().fill('2024-01-01')
    await page.locator('input[type="date"]').last().fill('2024-12-31')
    await expect(page.getByText('TL Prospect A')).toBeVisible()
    await expect(page.getByText('TL Prospect B')).not.toBeVisible()
    await expect(page.getByText('1 result(s)')).toBeVisible()
  })

  test('"Clear filters" button resets all filters', async ({ page }) => {
    await page.goto('/interactions')
    await page.getByPlaceholder(/all stages/i).click()
    await page.getByRole('option', { name: 'Prospect → À contacter' }).click()
    await expect(page.getByRole('button', { name: /clear filters/i })).toBeVisible()
    await page.getByRole('button', { name: /clear filters/i }).click()
    await expect(page.getByText('TL Prospect A')).toBeVisible()
    await expect(page.getByText('TL Prospect B')).toBeVisible()
  })

  test('count shows "1 result(s)" with stage filter and with date range filter', async ({
    page,
  }) => {
    await page.goto('/interactions')
    await page.getByPlaceholder(/all stages/i).click()
    await page.getByRole('option', { name: 'Prospect → À contacter' }).click()
    await expect(page.getByText('1 result(s)')).toBeVisible()

    await page.getByRole('button', { name: /clear filters/i }).click()
    await page.locator('input[type="date"]').first().fill('2024-01-01')
    await page.locator('input[type="date"]').last().fill('2024-12-31')
    await expect(page.getByText('1 result(s)')).toBeVisible()
  })

  test('confirming delete removes interaction from list', async ({ page }) => {
    await page.goto('/interactions')
    await page.locator('tr').filter({ hasText: 'TL Prospect B' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Interaction deleted.')).toBeVisible()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.locator('tbody').getByText('TL Prospect B')).not.toBeVisible()
  })

  // ── Empty state ───────────────────────────────────────────────────────────────

  test('shows "No results." when list is empty', async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    const page = await context.newPage()
    await page.goto('/interactions')
    await expect(page.getByText('No results.')).toBeVisible()
    await context.close()
  })
})
