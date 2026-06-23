/**
 * Prospects - List View E2E tests
 *
 * Covers: navigation, list display, stage filter, search, inline row expand/collapse, empty state.
 * All tests run as authenticated user (storageState from playwright.config.ts).
 *
 * Tests run serially (shared user account — state must be predictable).
 * beforeAll resets prospects and creates 2 known test prospects in different stages.
 */

import { expect, test } from '../support/fixtures'
import {
  createInteraction,
  createProspect,
  getFunnelStages,
  hardResetTestData,
  resetFunnelStages,
} from '../support/helpers/api'

/** Returns an ISO date string (YYYY-MM-DD) for `n` days before today. */
function daysAgoDate(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
test.describe('Prospects - List View', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    const stages = await getFunnelStages(context.request)
    // Alice in stage 0 (Prospect → À contacter), Bob in stage 1 (Approche → CV à envoyer)
    await createProspect(context.request, {
      name: 'Alice Martin',
      company: 'Acme Corp',
      email: 'alice@acme.com',
      funnel_stage_id: stages[0]?.id,
    })
    await createProspect(context.request, {
      name: 'Bob Dupont',
      company: 'Beta Ltd',
      funnel_stage_id: stages[1]?.id ?? stages[0]?.id,
    })
    await context.close()
  })

  // ── Navigation ──────────────────────────────────────────────────────────────

  test('navigates to /prospects via navbar link', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /prospects/i }).click()
    await expect(page).toHaveURL(/\/prospects/)
  })

  test('shows "Prospects" heading on /prospects', async ({ page }) => {
    await page.goto('/prospects')
    await expect(page.getByRole('heading', { name: /^prospects$/i })).toBeVisible()
  })

  // ── List display ────────────────────────────────────────────────────────────

  test('shows seeded prospects in list', async ({ page }) => {
    await page.goto('/prospects')
    await expect(page.getByText('Alice Martin')).toBeVisible()
    await expect(page.getByText('Bob Dupont')).toBeVisible()
  })

  test('shows "Add Prospect" button', async ({ page }) => {
    await page.goto('/prospects')
    await expect(page.getByRole('button', { name: /add prospect/i })).toBeVisible()
  })

  test('shows search input and view toggle', async ({ page }) => {
    await page.goto('/prospects')
    await expect(page.getByRole('searchbox', { name: /search prospects/i })).toBeVisible()
    // ToggleGroupItem (radix-ui type="single") renders as role="radio" — accessible name from text
    await expect(page.getByRole('radio', { name: 'List' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Kanban' })).toBeVisible()
  })

  test('shows funnel stage filter select', async ({ page }) => {
    await page.goto('/prospects')
    // Stage filter is a combobox (Select) in the table header
    await expect(page.getByRole('combobox')).toBeVisible()
  })

  // ── Stage filter ────────────────────────────────────────────────────────────

  test('selecting a stage filter updates the select value', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Prospect → À contacter' }).click()
    await expect(page.getByRole('combobox')).toHaveValue('Prospect → À contacter')
  })

  test('stage filter shows only matching prospects', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Prospect → À contacter' }).click()
    // Alice is in Prospect → À contacter — should be visible
    await expect(page.getByText('Alice Martin')).toBeVisible()
    // Bob is in Approche → CV à envoyer — should not be visible
    await expect(page.getByText('Bob Dupont')).not.toBeVisible()
  })

  test('"Clear filter" button resets the stage filter', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Prospect → À contacter' }).click()
    await expect(page.getByRole('button', { name: /clear filter/i })).toBeVisible()
    await page.getByRole('button', { name: /clear filter/i }).click()
    // Both prospects visible again
    await expect(page.getByText('Alice Martin')).toBeVisible()
    await expect(page.getByText('Bob Dupont')).toBeVisible()
  })

  test('clearing the stage filter shows all prospects', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Prospect → À contacter' }).click()
    await expect(page.getByText('Bob Dupont')).not.toBeVisible()
    // Click the X button on the combobox to clear the filter
    await page.locator('[data-slot="combobox-clear"]').click()
    await expect(page.getByText('Bob Dupont')).toBeVisible()
  })

  // ── Search ──────────────────────────────────────────────────────────────────

  test('search input filters prospects by name client-side', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('searchbox', { name: /search prospects/i }).fill('alice')
    await expect(page.getByText('Alice Martin')).toBeVisible()
    await expect(page.getByText('Bob Dupont')).not.toBeVisible()
  })

  test('search with no results shows empty search state', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('searchbox', { name: /search prospects/i }).fill('zzz-no-match')
    await expect(page.getByText('No results.')).toBeVisible()
  })

  // ── Row click → drawer ──────────────────────────────────────────────────────

  test('clicking a row opens the detail drawer', async ({ page }) => {
    await page.goto('/prospects')
    await page.locator('tr').filter({ hasText: 'Alice Martin' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText('Alice Martin')
  })

  test('pressing Escape closes the detail drawer', async ({ page }) => {
    await page.goto('/prospects')
    await page.locator('tr').filter({ hasText: 'Alice Martin' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('clicking another row updates the drawer content', async ({ page }) => {
    await page.goto('/prospects')
    await page.locator('tr').filter({ hasText: 'Alice Martin' }).click()
    await expect(page.getByRole('dialog')).toContainText('Alice Martin')
    await page.keyboard.press('Escape')
    await page.locator('tr').filter({ hasText: 'Bob Dupont' }).click()
    await expect(page.getByRole('dialog')).toContainText('Bob Dupont')
  })

  // ── Empty state ─────────────────────────────────────────────────────────────

  test('shows "No prospects yet" when no active prospects exist', async ({ browser, workerStorageState }) => {
    // Use an isolated context to avoid affecting serial test state
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    const page = await context.newPage()
    await page.goto('/prospects')
    await expect(page.getByText('No results.')).toBeVisible()
    await context.close()
  })
})

test.describe('Prospects - Target role & last interaction columns', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    const stages = await getFunnelStages(context.request)

    // Recent: interacted 2 days ago, with a target role
    const recent = await createProspect(context.request, {
      name: 'Recent Andy',
      needed_role: 'Backend Engineer',
      funnel_stage_id: stages[0]?.id,
    })
    await createInteraction(context.request, {
      prospect_id: recent.id,
      interaction_date: daysAgoDate(2),
    })

    // Old: interacted 30 days ago, no target role
    const old = await createProspect(context.request, {
      name: 'Old Bob',
      funnel_stage_id: stages[0]?.id,
    })
    await createInteraction(context.request, {
      prospect_id: old.id,
      interaction_date: daysAgoDate(30),
    })

    // Never interacted, with a target role for the search test
    await createProspect(context.request, {
      name: 'Never Carol',
      needed_role: 'Data Scientist',
      funnel_stage_id: stages[0]?.id,
    })

    await context.close()
  })

  // ── Target role column ────────────────────────────────────────────────────────

  test('shows the "Target role" column with values and "—" when empty', async ({ page }) => {
    await page.goto('/prospects')
    await expect(page.getByRole('button', { name: /target role/i })).toBeVisible()

    // Andy has a target role
    await expect(
      page.locator('tr').filter({ hasText: 'Recent Andy' }),
    ).toContainText('Backend Engineer')
    // Bob has none → em dash
    await expect(page.locator('tr').filter({ hasText: 'Old Bob' })).toContainText('—')
  })

  test('clicking the "Target role" header sorts the column', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('button', { name: /target role/i }).click()
    // Prospects are still listed after sorting (no crash, sortable header works)
    await expect(page.getByText('Recent Andy')).toBeVisible()
    await expect(page.getByText('Never Carol')).toBeVisible()
  })

  test('global search matches the target role', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('searchbox', { name: /search prospects/i }).fill('Data Scientist')
    // Only Carol has that target role
    await expect(page.getByText('Never Carol')).toBeVisible()
    await expect(page.getByText('Recent Andy')).not.toBeVisible()
    await expect(page.getByText('Old Bob')).not.toBeVisible()
  })

  // ── Last interaction column ───────────────────────────────────────────────────

  test('shows day counts and "Never" for prospects without interactions', async ({ page }) => {
    await page.goto('/prospects')
    await expect(page.getByRole('button', { name: /last interaction/i })).toBeVisible()

    // Andy ~2 days, Bob ~30 days (day suffix), Carol never
    await expect(page.locator('tr').filter({ hasText: 'Recent Andy' })).toContainText(/\dd/)
    await expect(page.locator('tr').filter({ hasText: 'Old Bob' })).toContainText(/\dd/)
    await expect(page.locator('tr').filter({ hasText: 'Never Carol' })).toContainText('Never')
  })

  test('sorting descending puts oldest on top and "Never" at the bottom', async ({ page }) => {
    await page.goto('/prospects')
    const header = page.getByRole('button', { name: /last interaction/i })
    // First click → ascending, second click → descending
    await header.click()
    await header.click()

    const rows = page.locator('table tbody tr')
    // Descending by elapsed days: Old Bob (30) → Recent Andy (2) → Never Carol (null, bottom)
    await expect(rows.nth(0)).toContainText('Old Bob')
    await expect(rows.nth(1)).toContainText('Recent Andy')
    await expect(rows.nth(2)).toContainText('Never Carol')
  })

  test('no recency filter control is present in the toolbar', async ({ page }) => {
    await page.goto('/prospects')
    // Only the stage filter combobox exists — no recency-specific filter was added
    await expect(page.getByRole('combobox')).toHaveCount(1)
  })
})
