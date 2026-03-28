/**
 * Interactions - Prospect Timeline E2E tests (Story 5.5)
 *
 * Covers: ProspectTimeline component rendered inside ProspectDetail (expanded row).
 *   - Timeline display: interactions + stage transitions, sorted by date DESC
 *   - TimelineItem expand/collapse, edit, archive/restore
 *   - "Show archived" switch on the timeline
 *   - "Log Interaction" button in the timeline header (active vs archived prospect)
 *   - Empty state when no interactions or transitions
 *   - "Show N more" pagination when >5 events
 *
 * Prospect detail is accessed by expanding a row in the ProspectsList (/prospects).
 * All tests run as authenticated user, serially.
 */

import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures'
import {
  createInteraction,
  createProspect,
  getFunnelStages,
  hardResetTestData,
  resetFunnelStages,
} from '../support/helpers/api'

const API_URL = process.env.E2E_API_URL || 'http://localhost:3333'

test.describe('Interactions - Prospect Timeline', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    // Hard-delete all test data to prevent stale archived records from accumulating
    // across runs (soft-delete reset helpers leave archived rows in the DB).
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    const stages = await getFunnelStages(context.request)

    // Main prospect: 2 interactions (one will be archived later) + stage transition
    const mainProspect = await createProspect(context.request, {
      name: 'TL Timeline Prospect',
      funnel_stage_id: stages[0]?.id,
    })
    await createInteraction(context.request, {
      prospect_id: mainProspect.id,
      notes: 'Timeline note 1',
    })
    await createInteraction(context.request, {
      prospect_id: mainProspect.id,
      notes: 'Timeline note 2',
    })
    // Move to a different stage → triggers a stage transition record
    if (stages[1]) {
      await context.request.put(`${API_URL}/api/prospects/${mainProspect.id}`, {
        data: { funnel_stage_id: stages[1].id },
      })
    }

    // Empty prospect: no interactions, no transitions
    await createProspect(context.request, {
      name: 'TL Empty Prospect',
      funnel_stage_id: stages[0]?.id,
    })

    // Bulk prospect: 6 interactions → triggers "Show N more" button (PREVIEW_COUNT = 5)
    const bulkProspect = await createProspect(context.request, {
      name: 'TL Bulk Prospect',
      funnel_stage_id: stages[0]?.id,
    })
    for (let i = 1; i <= 6; i++) {
      await createInteraction(context.request, {
        prospect_id: bulkProspect.id,
        notes: `Bulk note ${i}`,
      })
    }

    await context.close()
  })

  // ── Helper: expand a prospect row in the prospects list ──────────────────────

  async function expandProspect(page: Page, name: string) {
    const row = page.locator('tr[aria-expanded]').filter({ hasText: name })
    await row.click()
    await expect(row).toHaveAttribute('aria-expanded', 'true')
  }

  // ── Display ──────────────────────────────────────────────────────────────────

  test('expanding a prospect row shows the "History" timeline section', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Timeline Prospect')
    await expect(page.getByText('History')).toBeVisible()
  })

  test('timeline shows interactions for the prospect', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Timeline Prospect')
    // Each interaction renders as an expandable button inside a <li>
    await expect(page.getByText('Timeline note 1')).toBeVisible()
    await expect(page.getByText('Timeline note 2')).toBeVisible()
  })

  test('timeline shows stage transitions', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Timeline Prospect')
    // Stage transition renders as "From → To" — look for the arrow
    await expect(page.getByText(/lead qualified.*→|→.*linkedin connection/i).first()).toBeVisible()
  })

  // ── TimelineItem expand / collapse ────────────────────────────────────────────

  test('clicking a timeline item expands its detail panel', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Timeline Prospect')
    // The first timeline item is an expandable button
    const item = page.locator('ul > li > button[aria-expanded]').first()
    await expect(item).toHaveAttribute('aria-expanded', 'false')
    await item.click()
    await expect(item).toHaveAttribute('aria-expanded', 'true')
    // Edit button now visible (scoped to timeline list to avoid matching prospect's Edit button)
    await expect(page.locator('ul').getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  })

  test('clicking an expanded timeline item collapses it', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Timeline Prospect')
    const item = page.locator('ul > li > button[aria-expanded]').first()
    await item.click()
    await expect(item).toHaveAttribute('aria-expanded', 'true')
    await item.click()
    await expect(item).toHaveAttribute('aria-expanded', 'false')
  })

  test('only one timeline item can be expanded at a time', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Timeline Prospect')
    const items = page.locator('ul > li > button[aria-expanded]')
    await items.first().click()
    await expect(items.first()).toHaveAttribute('aria-expanded', 'true')
    await items.nth(1).click()
    await expect(items.nth(1)).toHaveAttribute('aria-expanded', 'true')
    await expect(items.first()).toHaveAttribute('aria-expanded', 'false')
  })

  // ── Edit from timeline ────────────────────────────────────────────────────────

  test('clicking "Edit" on a timeline item enters edit mode', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Timeline Prospect')
    await page.locator('ul > li > button[aria-expanded]').first().click()
    await page.locator('ul').getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })

  test('can update notes from the timeline and save', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Timeline Prospect')
    await page.locator('ul > li > button[aria-expanded]').first().click()
    await page.locator('ul').getByRole('button', { name: 'Edit', exact: true }).click()
    await page.locator('textarea').fill('Updated from timeline')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText('Interaction updated.')).toBeVisible()
  })

  test('can cancel timeline edit without saving', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Timeline Prospect')
    await page.locator('ul > li > button[aria-expanded]').first().click()
    await page.locator('ul').getByRole('button', { name: 'Edit', exact: true }).click()
    await page.locator('textarea').fill('Unsaved change')
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.locator('ul').getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /save/i })).not.toBeVisible()
  })

  // ── Delete from timeline ─────────────────────────────────────────────────────

  test('clicking "Delete" on a timeline item shows confirmation dialog', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Timeline Prospect')
    await page.locator('ul > li > button[aria-expanded]').first().click()
    await page.locator('ul').getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByText(/delete interaction\?/i)).toBeVisible()
  })

  test('confirming delete removes item from timeline', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Timeline Prospect')
    const firstItem = page.locator('ul > li > button[aria-expanded]').first()
    await firstItem.click()
    await page.locator('ul').getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Interaction deleted.')).toBeVisible()
    // Deleted item gone — remaining item not expanded so Edit button not visible
    await expect(page.locator('ul').getByRole('button', { name: 'Edit', exact: true })).not.toBeVisible()
  })

  // ── Log Interaction button ────────────────────────────────────────────────────

  test('active prospect shows "Log Interaction" button in timeline header', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Timeline Prospect')
    // The timeline header contains a "Log Interaction" text button.
    // Quick-action row buttons are icon-only (aria-label only, no visible text) — getByText
    // matches visible text content only, so it uniquely identifies the timeline button.
    await expect(page.getByText('Log Interaction')).toBeVisible()
  })

  test('clicking "Log Interaction" in timeline opens dialog with prospect pre-selected', async ({
    page,
  }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Timeline Prospect')
    await page.getByText('Log Interaction').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText('TL Timeline Prospect')
  })

  // ── Empty state ────────────────────────────────────────────────────────────────

  test('shows empty state message when prospect has no interactions or transitions', async ({
    page,
  }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Empty Prospect')
    await expect(page.getByText(/no activity recorded yet/i)).toBeVisible()
  })

  // ── Show all (pagination) ─────────────────────────────────────────────────────

  test('shows "Show N more" button when timeline has more than 5 events', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Bulk Prospect')
    // 6 interactions → 5 shown, 1 hidden → "Show 1 more"
    await expect(page.getByRole('button', { name: /show \d+ more/i })).toBeVisible()
  })

  test('clicking "Show N more" reveals all timeline events', async ({ page }) => {
    await page.goto('/prospects')
    await expandProspect(page, 'TL Bulk Prospect')
    await page.getByRole('button', { name: /show \d+ more/i }).click()
    // After click, all 6 interactions are visible — "Show N more" button gone
    await expect(page.getByRole('button', { name: /show \d+ more/i })).not.toBeVisible()
    // All 6 notes visible
    await expect(page.getByText('Bulk note 6')).toBeVisible()
  })

  // ── Destructive: isolated context (must run LAST — wipes beforeAll data) ──────

  test('archived prospect has no "Log Interaction" button in timeline', async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    const stages = await getFunnelStages(context.request)
    const prospect = await createProspect(context.request, {
      name: 'TL Archived Prospect',
      funnel_stage_id: stages[0]?.id,
    })
    // Archive the prospect
    await context.request.delete(`${API_URL}/api/prospects/${prospect.id}`)

    const page = await context.newPage()
    await page.goto('/prospects')
    // Show archived to make the prospect visible
    await page.getByRole('switch', { name: /show archived/i }).click()
    await page.locator('tr[aria-expanded]').filter({ hasText: 'TL Archived Prospect' }).click()
    // "Log Interaction" button must NOT be present in the timeline section
    await expect(page.getByRole('button', { name: /log interaction/i })).not.toBeVisible()
    await context.close()
  })
})
