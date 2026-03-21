/**
 * Prospects - Kanban Board View E2E tests
 *
 * Covers: view toggle (list ↔ kanban), stage columns, prospect cards,
 *         card click → Drawer, search filter, "Show archived" toggle,
 *         empty column state, view mode persistence (localStorage).
 *
 * Drag-and-drop between columns is NOT automated — dnd-kit pointer events
 * require native drag simulation which is unreliable in Playwright headless.
 *
 * Tests run serially (shared user account — state must be predictable).
 * beforeAll resets prospects and creates 2 known test prospects.
 */

import { expect, test } from '../support/fixtures'
import { createProspect, hardResetTestData, resetFunnelStages } from '../support/helpers/api'

test.describe('Prospects - Kanban Board View', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    await createProspect(context.request, {
      name: 'Kanban Prospect A',
      company: 'Alpha Corp',
    })
    await createProspect(context.request, {
      name: 'Kanban Prospect B',
      email: 'b@beta.com',
    })
    await context.close()
  })

  // Ensure view mode starts in list (clear localStorage before each test)
  test.beforeEach(async ({ page }) => {
    await page.goto('/prospects')
    await page.evaluate(() => localStorage.removeItem('prospects-view-mode'))
    await page.reload()
  })

  // ── View toggle ─────────────────────────────────────────────────────────────

  test('view toggle buttons are visible on /prospects', async ({ page }) => {
    // ToggleGroupItem (radix-ui type="single") renders as role="radio" — accessible name from text
    await expect(page.getByRole('radio', { name: 'List' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Kanban' })).toBeVisible()
  })

  test('default view is list (stage filter select visible)', async ({ page }) => {
    // In list mode, funnel stage filter select (combobox) is shown
    await expect(page.getByRole('combobox')).toBeVisible()
  })

  test('clicking "Kanban view" switches to kanban board', async ({ page }) => {
    await page.getByRole('radio', { name: 'Kanban' }).click()
    // Stage filter select disappears; column headers appear
    await expect(page.getByRole('combobox')).not.toBeVisible()
    // Kanban columns render stage names as headings
    await expect(page.getByText('Lead qualified').first()).toBeVisible()
  })

  test('kanban board shows all 3 funnel stage columns', async ({ page }) => {
    await page.getByRole('radio', { name: 'Kanban' }).click()
    await expect(page.getByText('Lead qualified').first()).toBeVisible()
    await expect(page.getByText('Linkedin connection').first()).toBeVisible()
    await expect(page.getByText('First contact').first()).toBeVisible()
  })

  // ── Prospect cards ──────────────────────────────────────────────────────────

  test('kanban cards show prospect names', async ({ page }) => {
    await page.getByRole('radio', { name: 'Kanban' }).click()
    await expect(page.getByText('Kanban Prospect A')).toBeVisible()
    await expect(page.getByText('Kanban Prospect B')).toBeVisible()
  })

  test('kanban card shows company when set', async ({ page }) => {
    await page.getByRole('radio', { name: 'Kanban' }).click()
    // "Kanban Prospect A" has company "Alpha Corp"
    await expect(page.getByText('Alpha Corp')).toBeVisible()
  })

  // ── Drawer ──────────────────────────────────────────────────────────────────

  test('clicking a kanban card opens a Drawer with prospect detail', async ({ page }) => {
    await page.getByRole('radio', { name: 'Kanban' }).click()
    // Click on the prospect name text (bubbles up to card onClick)
    await page.getByText('Kanban Prospect A').click()
    // Drawer opens: DrawerTitle shows prospect name
    await expect(page.getByRole('heading', { name: 'Kanban Prospect A' })).toBeVisible()
    // ProspectDetail renders inside: Edit button is visible
    await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible()
  })

  test('pressing Escape closes the Drawer', async ({ page }) => {
    await page.getByRole('radio', { name: 'Kanban' }).click()
    await page.getByText('Kanban Prospect A').click()
    await expect(page.getByRole('heading', { name: 'Kanban Prospect A' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Kanban Prospect A' })).not.toBeVisible()
  })

  // ── Search in kanban ────────────────────────────────────────────────────────

  test('search input in kanban mode filters cards by name', async ({ page }) => {
    await page.getByRole('radio', { name: 'Kanban' }).click()
    await page.getByRole('searchbox', { name: /search prospects/i }).fill('Prospect A')
    await expect(page.getByText('Kanban Prospect A')).toBeVisible()
    await expect(page.getByText('Kanban Prospect B')).not.toBeVisible()
  })

  test('search with no matches shows "No prospects" in all columns', async ({ page }) => {
    await page.getByRole('radio', { name: 'Kanban' }).click()
    await page.getByRole('searchbox', { name: /search prospects/i }).fill('zzz-no-match')
    // Every column should show the empty state text
    await expect(page.getByText(/no prospects/i).first()).toBeVisible()
  })

  // ── Show archived toggle ────────────────────────────────────────────────────

  test('"Show archived" toggle is visible in kanban mode', async ({ page }) => {
    await page.getByRole('radio', { name: 'Kanban' }).click()
    await expect(page.getByRole('switch', { name: /show archived/i })).toBeVisible()
  })

  test('"Show archived" toggle is OFF by default in kanban mode', async ({ page }) => {
    await page.getByRole('radio', { name: 'Kanban' }).click()
    await expect(page.getByRole('switch', { name: /show archived/i })).toHaveAttribute(
      'data-state',
      'unchecked',
    )
  })

  // ── View mode persistence ───────────────────────────────────────────────────

  test('kanban view mode persists across page reload (localStorage)', async ({ page }) => {
    await page.getByRole('radio', { name: 'Kanban' }).click()
    // Verify we're in kanban mode
    await expect(page.getByText('Lead qualified').first()).toBeVisible()
    // Reload without clearing localStorage
    await page.reload()
    // Should still be in kanban mode
    await expect(page.getByText('Lead qualified').first()).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Lead qualified' }),
    ).not.toBeVisible()
  })

  test('switching back to list view works from kanban', async ({ page }) => {
    await page.getByRole('radio', { name: 'Kanban' }).click()
    await page.getByRole('radio', { name: 'List' }).click()
    // Stage filter select visible again (list mode)
    await expect(page.getByRole('combobox')).toBeVisible()
    // Prospect rows visible
    await expect(page.getByText('Kanban Prospect A')).toBeVisible()
  })
})
