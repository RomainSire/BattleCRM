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
  resetFunnelStages,
  resetPositionings,
} from '../support/helpers/api'
import { STORAGE_STATE } from '../../playwright.config'

test.describe('Positionings - List View', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE })
    await resetPositionings(context.request)
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

  test('shows funnel stage filter pills', async ({ page }) => {
    await page.goto('/positionings')
    await expect(page.getByRole('button', { name: 'Lead qualified', exact: true })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Linkedin connection', exact: true }),
    ).toBeVisible()
  })

  test('shows "Show archived" switch', async ({ page }) => {
    await page.goto('/positionings')
    await expect(page.getByRole('switch', { name: /show archived/i })).toBeVisible()
  })

  // ── Stage filter ────────────────────────────────────────────────────────────

  test('clicking a stage filter marks it active (aria-pressed)', async ({ page }) => {
    await page.goto('/positionings')
    const filterBtn = page.getByRole('button', { name: 'Lead qualified', exact: true })
    await filterBtn.click()
    await expect(filterBtn).toHaveAttribute('aria-pressed', 'true')
  })

  test('stage filter shows only matching positionings', async ({ page }) => {
    await page.goto('/positionings')
    await page.getByRole('button', { name: 'Lead qualified', exact: true }).click()
    await expect(page.getByText('CV Alpha')).toBeVisible()
    await expect(page.getByText('CV Beta')).not.toBeVisible()
  })

  test('"Clear filter" button resets the stage filter', async ({ page }) => {
    await page.goto('/positionings')
    await page.getByRole('button', { name: 'Lead qualified', exact: true }).click()
    await expect(page.getByRole('button', { name: /clear filter/i })).toBeVisible()
    await page.getByRole('button', { name: /clear filter/i }).click()
    await expect(page.getByText('CV Alpha')).toBeVisible()
    await expect(page.getByText('CV Beta')).toBeVisible()
  })

  test('clicking the active stage filter again deactivates it', async ({ page }) => {
    await page.goto('/positionings')
    const filterBtn = page.getByRole('button', { name: 'Lead qualified', exact: true })
    await filterBtn.click()
    await expect(filterBtn).toHaveAttribute('aria-pressed', 'true')
    await filterBtn.click()
    await expect(filterBtn).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText('CV Beta')).toBeVisible()
  })

  // ── Row expand / collapse ───────────────────────────────────────────────────

  test('clicking a row expands the detail panel', async ({ page }) => {
    await page.goto('/positionings')
    const rowBtn = page
      .locator('button[aria-expanded]')
      .filter({ hasText: 'CV Alpha' })
      .first()
    await expect(rowBtn).toHaveAttribute('aria-expanded', 'false')
    await rowBtn.click()
    await expect(rowBtn).toHaveAttribute('aria-expanded', 'true')
  })

  test('clicking an expanded row collapses it', async ({ page }) => {
    await page.goto('/positionings')
    const rowBtn = page
      .locator('button[aria-expanded]')
      .filter({ hasText: 'CV Alpha' })
      .first()
    await rowBtn.click()
    await expect(rowBtn).toHaveAttribute('aria-expanded', 'true')
    await rowBtn.click()
    await expect(rowBtn).toHaveAttribute('aria-expanded', 'false')
  })

  test('only one row can be expanded at a time', async ({ page }) => {
    await page.goto('/positionings')
    const alphaRow = page
      .locator('button[aria-expanded]')
      .filter({ hasText: 'CV Alpha' })
      .first()
    const betaRow = page
      .locator('button[aria-expanded]')
      .filter({ hasText: 'CV Beta' })
      .first()

    await alphaRow.click()
    await expect(alphaRow).toHaveAttribute('aria-expanded', 'true')

    await betaRow.click()
    await expect(alphaRow).toHaveAttribute('aria-expanded', 'false')
    await expect(betaRow).toHaveAttribute('aria-expanded', 'true')
  })

  // ── Expanded detail panel ───────────────────────────────────────────────────

  test('expanded row shows funnel stage name as badge', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('button[aria-expanded]').filter({ hasText: 'CV Alpha' }).first().click()
    // Stage badge is visible in the expanded content
    const content = page
      .locator('[data-slot="accordion-item"]')
      .filter({ hasText: 'CV Alpha' })
      .first()
    await expect(content.locator('[data-slot="accordion-content"]').getByText('Lead qualified')).toBeVisible()
  })

  test('expanded row shows full description and content', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('button[aria-expanded]').filter({ hasText: 'CV Alpha' }).first().click()
    const content = page
      .locator('[data-slot="accordion-item"]')
      .filter({ hasText: 'CV Alpha' })
      .first()
      .locator('[data-slot="accordion-content"]')
    await expect(content.getByText('Alpha description')).toBeVisible()
    await expect(content.getByText('Alpha content')).toBeVisible()
  })

  test('expanded row shows "Linked Prospects" section title', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('button[aria-expanded]').filter({ hasText: 'CV Alpha' }).first().click()
    await expect(page.getByText(/linked prospects/i)).toBeVisible()
  })

  test('expanded row shows Interactions coming-soon placeholder', async ({ page }) => {
    await page.goto('/positionings')
    await page.locator('button[aria-expanded]').filter({ hasText: 'CV Alpha' }).first().click()
    await expect(page.getByText(/coming in a future release/i)).toBeVisible()
  })

  // ── Empty states ────────────────────────────────────────────────────────────

  test('shows "No positionings yet" when no active positionings exist', async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE })
    await resetPositionings(context.request)
    const page = await context.newPage()
    await page.goto('/positionings')
    await expect(page.getByText(/no positionings yet/i)).toBeVisible()
    await context.close()
  })

  test('shows "No positionings for this stage" when filter matches nothing', async ({ page }) => {
    await page.goto('/positionings')
    // Filter by "First contact" stage — no positionings seeded there
    await page.getByRole('button', { name: 'First contact', exact: true }).click()
    await expect(page.getByText(/no positionings for this stage/i)).toBeVisible()
  })
})
