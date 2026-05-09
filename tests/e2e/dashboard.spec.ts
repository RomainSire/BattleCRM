/**
 * Dashboard - Funnel Cards E2E tests (Story 6.3)
 *
 * Covers: navigation, grid layout, empty state (no stages), card headers,
 *         accordion expand/collapse, conversion rate display, Traffic Light.
 *
 * Tests run serially (shared worker user — state must be predictable).
 * beforeAll resets all data and seeds a known state before each suite.
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

// ── Suite 1: Empty state (no stages) ────────────────────────────────────────

test.describe('Dashboard - empty state (no stages)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await context.close()
  })

  test('navigates to dashboard via home page /', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
  })

  test('shows empty state message when no stages are configured', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByText(/no funnel stages configured/i),
    ).toBeVisible()
  })
})

// ── Suite 2: Grid of funnel cards ───────────────────────────────────────────

test.describe('Dashboard - funnel cards grid', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    await context.close()
  })

  test('shows one card per funnel stage', async ({ page }) => {
    await page.goto('/')
    // resetFunnelStages creates: Lead qualified, Linkedin connection, First contact
    await expect(page.getByText('Lead qualified')).toBeVisible()
    await expect(page.getByText('Linkedin connection')).toBeVisible()
    await expect(page.getByText('First contact')).toBeVisible()
  })

  test('each card shows "No active battle" by default', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()
    // One "No active battle" text per stage (3 stages seeded)
    await expect(page.getByText(/no active battle/i)).toHaveCount(3)
  })

  test('card header has expand/collapse button', async ({ page }) => {
    await page.goto('/')
    // Wait for data to load
    await expect(page.getByText('Lead qualified')).toBeVisible()
    // Each card has a shadcn AccordionTrigger with data-slot="accordion-trigger"
    const triggers = page.locator('[data-slot="accordion-trigger"]')
    await expect(triggers).toHaveCount(3)
    // All start collapsed
    for (const trigger of await triggers.all()) {
      await expect(trigger).toHaveAttribute('data-state', 'closed')
    }
  })

  test('clicking a card expands it and shows "Conversion Rates" section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()

    const firstTrigger = page.locator('[data-slot="accordion-trigger"]').first()
    await firstTrigger.click()

    await expect(firstTrigger).toHaveAttribute('data-state', 'open')
    await expect(page.getByText(/conversion rates/i).first()).toBeVisible()
  })

  test('clicking an expanded card collapses it', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()

    const firstTrigger = page.locator('[data-slot="accordion-trigger"]').first()

    await firstTrigger.click()
    await expect(firstTrigger).toHaveAttribute('data-state', 'open')

    await firstTrigger.click()
    await expect(firstTrigger).toHaveAttribute('data-state', 'closed')
  })

  test('only one card is expanded at a time', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()

    const triggers = page.locator('[data-slot="accordion-trigger"]')

    await triggers.nth(0).click()
    await expect(triggers.nth(0)).toHaveAttribute('data-state', 'open')

    // Expand second — first should collapse
    await triggers.nth(1).click()
    await expect(triggers.nth(1)).toHaveAttribute('data-state', 'open')
    await expect(triggers.nth(0)).toHaveAttribute('data-state', 'closed')
  })

  test('expanded card shows "No data yet" when no performance data exists', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()

    await page.locator('[data-slot="accordion-trigger"]').first().click()
    await expect(page.getByText(/no data for this stage yet/i)).toBeVisible()
  })
})

// ── Suite 3: Conversion rate display ────────────────────────────────────────

test.describe('Dashboard - conversion rates with data', () => {
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

    // Create a positioning and a prospect, assign + set outcome = success
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

  test('card shows positioning name in expanded conversion rates', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(stageName)).toBeVisible()

    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await expect(page.getByText(positioningName)).toBeVisible()
  })

  test('shows sample size in (numerator/denominator) format', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(stageName)).toBeVisible()

    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    // 1 success / 1 total → Bayesian: (1+1)/(2+1) = 0.667 → 67% (1/1)
    await expect(page.getByText(/\(1\/1\)/)).toBeVisible()
  })

  test('card renders without error when data is insufficient (< 10 prospects)', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(stageName)).toBeVisible()
    // 1 data point → confidenceLevel = 'low'. No active battle → no traffic light shown.
    // This test verifies the card renders the stage card without error.
    await expect(
      page.locator('[data-slot="accordion-trigger"]', { has: page.getByText(stageName) }),
    ).toHaveAttribute('data-state', 'closed')
  })
})

// ── Suite 4: API response shape ──────────────────────────────────────────────

test.describe('Dashboard - battles API', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    await context.close()
  })

  test('dashboard triggers GET /api/battles request', async ({ page }) => {
    const battlesRequest = page.waitForResponse(
      (resp) => resp.url().includes('/api/battles') && resp.status() === 200,
    )
    await page.goto('/')
    const response = await battlesRequest
    const body = await response.json()
    expect(body).toHaveProperty('data')
    expect(Array.isArray(body.data)).toBe(true)
  })

  test('dashboard triggers GET /api/analytics/performance_matrix request', async ({ page }) => {
    const matrixRequest = page.waitForResponse(
      (resp) => resp.url().includes('/api/analytics/performance_matrix') && resp.status() === 200,
    )
    await page.goto('/')
    const response = await matrixRequest
    const body = await response.json()
    expect(body).toHaveProperty('cells')
    expect(Array.isArray(body.cells)).toBe(true)
  })
})
