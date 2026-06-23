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
import {
  createInteraction,
  createProspect,
  hardResetTestData,
  resetFunnelStages,
} from '../support/helpers/api'

/** Returns an ISO date string (YYYY-MM-DD) for `n` days before today. */
function daysAgoDate(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

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
    await expect(page.getByText('Prospect → À contacter').first()).toBeVisible()
  })

  test('kanban board shows all 3 funnel stage columns', async ({ page }) => {
    await page.getByRole('radio', { name: 'Kanban' }).click()
    await expect(page.getByText('Prospect → À contacter').first()).toBeVisible()
    await expect(page.getByText('Approche → CV à envoyer').first()).toBeVisible()
    await expect(page.getByText('Qualif ESN → Entretien à décrocher').first()).toBeVisible()
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
    await expect(page.getByRole('button', { name: /^edit/i })).toBeVisible()
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
    await expect(page.getByText('Prospect → À contacter').first()).toBeVisible()
    // Reload without clearing localStorage
    await page.reload()
    // Should still be in kanban mode
    await expect(page.getByText('Prospect → À contacter').first()).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Prospect → À contacter' }),
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

test.describe('Prospects - Kanban recency dot', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)

    // Four prospects in the default first stage, one per recency level.
    const fresh = await createProspect(context.request, { name: 'Fresh Frank' })
    await createInteraction(context.request, {
      prospect_id: fresh.id,
      interaction_date: daysAgoDate(2), // ≤ 7 → fresh
    })

    const warning = await createProspect(context.request, { name: 'Warning Wendy' })
    await createInteraction(context.request, {
      prospect_id: warning.id,
      interaction_date: daysAgoDate(14), // 8–21 → warning
    })

    const danger = await createProspect(context.request, { name: 'Danger Dan' })
    await createInteraction(context.request, {
      prospect_id: danger.id,
      interaction_date: daysAgoDate(40), // > 21 → danger
    })

    await createProspect(context.request, { name: 'Never Nina' }) // no interaction → never

    await context.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/prospects')
    await page.evaluate(() => localStorage.removeItem('prospects-view-mode'))
    await page.reload()
    await page.getByRole('radio', { name: 'Kanban' }).click()
  })

  function cardDot(page: import('@playwright/test').Page, name: string) {
    return page.locator('[data-slot="card"]').filter({ hasText: name }).locator('[data-recency]')
  }

  test('fresh prospect (≤7d) shows a green/fresh recency dot', async ({ page }) => {
    await expect(cardDot(page, 'Fresh Frank')).toHaveAttribute('data-recency', 'fresh')
  })

  test('warning prospect (8–21d) shows a warning recency dot', async ({ page }) => {
    await expect(cardDot(page, 'Warning Wendy')).toHaveAttribute('data-recency', 'warning')
  })

  test('danger prospect (>21d) shows a danger recency dot', async ({ page }) => {
    await expect(cardDot(page, 'Danger Dan')).toHaveAttribute('data-recency', 'danger')
  })

  test('never-contacted prospect shows a neutral "never" recency dot', async ({ page }) => {
    await expect(cardDot(page, 'Never Nina')).toHaveAttribute('data-recency', 'never')
  })
})
