/**
 * Battle Management & Battle History E2E tests (Stories 6.4, 6.5, 6.6)
 *
 * Suite 1: Start Battle flow (6.5)
 * Suite 2: Active battle display + Traffic Light insufficient data (6.4, 6.5)
 * Suite 3: Traffic Light green + Close Battle flow (6.4, 6.5)
 * Suite 4: Battle History + Detail Dialog (6.6)
 *
 * Tests run serially within each suite (shared worker user — state must be predictable).
 * Each suite runs hardResetTestData in beforeAll to start from a clean slate.
 */

import { expect, test } from '../support/fixtures'
import {
  assignPositioning,
  closeBattle,
  createBattle,
  createPositioning,
  createProspect,
  getFunnelStages,
  hardResetTestData,
  resetFunnelStages,
  setPositioningOutcome,
} from '../support/helpers/api'

// ── Suite 1: Start Battle flow ───────────────────────────────────────────────

test.describe('Dashboard - Start Battle flow (6.5)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)

    const stages = await getFunnelStages(context.request)
    const stage = stages[0]
    await createPositioning(context.request, { name: 'Pitch Alpha', funnel_stage_id: stage.id })
    await createPositioning(context.request, { name: 'Pitch Beta', funnel_stage_id: stage.id })

    await context.close()
  })

  test('"Start Battle" button is visible when no active battle', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start Battle' }).first()).toBeVisible()
  })

  test('clicking "Start Battle" opens the dialog with variant selects', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()

    await page.getByRole('button', { name: 'Start Battle' }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Start Battle')).toBeVisible()
    await expect(dialog.getByText('Variant A')).toBeVisible()
    await expect(dialog.getByText('Variant B')).toBeVisible()
    await expect(dialog.getByRole('combobox')).toHaveCount(2)
  })

  test('submitting with two variants starts a battle and updates the status line', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()

    await page.getByRole('button', { name: 'Start Battle' }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Select Variant A
    await dialog.getByRole('combobox').first().click()
    await page.getByRole('option', { name: 'Pitch Alpha' }).click()

    // Select Variant B
    await dialog.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: 'Pitch Beta' }).click()

    await dialog.getByRole('button', { name: 'Start' }).click()

    // Dialog closes and status line updates
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText(/Battle #1/)).toBeVisible()
  })

  test('active battle status line includes both variant names', async ({ page }) => {
    // Previous test already created Battle #1 — reload to see the result
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()
    await expect(page.getByText(/Pitch Alpha/)).toBeVisible()
    await expect(page.getByText(/Pitch Beta/)).toBeVisible()
  })
})

// ── Suite 2: Active battle + Traffic Light insufficient data ─────────────────

test.describe('Dashboard - active battle + Traffic Light red (6.4, 6.5)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)

    const stages = await getFunnelStages(context.request)
    const stage = stages[0]

    const posA = await createPositioning(context.request, {
      name: 'Pitch Alpha',
      funnel_stage_id: stage.id,
    })
    const posB = await createPositioning(context.request, {
      name: 'Pitch Beta',
      funnel_stage_id: stage.id,
    })

    // No prospect data → n < 10 → traffic light will be 🔴
    await createBattle(context.request, {
      funnel_stage_id: stage.id,
      variant_a_id: posA.id,
      variant_b_id: posB.id,
    })

    await context.close()
  })

  test('status line shows active battle number and variant names', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()
    await expect(page.getByText(/Battle #1/)).toBeVisible()
    await expect(page.getByText(/Pitch Alpha/)).toBeVisible()
    await expect(page.getByText(/Pitch Beta/)).toBeVisible()
  })

  test('traffic light badge shows "Need more data" with insufficient data', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()
    await expect(page.getByText('Need more data')).toBeVisible()
  })

  test('"Close Battle" button is disabled when traffic light is red', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close Battle' })).toBeDisabled()
  })

  test('hovering the disabled "Close Battle" button shows tooltip', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()

    // The button is wrapped in a Tooltip span that intercepts pointer events.
    // Use force:true to hover past the pointer-events-none on the disabled button.
    await page.getByRole('button', { name: 'Close Battle' }).hover({ force: true })

    // Radix pre-renders tooltip content twice — use .first()
    await expect(page.getByText('Not enough data to close').first()).toBeVisible()
  })
})

// ── Suite 3: Traffic Light green + Close Battle flow ─────────────────────────

test.describe('Dashboard - Traffic Light green + Close Battle (6.4, 6.5)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)

    const stages = await getFunnelStages(context.request)
    const stage = stages[0]

    const posA = await createPositioning(context.request, {
      name: 'Pitch Alpha',
      funnel_stage_id: stage.id,
    })
    const posB = await createPositioning(context.request, {
      name: 'Pitch Beta',
      funnel_stage_id: stage.id,
    })

    // 10 prospects per variant to pass the n≥10 threshold.
    // posA: all success (rate ≈ 1.0); posB: all failed (rate ≈ 0.0) → P(A>B) >> 0.95 → 🟢
    for (let i = 0; i < 10; i++) {
      const prospA = await createProspect(context.request, {
        name: `Alice ${i}`,
        funnel_stage_id: stage.id,
      })
      await assignPositioning(context.request, prospA.id, posA.id)
      await setPositioningOutcome(context.request, prospA.id, 'success')

      const prospB = await createProspect(context.request, {
        name: `Bob ${i}`,
        funnel_stage_id: stage.id,
      })
      await assignPositioning(context.request, prospB.id, posB.id)
      await setPositioningOutcome(context.request, prospB.id, 'failed')
    }

    await createBattle(context.request, {
      funnel_stage_id: stage.id,
      variant_a_id: posA.id,
      variant_b_id: posB.id,
    })

    await context.close()
  })

  test('traffic light badge shows "Significant" with sufficient data', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()
    await expect(page.getByText('Significant')).toBeVisible()
  })

  test('traffic light tooltip shows confidence percentage', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Significant')).toBeVisible()

    await page.getByText('Significant').hover()

    // Radix pre-renders tooltip content twice (hidden + visible) — use .first()
    await expect(page.getByText(/confident.*better/i).first()).toBeVisible()
  })

  test('"Close Battle" button is enabled when traffic light is green', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close Battle' })).toBeEnabled()
  })

  test('confirming "Close Battle" closes the battle and updates the status line', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()

    await page.getByRole('button', { name: 'Close Battle' }).click()

    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog).toBeVisible()
    await expect(alertDialog.getByText('Confirm the winner for Battle #1')).toBeVisible()
    await expect(alertDialog.getByText(/Winner: Pitch Alpha/)).toBeVisible()

    await alertDialog.getByRole('button', { name: 'Close & Record Winner' }).click()

    await expect(alertDialog).not.toBeVisible()
    // The closed-battle status line shows the full string with winner name
    await expect(page.getByText(/Battle #1 closed.*Pitch Alpha/)).toBeVisible()
  })

  test('"Start Next Battle" button appears after closing a battle', async ({ page }) => {
    // Previous test closed the battle — reload to see the result
    await page.goto('/')
    await expect(page.getByText('Lead qualified')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start Next Battle' })).toBeVisible()
  })
})

// ── Suite 4: Battle History + Detail Dialog ──────────────────────────────────

test.describe('Dashboard - Battle History + Detail Dialog (6.6)', () => {
  test.describe.configure({ mode: 'serial' })

  let stageName: string
  let winnerName: string
  let loserName: string

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)

    const stages = await getFunnelStages(context.request)
    const stage = stages[0]
    stageName = stage.name

    winnerName = 'Pitch Alpha'
    loserName = 'Pitch Beta'

    const posA = await createPositioning(context.request, {
      name: winnerName,
      funnel_stage_id: stage.id,
    })
    const posB = await createPositioning(context.request, {
      name: loserName,
      funnel_stage_id: stage.id,
    })

    const battle = await createBattle(context.request, {
      funnel_stage_id: stage.id,
      variant_a_id: posA.id,
      variant_b_id: posB.id,
    })

    await closeBattle(context.request, battle.id, posA.id)

    await context.close()
  })

  test('expanding a card with closed battles shows "Battle History" section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(stageName)).toBeVisible()

    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await expect(page.getByText('Battle History')).toBeVisible()
  })

  test('history item shows winner beat loser format', async ({ page }) => {
    await page.goto('/')
    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await expect(
      page.getByRole('button', { name: new RegExp(`${winnerName}.*beat.*${loserName}`) }),
    ).toBeVisible()
  })

  test('clicking a history item opens the Battle Detail Dialog', async ({ page }) => {
    await page.goto('/')
    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: /beat/ }).first().click()

    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('detail dialog shows "Battle #1" as title', async ({ page }) => {
    await page.goto('/')
    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: /beat/ }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: /Battle #1/ })).toBeVisible()
  })

  test('detail dialog shows start date', async ({ page }) => {
    await page.goto('/')
    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: /beat/ }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/Started:/)).toBeVisible()
  })

  test('detail dialog shows winner badge', async ({ page }) => {
    await page.goto('/')
    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: /beat/ }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Winner:')).toBeVisible()
    await expect(dialog.getByText(winnerName).last()).toBeVisible()
  })

  test('detail dialog shows both variant rows', async ({ page }) => {
    await page.goto('/')
    const trigger = page.locator('[data-slot="accordion-trigger"]', {
      has: page.getByText(stageName),
    })
    await trigger.click()

    await page.getByRole('button', { name: /beat/ }).first().click()

    const dialog = page.getByRole('dialog')
    // Both variant names appear in the variant rows section
    const variantRows = dialog.locator('.rounded-md.border')
    await expect(variantRows).toHaveCount(2)
    // No data for either variant since no prospects were set up
    await expect(dialog.getByText('No data')).toHaveCount(2)
  })
})
