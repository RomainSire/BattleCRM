/**
 * Settings - Data & Backup E2E tests
 *
 * Covers the "Data & backup" card at the bottom of /settings:
 *   - Export: triggers a `.json.gz` download with the dated filename + success toast.
 *   - Import dialog: strong destructive confirmation (file picker + typed RESTORE word),
 *     Restore button gated until both are provided, cancel closes without acting.
 *   - Round-trip restore: export → add extra data → import the export → the extra data
 *     is gone and the original data is back (cache invalidated after a total replacement).
 *
 * Tests run serially (shared worker account — state must be predictable) and share the
 * file downloaded by the export test so the import test restores a real, self-produced
 * backup. NOTE (per CLAUDE.md): these specs are written but NOT run automatically — they
 * are slow and must be launched by Romain (`pnpm test:e2e`).
 */

import os from 'node:os'
import path from 'node:path'
import { expect, test } from '../support/fixtures'
import { createProspect, hardResetTestData, resetFunnelStages } from '../support/helpers/api'

test.describe('Settings - Data & Backup', () => {
  test.describe.configure({ mode: 'serial' })

  // Path of the file produced by the export test, reused by the import round-trip.
  let exportedFilePath: string

  test.beforeAll(async ({ browser, workerStorageState }) => {
    const context = await browser.newContext({ storageState: workerStorageState })
    await hardResetTestData(context.request)
    await resetFunnelStages(context.request)
    // Baseline prospect: must be present in the export AND restored by the import.
    await createProspect(context.request, { name: 'Backup Prospect Alpha' })
    await context.close()
  })

  // ── Card presence ───────────────────────────────────────────────────────────

  test('settings page shows the Data & backup card with export and import actions', async ({
    page,
  }) => {
    await page.goto('/settings')
    await expect(page.getByText('Data & backup', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^export$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /import a file/i })).toBeVisible()
  })

  // ── Export ──────────────────────────────────────────────────────────────────

  test('export downloads a dated .json.gz backup and shows a success toast', async ({ page }) => {
    await page.goto('/settings')

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /^export$/i }).click()
    const download = await downloadPromise

    // Filename follows battlecrm-export-<YYYY-MM-DD>.json.gz
    expect(download.suggestedFilename()).toMatch(/^battlecrm-export-\d{4}-\d{2}-\d{2}\.json\.gz$/)

    // Persist the file so the import round-trip can restore a real backup.
    exportedFilePath = path.join(os.tmpdir(), `battlecrm-e2e-backup-${Date.now()}.json.gz`)
    await download.saveAs(exportedFilePath)

    await expect(page.getByText(/export downloaded/i)).toBeVisible()
  })

  // ── Import dialog — confirmation gating ───────────────────────────────────────

  test('import dialog shows the destructive warning and the file picker', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /import a file/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/import \/ restore my data/i)
    await expect(dialog).toContainText(/permanently replace/i)
    await expect(dialog.getByRole('button', { name: /choose a file/i })).toBeVisible()
  })

  test('Restore button stays disabled until a file is chosen AND the confirm word is typed', async ({
    page,
  }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /import a file/i }).click()

    const dialog = page.getByRole('dialog')
    const restoreBtn = dialog.getByRole('button', { name: /restore my data/i })

    // Nothing provided yet.
    await expect(restoreBtn).toBeDisabled()

    // File chosen but no confirmation word → still disabled.
    // The native <input type="file"> is visually hidden (sr-only) but still settable.
    await dialog.locator('#backup-file').setInputFiles(exportedFilePath)
    await expect(dialog.getByText(path.basename(exportedFilePath))).toBeVisible()
    await expect(restoreBtn).toBeDisabled()

    // Wrong confirmation word → still disabled.
    await dialog.locator('#backup-confirm').fill('restore-please')
    await expect(restoreBtn).toBeDisabled()

    // Exact confirmation word → enabled.
    await dialog.locator('#backup-confirm').fill('RESTORE')
    await expect(restoreBtn).toBeEnabled()
  })

  test('cancel closes the import dialog without restoring', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /import a file/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  // ── Round-trip restore ────────────────────────────────────────────────────────

  test('round-trip: importing the export restores account state and removes newer data', async ({
    page,
  }) => {
    // Create an extra prospect AFTER the export was taken — it must vanish on restore.
    await createProspect(page.context().request, { name: 'Ephemeral Prospect Zeta' })

    // Sanity check: the extra prospect is visible before the restore.
    await page.goto('/prospects')
    await expect(page.getByText('Ephemeral Prospect Zeta')).toBeVisible()

    // Open the import dialog, select the previously exported file, confirm, restore.
    await page.goto('/settings')
    await page.getByRole('button', { name: /import a file/i }).click()

    const dialog = page.getByRole('dialog')
    await dialog.locator('#backup-file').setInputFiles(exportedFilePath)
    await dialog.locator('#backup-confirm').fill('RESTORE')

    const importResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/backup/import') &&
        resp.request().method() === 'POST' &&
        resp.status() === 200,
    )
    await dialog.getByRole('button', { name: /restore my data/i }).click()
    await importResponse

    // Dialog closes + success toast.
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByText(/data restored successfully/i)).toBeVisible()

    // Cache invalidated globally → original prospect back, ephemeral one gone.
    await page.goto('/prospects')
    await expect(page.getByText('Backup Prospect Alpha')).toBeVisible()
    await expect(page.getByText('Ephemeral Prospect Zeta')).not.toBeVisible()
  })
})
