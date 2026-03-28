/**
 * Prospects - Positioning Section E2E tests (Story 5B.3)
 *
 * Covers:
 *   AC1 — Alert icon on kanban card when stage has positionings but none assigned
 *   AC2 — State B: active positioning with outcome=null → name + outcome buttons
 *   AC3 — State C: outcome decided → colored icon, "Change positioning" button
 *   AC4 — Stage change popup when active positioning has no outcome; Skip dismisses it
 *   AC5 — Archiving a prospect with unresolved positioning succeeds (auto-sets outcome=failed)
 *   AC6 — Assigning a positioning from ProspectDetail transitions to State B
 *
 * All tests run as authenticated user, serially.
 * beforeAll seeds: 1 positioning + 4 prospects (assign/inprogress/archive/kanban).
 */

import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures'
import {
  createPositioning,
  createProspect,
  getFunnelStages,
  hardResetTestData,
  resetFunnelStages,
} from '../support/helpers/api'

const API_URL = process.env.E2E_API_URL || 'http://localhost:3333'

test.describe('Prospects - Positioning Section', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    const stages = await getFunnelStages(context.request)

    // One positioning for stage[0] (Lead qualified)
    const positioning = await createPositioning(context.request, {
      name: 'PP Positioning Alpha',
      funnel_stage_id: stages[0]?.id,
    })

    // Prospect for the main assign → outcome flow (no positioning in setup)
    await createProspect(context.request, {
      name: 'PP Assign Prospect',
      funnel_stage_id: stages[0]?.id,
    })

    // Prospect with Pos Alpha already assigned (outcome=null) — for stage change popup test
    const ppInProgress = await createProspect(context.request, {
      name: 'PP InProgress Prospect',
      funnel_stage_id: stages[0]?.id,
    })
    await context.request.post(`${API_URL}/api/prospects/${ppInProgress.id}/positionings`, {
      data: { positioning_id: positioning.id },
    })

    // Prospect with Pos Alpha already assigned (outcome=null) — for archive flow test
    const ppArchive = await createProspect(context.request, {
      name: 'PP Archive Prospect',
      funnel_stage_id: stages[0]?.id,
    })
    await context.request.post(`${API_URL}/api/prospects/${ppArchive.id}/positionings`, {
      data: { positioning_id: positioning.id },
    })

    // Prospect with no positioning — for kanban alert icon test
    await createProspect(context.request, {
      name: 'PP Kanban Prospect',
      funnel_stage_id: stages[0]?.id,
    })

    await context.close()
  })

  async function expandProspect(page: Page, name: string) {
    const row = page.locator('tr[aria-expanded]').filter({ hasText: name })
    await row.click()
    await expect(row).toHaveAttribute('aria-expanded', 'true')
  }

  // ── AC1: Alert indicator ──────────────────────────────────────────────────────

  test('kanban card shows alert icon for prospect with no positioning assigned', async ({
    page,
  }) => {
    await page.goto('/prospects')
    await page.getByRole('radio', { name: 'Kanban' }).click()
    // PP Kanban Prospect has no positioning — AlertCircle (aliased to circle-alert) icon on its card
    const card = page.locator('.cursor-pointer').filter({ hasText: 'PP Kanban Prospect' }).first()
    await expect(card.locator('svg.lucide-circle-alert')).toBeVisible()
  })

  test('kanban card shows clock icon for prospect with positioning in-progress', async ({
    page,
  }) => {
    await page.goto('/prospects')
    await page.getByRole('radio', { name: 'Kanban' }).click()
    // PP InProgress Prospect has Pos Alpha assigned with no outcome — clock icon
    const card = page
      .locator('.cursor-pointer')
      .filter({ hasText: 'PP InProgress Prospect' })
      .first()
    await expect(card.locator('svg.lucide-clock')).toBeVisible()
  })

  // ── State A: no active positioning ────────────────────────────────────────────

  test('expanded prospect detail shows positioning assign select when stage has positionings (State A)', async ({
    page,
  }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'PP Assign Prospect')
    // State A: a combobox showing "Assign a positioning..." placeholder is visible
    await expect(
      page.getByRole('combobox').filter({ hasText: /assign a positioning/i }),
    ).toBeVisible()
  })

  // ── AC6: Assign positioning ────────────────────────────────────────────────────

  test('assigning a positioning from detail transitions to State B (name + outcome buttons)', async ({
    page,
  }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'PP Assign Prospect')
    // Open the assign select and choose "PP Positioning Alpha"
    await page.getByRole('combobox').filter({ hasText: /assign a positioning/i }).click()
    await page.getByRole('option', { name: 'PP Positioning Alpha' }).click()
    // State B: positioning name + outcome buttons visible
    await expect(page.getByText('PP Positioning Alpha')).toBeVisible()
    await expect(page.getByRole('button', { name: /success/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /failure/i }).first()).toBeVisible()
  })

  // ── AC2/AC3: Set outcome ────────────────────────────────────────────────────────

  test('clicking the "✓ Success" button updates the positioning outcome', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'PP Assign Prospect')
    // PP Assign is now in State B — click "✓ Success"
    await page.getByRole('button', { name: /success/i }).first().click()
    // Wait for State C: mutation complete when the collapsed [Edit] button appears
    await expect(page.getByTestId('positioning-edit-btn')).toBeVisible()
  })

  // ── AC3: State C ───────────────────────────────────────────────────────────────

  test('"Edit" button is visible in State C (collapsed controls)', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'PP Assign Prospect')
    // State C: outcome decided → shows [Edit] button for positioning (data-testid to disambiguate from ProspectDetail's Edit button)
    await expect(page.getByTestId('positioning-edit-btn')).toBeVisible()
    await expect(page.getByRole('button', { name: /change positioning/i })).not.toBeVisible()
  })

  test('clicking "Edit" in State C reveals success/fail/change-positioning buttons', async ({
    page,
  }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'PP Assign Prospect')
    await page.getByTestId('positioning-edit-btn').click()
    // Full controls now visible
    await expect(page.getByRole('button', { name: /change positioning/i })).toBeVisible()
    // Click "Change positioning" → reassign select appears
    await page.getByRole('button', { name: /change positioning/i }).click()
    await expect(
      page.getByRole('combobox').filter({ hasText: /assign a positioning/i }),
    ).toBeVisible()
  })

  // ── AC4: Stage change popup ────────────────────────────────────────────────────

  test('moving a prospect with unresolved positioning shows outcome prompt; Skip dismisses it', async ({
    page,
  }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'PP InProgress Prospect')
    // Change the funnel stage using the stage select in ProspectDetail
    await page
      .getByRole('combobox', { name: /change funnel stage for PP InProgress Prospect/i })
      .click()
    await page.getByRole('option', { name: 'Linkedin connection' }).click()
    // Non-blocking outcome prompt appears immediately (stage change proceeds regardless)
    await expect(page.getByText(/how did/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /skip/i })).toBeVisible()
    // Clicking Skip dismisses the prompt
    await page.getByRole('button', { name: /skip/i }).click()
    await expect(page.getByRole('button', { name: /skip/i })).not.toBeVisible()
  })

  // ── AC5: Archive with unresolved positioning ───────────────────────────────────

  test('archiving a prospect with unresolved positioning succeeds', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'PP Archive Prospect')
    // PP Archive Prospect has Pos Alpha in State B (outcome=null) — archive should auto-set failed
    // Button has aria-label "Archive PP Archive Prospect" (accessible name != visible text)
    await page.getByRole('button', { name: /archive pp archive prospect/i }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click()
    await expect(page.getByText('Prospect archived')).toBeVisible()
    // Prospect no longer in default (non-archived) list
    await expect(
      page.locator('tr').filter({ hasText: 'PP Archive Prospect' }),
    ).not.toBeVisible()
  })
})
