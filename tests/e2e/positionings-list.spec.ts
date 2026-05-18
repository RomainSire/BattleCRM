/**
 * Positionings - List View E2E tests (Story 4.3)
 *
 * Covers: navigation, list display, stage filter, row click opens drawer,
 *         drawer detail panel (stage, description, linked prospects, interactions),
 *         empty state, empty-filtered state.
 * All tests run as authenticated user.
 *
 * Tests run serially (shared user account — state must be predictable).
 * beforeAll resets positionings, creates 2 known positionings in different stages.
 */

import { expect, test } from '../support/fixtures'
import {
  createPositioning,
  getFunnelStages,
  hardResetTestData,
  resetFunnelStages,
} from '../support/helpers/api'
test.describe('Positionings - List View', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    const stages = await getFunnelStages(context.request)
    // CV Alpha in stage 0, CV Beta in stage 1
    await createPositioning(context.request, {
      name: 'CV Alpha',
      funnel_stage_id: stages[0]?.id,
      description: 'Alpha description',
      content: 'Alpha content',
    })
    await createPositioning(context.request, {
      name: 'CV Beta',
      funnel_stage_id: stages[1]?.id ?? stages[0]?.id,
    })
    await context.close()
  })

  // ── Navigation ──────────────────────────────────────────────────────────────

  test('navigates to /positionings via navbar link', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /positionings/i }).click()
    await expect(page).toHaveURL(/\/positionings/)
  })

  test('shows "Positionings" heading on /positionings', async ({ page }) => {
    await page.goto('/positionings')
    await expect(page.getByRole('heading', { name: /^positionings$/i })).toBeVisible()
  })

  // ── List display ────────────────────────────────────────────────────────────

  test('shows seeded positionings in list', async ({ page }) => {
    await page.goto('/positionings')
    await expect(page.getByText('CV Alpha')).toBeVisible()
    await expect(page.getByText('CV Beta')).toBeVisible()
  })

  test('shows "Add Positioning" button', async ({ page }) => {
    await page.goto('/positionings')
    await expect(page.getByRole('button', { name: /add positioning/i })).toBeVisible()
  })

  test('shows funnel stage filter select', async ({ page }) => {
    await page.goto('/positionings')
    await expect(page.getByRole('combobox')).toBeVisible()
  })

  test('shows "Show archived" switch', async ({ page }) => {
    await page.goto('/positionings')
    await expect(page.getByRole('switch', { name: /show archived/i })).toBeVisible()
  })

  // ── Stage filter ────────────────────────────────────────────────────────────

  test('selecting a stage filter updates the select value', async ({ page }) => {
    await page.goto('/positionings')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Lead qualified' }).click()
    await expect(page.getByRole('combobox')).toContainText('Lead qualified')
  })

  test('stage filter shows only matching positionings', async ({ page }) => {
    await page.goto('/positionings')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Lead qualified' }).click()
    await expect(page.getByText('CV Alpha')).toBeVisible()
    await expect(page.getByText('CV Beta')).not.toBeVisible()
  })

  test('"Clear filter" button resets the stage filter', async ({ page }) => {
    await page.goto('/positionings')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Lead qualified' }).click()
    await expect(page.getByRole('button', { name: /clear filter/i })).toBeVisible()
    await page.getByRole('button', { name: /clear filter/i }).click()
    await expect(page.getByText('CV Alpha')).toBeVisible()
    await expect(page.getByText('CV Beta')).toBeVisible()
  })

  test('selecting "All stages" in the select resets the filter', async ({ page }) => {
    await page.goto('/positionings')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Lead qualified' }).click()
    await expect(page.getByText('CV Beta')).not.toBeVisible()
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: /all stages/i }).click()
    await expect(page.getByText('CV Beta')).toBeVisible()
  })

  // ── Row click opens drawer ───────────────────────────────────────────────────

  test('clicking a row opens the detail drawer', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('tr').filter({ hasText: 'CV Alpha' }).click()
    await expect(page).toHaveURL(/[?&]positioning=/)
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('pressing Escape closes the detail drawer', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('tr').filter({ hasText: 'CV Alpha' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('clicking another row updates the drawer content', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('tr').filter({ hasText: 'CV Alpha' }).click()
    await expect(page.locator('[data-slot="drawer-title"]')).toContainText('CV Alpha')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await page.locator('tr').filter({ hasText: 'CV Beta' }).click()
    await expect(page.locator('[data-slot="drawer-title"]')).toContainText('CV Beta')
  })

  // ── Detail panel ────────────────────────────────────────────────────────────

  test('drawer shows funnel stage name as badge', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('tr').filter({ hasText: 'CV Alpha' }).click()
    await expect(page.getByRole('dialog').getByText('Lead qualified')).toBeVisible()
  })

  test('drawer shows full description and content', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('tr').filter({ hasText: 'CV Alpha' }).click()
    const drawer = page.locator('[data-slot="drawer-content"]')
    await expect(drawer.getByText('Alpha description')).toBeVisible()
    await expect(drawer.getByText('Alpha content')).toBeVisible()
  })

  test('drawer shows "Linked Prospects" section title', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('tr').filter({ hasText: 'CV Alpha' }).click()
    await expect(page.getByText(/linked prospects/i)).toBeVisible()
  })

  test('drawer shows Interactions section with empty state', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('tr').filter({ hasText: 'CV Alpha' }).click()
    await expect(page.getByText(/no interactions linked to this positioning/i)).toBeVisible()
  })

  // ── Empty states ────────────────────────────────────────────────────────────

  test('shows "No positionings for this stage" when filter matches nothing', async ({ page }) => {
    await page.goto('/positionings')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'First contact' }).click()
    await expect(page.getByText(/no positionings for this stage/i)).toBeVisible()
  })

  // ── Destructive: isolated context (must run LAST — wipes beforeAll data) ──────

  test('shows "No positionings yet" when no active positionings exist', async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    const page = await context.newPage()
    await page.goto('/positionings')
    await expect(page.getByText(/no positionings yet/i)).toBeVisible()
    await context.close()
  })
})
