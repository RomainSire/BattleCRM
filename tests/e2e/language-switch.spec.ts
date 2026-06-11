/**
 * Language switcher E2E tests.
 *
 * Covers the shared LanguageToggle component in its two contexts:
 *  - compact variant in the guest layout header (login/register pages)
 *  - full variant on the authenticated settings page (+ persistence across reload)
 *
 * The toggle is a shadcn/Radix ToggleGroup (type="single"), so each option
 * renders with role="radio". Compact variant labels are short codes
 * (FR / EN / 日本語), full variant labels are language names (Français / English / 日本語).
 *
 * Tests assert on translated UI strings to prove the language actually changed.
 */

import { expect, test } from '../support/fixtures'

test.describe('Language switch - guest layout (compact)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('switches the login page language via the compact toggle', async ({ page }) => {
    await page.goto('/login')

    // Start from a known language so the assertions are deterministic.
    await page.getByRole('radio', { name: 'EN' }).click()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()

    // Japanese
    await page.getByRole('radio', { name: '日本語' }).click()
    await expect(page.getByRole('button', { name: 'サインイン' })).toBeVisible()

    // French
    await page.getByRole('radio', { name: 'FR' }).click()
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
  })
})

test.describe('Language switch - settings page (full)', () => {
  test('switches the UI language via the full toggle', async ({ page }) => {
    await page.goto('/settings')

    // Baseline: English.
    await page.getByRole('radio', { name: 'English' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    // Japanese.
    await page.getByRole('radio', { name: '日本語' }).click()
    await expect(page.getByRole('heading', { name: '設定' })).toBeVisible()

    // French.
    await page.getByRole('radio', { name: 'Français' }).click()
    await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible()

    // Restore English so the shared session is left in a predictable state.
    await page.getByRole('radio', { name: 'English' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('persists the chosen language across a reload', async ({ page }) => {
    await page.goto('/settings')

    await page.getByRole('radio', { name: '日本語' }).click()
    await expect(page.getByRole('heading', { name: '設定' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: '設定' })).toBeVisible()

    // Restore English so the shared session is left in a predictable state.
    await page.getByRole('radio', { name: 'English' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })
})
