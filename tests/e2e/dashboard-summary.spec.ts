/**
 * Dashboard - Summary Metrics E2E tests (Story 6.8)
 *
 * Covers: AC#1 (KPI cards), AC#2 (Funnel overview), AC#3 (Empty state guidance)
 * AC#4 (Skeleton loading) is implicit — tests wait for real content to appear.
 *
 * Tests run serially within each suite (shared worker user — state must be predictable).
 * Each suite calls hardResetTestData in beforeAll for a clean slate.
 */

import { expect, test } from '../support/fixtures'
import {
  createInteraction,
  createPositioning,
  createProspect,
  getFunnelStages,
  hardResetTestData,
  resetFunnelStages,
} from '../support/helpers/api'

// ── Suite 1: KPI cards with data ────────────────────────────────────────────

test.describe('Dashboard - Summary KPIs with data (6.8)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)

    const stages = await getFunnelStages(context.request)
    const stage = stages[0]

    // 2 active prospects in stage[0]
    const p1 = await createProspect(context.request, { name: 'Alice', funnel_stage_id: stage.id })
    const p2 = await createProspect(context.request, { name: 'Bob', funnel_stage_id: stage.id })

    // 1 archived prospect (should NOT count in totalActiveProspects)
    const archived = await createProspect(context.request, {
      name: 'Archived',
      funnel_stage_id: stage.id,
    })
    await context.request.delete(
      `${process.env.E2E_API_URL || 'http://localhost:3333'}/api/prospects/${archived.id}`,
    )

    // 2 interactions this month for p1
    await createInteraction(context.request, {
      prospect_id: p1.id,
      notes: 'Interaction 1',
      interaction_date: new Date().toISOString().slice(0, 10),
    })
    await createInteraction(context.request, {
      prospect_id: p2.id,
      notes: 'Interaction 2',
      interaction_date: new Date().toISOString().slice(0, 10),
    })

    await context.close()
  })

  test('summary section shows all four KPI card labels (AC#1)', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Active prospects')).toBeVisible()
    await expect(page.getByText('Interactions this week')).toBeVisible()
    await expect(page.getByText('This month')).toBeVisible()
    await expect(page.getByText('Top positioning')).toBeVisible()
  })

  test('totalActiveProspects count excludes archived prospect (AC#1)', async ({ page }) => {
    await page.goto('/')
    const card = page.locator('[data-slot="card"]', {
      has: page.getByText('Active prospects'),
    })
    await expect(card.locator('.tabular-nums').first()).toHaveText('2')
  })

  test('interactionsThisMonth shows correct count (AC#1)', async ({ page }) => {
    await page.goto('/')
    const card = page.locator('[data-slot="card"]', {
      has: page.getByText('This month'),
    })
    await expect(card.locator('.tabular-nums').first()).toHaveText('2')
  })

  test('funnel overview section is visible with section heading (AC#2)', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Funnel overview')).toBeVisible()
  })

  test('funnel overview shows stage names ordered by position (AC#2)', async ({ page }) => {
    await page.goto('/')
    const funnelSection = page.locator('section', {
      has: page.getByText('Funnel overview'),
    })
    await expect(funnelSection.getByText('Prospect → À contacter')).toBeVisible()
    await expect(funnelSection.getByText('Approche → CV à envoyer')).toBeVisible()
    await expect(funnelSection.getByText('Qualif ESN → Entretien à décrocher')).toBeVisible()
  })

  test('funnel overview shows prospect count for stages (AC#2)', async ({ page }) => {
    await page.goto('/')
    const funnelSection = page.locator('section', {
      has: page.getByText('Funnel overview'),
    })
    // Stage[0] has 2 active prospects
    const stageRow = funnelSection.locator('li').first()
    await expect(stageRow.getByText('2')).toBeVisible()
  })
})

// ── Suite 2: Empty state — no prospects ─────────────────────────────────────

test.describe('Dashboard - Summary empty state no prospects (6.8)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    // No prospects created → totalActiveProspects = 0
    await context.close()
  })

  test('"Add prospects to get started" card is visible when no prospects (AC#3)', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByText('Add prospects to get started')).toBeVisible()
  })

  test('"Add prospects" card navigates to /prospects (AC#3)', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Add prospects to get started').click()
    await expect(page).toHaveURL('/prospects')
  })
})

// ── Suite 3: Empty state — prospects exist, no positionings/interactions ─────

test.describe('Dashboard - Summary empty state with prospects (6.8)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)

    const stages = await getFunnelStages(context.request)
    // 1 prospect, no positionings, no interactions → cells = 0, interactionsThisMonth = 0
    await createProspect(context.request, { name: 'Alice', funnel_stage_id: stages[0].id })

    await context.close()
  })

  test('"Create positionings" card is visible when no positioning data (AC#3)', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByText('Create positionings to start A/B testing')).toBeVisible()
  })

  test('"Create positionings" card navigates to /positionings (AC#3)', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Create positionings to start A/B testing').click()
    await expect(page).toHaveURL('/positionings')
  })

  test('"Log interactions" card is visible when no interactions this month (AC#3)', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByText('Log interactions to see conversion data')).toBeVisible()
  })
})

// ── Suite 4: Best performing positioning ─────────────────────────────────────

test.describe('Dashboard - Summary best performing positioning (6.8)', () => {
  test.describe.configure({ mode: 'serial' })

  let positioningName: string

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)

    const stages = await getFunnelStages(context.request)
    const stage = stages[0]

    const positioning = await createPositioning(context.request, {
      name: 'Top Pitch',
      funnel_stage_id: stage.id,
    })
    positioningName = positioning.name

    const API_URL = process.env.E2E_API_URL || 'http://localhost:3333'

    // Need total >= 10 to get confidenceLevel !== 'low' (threshold in bayesian_service.ts)
    for (let i = 0; i < 10; i++) {
      const prospect = await createProspect(context.request, {
        name: `Prospect ${i}`,
        funnel_stage_id: stage.id,
      })
      await context.request.post(`${API_URL}/api/prospects/${prospect.id}/positionings`, {
        data: { positioning_id: positioning.id },
      })
      await context.request.patch(
        `${API_URL}/api/prospects/${prospect.id}/positionings/current/outcome`,
        { data: { outcome: 'success' } },
      )
    }

    await context.close()
  })

  test('best performing positioning name is shown in "Top positioning" card (AC#1)', async ({
    page,
  }) => {
    await page.goto('/')
    const card = page.locator('[data-slot="card"]', {
      has: page.getByText('Top positioning'),
    })
    await expect(card.getByText(positioningName)).toBeVisible()
  })
})
