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
  createProspect,
  getFunnelStages,
  resetFunnelStages,
  resetProspects,
} from '../support/helpers/api'
import { STORAGE_STATE } from '../../playwright.config'

test.describe('Prospects - List View', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE })
    await resetFunnelStages(context.request)
    await resetProspects(context.request)
    const stages = await getFunnelStages(context.request)
    // Alice in stage 0 (Lead qualified), Bob in stage 1 (Linkedin connection)
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
    await page.getByRole('option', { name: 'Lead qualified' }).click()
    await expect(page.getByRole('combobox')).toContainText('Lead qualified')
  })

  test('stage filter shows only matching prospects', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Lead qualified' }).click()
    // Alice is in Lead qualified — should be visible
    await expect(page.getByText('Alice Martin')).toBeVisible()
    // Bob is in Linkedin connection — should not be visible
    await expect(page.getByText('Bob Dupont')).not.toBeVisible()
  })

  test('"Clear filter" button resets the stage filter', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Lead qualified' }).click()
    await expect(page.getByRole('button', { name: /clear filter/i })).toBeVisible()
    await page.getByRole('button', { name: /clear filter/i }).click()
    // Both prospects visible again
    await expect(page.getByText('Alice Martin')).toBeVisible()
    await expect(page.getByText('Bob Dupont')).toBeVisible()
  })

  test('selecting "All stages" in the select resets the filter', async ({ page }) => {
    await page.goto('/prospects')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Lead qualified' }).click()
    await expect(page.getByText('Bob Dupont')).not.toBeVisible()
    // Select "All stages" to reset
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: /all stages/i }).click()
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
    await expect(page.getByText(/no prospects match your search/i)).toBeVisible()
  })

  // ── Row expand / collapse ───────────────────────────────────────────────────

  test('clicking a row expands the detail panel', async ({ page }) => {
    await page.goto('/prospects')
    const rowBtn = page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'Alice Martin' })
      .first()
    await expect(rowBtn).toHaveAttribute('aria-expanded', 'false')
    await rowBtn.click()
    await expect(rowBtn).toHaveAttribute('aria-expanded', 'true')
  })

  test('clicking an expanded row collapses it', async ({ page }) => {
    await page.goto('/prospects')
    const rowBtn = page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'Alice Martin' })
      .first()
    await rowBtn.click()
    await expect(rowBtn).toHaveAttribute('aria-expanded', 'true')
    await rowBtn.click()
    await expect(rowBtn).toHaveAttribute('aria-expanded', 'false')
  })

  test('only one row can be expanded at a time', async ({ page }) => {
    await page.goto('/prospects')
    const aliceRow = page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'Alice Martin' })
      .first()
    const bobRow = page
      .locator('tr[aria-expanded]')
      .filter({ hasText: 'Bob Dupont' })
      .first()

    await aliceRow.click()
    await expect(aliceRow).toHaveAttribute('aria-expanded', 'true')

    await bobRow.click()
    // Alice collapses, Bob expands
    await expect(aliceRow).toHaveAttribute('aria-expanded', 'false')
    await expect(bobRow).toHaveAttribute('aria-expanded', 'true')
  })

  // ── Empty state ─────────────────────────────────────────────────────────────

  test('shows "No prospects yet" when no active prospects exist', async ({ browser }) => {
    // Use an isolated context to avoid affecting serial test state
    const context = await browser.newContext({ storageState: STORAGE_STATE })
    await resetProspects(context.request)
    const page = await context.newPage()
    await page.goto('/prospects')
    await expect(page.getByText(/no prospects yet/i)).toBeVisible()
    await context.close()
  })
})
