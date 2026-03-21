/**
 * Positionings - List View E2E tests (Story 4.3)
 *
 * Covers: navigation, list display, stage filter pills, row expand/collapse,
 *         expanded detail panel (stage, description, linked prospects, interactions),
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
import { STORAGE_STATE } from '../../playwright.config'

test.describe('Positionings - List View', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE })
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
    // Stage filter is a combobox (Select) in the table header
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

  // ── Row expand / collapse ───────────────────────────────────────────────────

  test('clicking a row expands the detail panel', async ({ page }) => {
    await page.goto('/positionings')
    const rowBtn = page.locator('tr[aria-expanded]').filter({ hasText: 'CV Alpha' })
    await expect(rowBtn).toHaveAttribute('aria-expanded', 'false')
    await rowBtn.click()
    await expect(rowBtn).toHaveAttribute('aria-expanded', 'true')
  })

  test('clicking an expanded row collapses it', async ({ page }) => {
    await page.goto('/positionings')
    const rowBtn = page.locator('tr[aria-expanded]').filter({ hasText: 'CV Alpha' })
    await rowBtn.click()
    await expect(rowBtn).toHaveAttribute('aria-expanded', 'true')
    await rowBtn.click()
    await expect(rowBtn).toHaveAttribute('aria-expanded', 'false')
  })

  test('only one row can be expanded at a time', async ({ page }) => {
    await page.goto('/positionings')
    const alphaRow = page.locator('tr[aria-expanded]').filter({ hasText: 'CV Alpha' })
    const betaRow = page.locator('tr[aria-expanded]').filter({ hasText: 'CV Beta' })

    await alphaRow.click()
    await expect(alphaRow).toHaveAttribute('aria-expanded', 'true')

    await betaRow.click()
    await expect(alphaRow).toHaveAttribute('aria-expanded', 'false')
    await expect(betaRow).toHaveAttribute('aria-expanded', 'true')
  })

  // ── Expanded detail panel ───────────────────────────────────────────────────

  test('expanded row shows funnel stage name as badge', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('tr[aria-expanded]').filter({ hasText: 'CV Alpha' }).click()
    // Stage badge appears in the expanded detail panel (dl section)
    await expect(page.getByText('Lead qualified').first()).toBeVisible()
  })

  test('expanded row shows full description and content', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('tr[aria-expanded]').filter({ hasText: 'CV Alpha' }).click()
    // Scope to the expanded content cell (td with colspan) to avoid ambiguity with the description column
    const expandedContent = page.locator('td[colspan]').first()
    await expect(expandedContent.getByText('Alpha description')).toBeVisible()
    await expect(expandedContent.getByText('Alpha content')).toBeVisible()
  })

  test('expanded row shows "Linked Prospects" section title', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('tr[aria-expanded]').filter({ hasText: 'CV Alpha' }).click()
    await expect(page.getByText(/linked prospects/i)).toBeVisible()
  })

  test('expanded row shows Interactions section with empty state', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('tr[aria-expanded]').filter({ hasText: 'CV Alpha' }).click()
    await expect(page.getByText(/no interactions linked to this positioning/i)).toBeVisible()
  })

  // ── Empty states ────────────────────────────────────────────────────────────

  test('shows "No positionings for this stage" when filter matches nothing', async ({ page }) => {
    await page.goto('/positionings')
    // Filter by "First contact" stage — no positionings seeded there
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'First contact' }).click()
    await expect(page.getByText(/no positionings for this stage/i)).toBeVisible()
  })

  // ── Destructive: isolated context (must run LAST — wipes beforeAll data) ──────

  test('shows "No positionings yet" when no active positionings exist', async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE })
    await hardResetTestData(context.request)
    const page = await context.newPage()
    await page.goto('/positionings')
    await expect(page.getByText(/no positionings yet/i)).toBeVisible()
    await context.close()
  })
})
