/**
 * Dashboard - Performance Matrix Drill-Down E2E tests (Story 6.7)
 *
 * Suite 1: Basic flow — open drill-down dialog, verify title/rate/prospect/badge
 * Suite 2: Multiple outcomes — Converted, Failed, In progress badges
 * Suite 3: Prospect link navigates to /prospects page
 *
 * Tests run serially within each suite (shared worker user — state must be predictable).
 * Each suite calls hardResetTestData in beforeAll for a clean slate.
 */

import { expect, test } from '../support/fixtures'
import {
  assignPositioning,
  createPositioning,
  createProspect,
  getFunnelStages,
  hardResetTestData,
  resetFunnelStages,
  setPositioningOutcome,
} from '../support/helpers/api'

// ── Suite 1: Basic drill-down flow ──────────────────────────────────────────

test.describe('Dashboard - Drill-Down Dialog basic flow (6.7)', () => {
  test.describe.configure({ mode: 'serial' })

  let stageName: string
  let positioningName: string

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)

    const stages = await getFunnelStages(context.request)
    const stage = stages[0]
    stageName = stage.name

    const positioning = await createPositioning(context.request, {
      name: 'Pitch Alpha',
      funnel_stage_id: stage.id,
    })
    positioningName = positioning.name

    const prospect = await createProspect(context.request, {
      name: 'Alice Test',
      funnel_stage_id: stage.id,
    })

    await assignPositioning(context.request, prospect.id, positioning.id)
    await setPositioningOutcome(context.request, prospect.id, 'success')

    await context.close()
  })

  test('clicking a cell in Conversion Rates opens the drill-down dialog', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(stageName)).toBeVisible()

    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    // Click the cell button (contains positioning name)
    await page.getByRole('button', { name: new RegExp(positioningName) }).first().click()

    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('dialog title shows positioning name and stage name', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(stageName)).toBeVisible()

    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: new RegExp(positioningName) }).first().click()

    const dialog = page.getByRole('dialog')
    // Title: "Pitch Alpha — Lead qualified"
    await expect(
      dialog.getByRole('heading', {
        name: new RegExp(`${positioningName}.*${stageName}`),
      }),
    ).toBeVisible()
  })

  test('dialog shows rate summary with percentage and sample size', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(stageName)).toBeVisible()

    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: new RegExp(positioningName) }).first().click()

    const dialog = page.getByRole('dialog')
    // 1 success / 1 total → Bayesian 67%. Rate line: "67% (1/1)"
    await expect(dialog.getByText(/\(1\/1\)/)).toBeVisible()
  })

  test('dialog lists the prospect who was assigned this positioning', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(stageName)).toBeVisible()

    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: new RegExp(positioningName) }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Alice Test')).toBeVisible()
  })

  test('prospect row shows "Converted" badge for success outcome', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(stageName)).toBeVisible()

    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: new RegExp(positioningName) }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Converted')).toBeVisible()
  })

  test('dialog closes when pressing Escape', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(stageName)).toBeVisible()

    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: new RegExp(positioningName) }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })
})

// ── Suite 2: Multiple outcomes ───────────────────────────────────────────────

test.describe('Dashboard - Drill-Down Dialog multiple outcomes (6.7)', () => {
  test.describe.configure({ mode: 'serial' })

  let stageName: string
  let positioningName: string

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)

    const stages = await getFunnelStages(context.request)
    const stage = stages[0]
    stageName = stage.name

    const positioning = await createPositioning(context.request, {
      name: 'Multi Outcome',
      funnel_stage_id: stage.id,
    })
    positioningName = positioning.name

    // Prospect 1: success → "Converted"
    const p1 = await createProspect(context.request, {
      name: 'Alice Success',
      funnel_stage_id: stage.id,
    })
    await assignPositioning(context.request, p1.id, positioning.id)
    await setPositioningOutcome(context.request, p1.id, 'success')

    // Prospect 2: failed → "Failed"
    const p2 = await createProspect(context.request, {
      name: 'Bob Failed',
      funnel_stage_id: stage.id,
    })
    await assignPositioning(context.request, p2.id, positioning.id)
    await setPositioningOutcome(context.request, p2.id, 'failed')

    // Prospect 3: outcome = null → "In progress"
    const p3 = await createProspect(context.request, {
      name: 'Carol Pending',
      funnel_stage_id: stage.id,
    })
    await assignPositioning(context.request, p3.id, positioning.id)
    // No setPositioningOutcome → outcome stays null

    await context.close()
  })

  test('dialog shows all three prospects', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(stageName)).toBeVisible()

    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: new RegExp(positioningName) }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Alice Success')).toBeVisible()
    await expect(dialog.getByText('Bob Failed')).toBeVisible()
    await expect(dialog.getByText('Carol Pending')).toBeVisible()
  })

  test('dialog shows "Converted" badge for success outcome', async ({ page }) => {
    await page.goto('/')

    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: new RegExp(positioningName) }).first().click()

    // exact:true to avoid matching prospect names that contain the outcome word as substring
    await expect(page.getByRole('dialog').getByText('Converted', { exact: true })).toBeVisible()
  })

  test('dialog shows "Failed" badge for failed outcome', async ({ page }) => {
    await page.goto('/')

    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: new RegExp(positioningName) }).first().click()

    // exact:true avoids matching "Bob Failed" link text as a substring
    await expect(page.getByRole('dialog').getByText('Failed', { exact: true })).toBeVisible()
  })

  test('dialog shows "In progress" badge for null outcome', async ({ page }) => {
    await page.goto('/')

    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: new RegExp(positioningName) }).first().click()

    await expect(page.getByRole('dialog').getByText('In progress', { exact: true })).toBeVisible()
  })
})

// ── Suite 3: Prospect link navigation ────────────────────────────────────────

test.describe('Dashboard - Drill-Down prospect link navigates to /prospects (6.7)', () => {
  test.describe.configure({ mode: 'serial' })

  let stageName: string
  let positioningName: string

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)

    const stages = await getFunnelStages(context.request)
    const stage = stages[0]
    stageName = stage.name

    const positioning = await createPositioning(context.request, {
      name: 'Nav Pitch',
      funnel_stage_id: stage.id,
    })
    positioningName = positioning.name

    const prospect = await createProspect(context.request, {
      name: 'Dave Navigator',
      funnel_stage_id: stage.id,
    })

    await assignPositioning(context.request, prospect.id, positioning.id)

    await context.close()
  })

  test('clicking a prospect link in the dialog navigates to /prospects', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(stageName)).toBeVisible()

    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: new RegExp(positioningName) }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Dave Navigator')).toBeVisible()

    // Click the prospect link
    await dialog.getByRole('link', { name: 'Dave Navigator' }).click()

    await expect(page).toHaveURL('/prospects')
  })
})
