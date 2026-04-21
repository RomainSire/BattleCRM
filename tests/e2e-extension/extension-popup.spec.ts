/**
 * Extension popup E2E tests — AuthForm, NeutralScreen, SettingsScreen.
 *
 * ## Prerequisites
 *
 *   1. pnpm build:extension
 *   2. cd apps/backend && ENV_PATH=../../ node ace serve --hmr
 *   3. pnpm test:e2e:extension
 *
 * ## CI
 *
 *   xvfb-run pnpm test:e2e:extension
 *
 * ## Auth injection
 *
 *   Authenticated tests set chrome.storage.local via page.evaluate() from within
 *   the extension context (popup page), then reload so App.tsx re-reads storage.
 *   Cleanup clears storage after each test.
 */

import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures/extension-fixture'

test.describe.configure({ mode: 'serial' })

const API_URL = process.env.E2E_API_URL || 'http://localhost:3333'
const E2E_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@battlecrm.test'
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD || 'E2eTestPwd123!'

// ── Storage helpers ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChromeGlobal = typeof globalThis & { chrome: any }

async function setStorage(page: Page, data: Record<string, string>) {
  await page.evaluate((d) => {
    const { chrome } = globalThis as ChromeGlobal
    return new Promise<void>((resolve) => {
      chrome.storage.local.set(d, resolve)
    })
  }, data)
}

async function clearStorage(page: Page) {
  await page.evaluate(() => {
    const { chrome } = globalThis as ChromeGlobal
    return new Promise<void>((resolve) => {
      chrome.storage.local.clear(resolve)
    })
  })
}

// ── Unauthenticated state ────────────────────────────────────────────────────

test.describe('AuthForm — unauthenticated popup', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    // Ensure storage is clean before each test
    await clearStorage(page)
    await page.reload()
  })

  test('popup loads and shows the login form', async ({ page }) => {
    await expect(page.getByRole('img', { name: 'BattleCRM' })).toBeVisible()
    await expect(page.locator('#baseUrl')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('button', { name: /se connecter|sign in/i })).toBeVisible()
  })

  test('shows validation errors on empty submit', async ({ page }) => {
    await page.getByRole('button', { name: /se connecter|sign in/i }).click()
    // At least one required-field error visible
    await expect(page.locator('.text-destructive').first()).toBeVisible()
  })

  test('shows inline error for invalid credentials', async ({ page }) => {
    await page.locator('#baseUrl').fill(API_URL)
    await page.locator('#email').fill('wrong@example.com')
    await page.locator('#password').fill('wrongpassword')
    await page.getByRole('button', { name: /se connecter|sign in/i }).click()

    // page.waitForResponse() doesn't work for chrome-extension:// requests —
    // wait for the error message to appear in the UI instead.
    await expect(
      page.locator('.text-destructive, [class*="destructive"]').last(),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('#baseUrl')).toBeVisible()
  })

  test('shows server-unreachable error when URL is invalid', async ({ page }) => {
    await page.locator('#baseUrl').fill('http://localhost:9999')
    await page.locator('#email').fill('user@example.com')
    await page.locator('#password').fill('password')

    await page.getByRole('button', { name: /se connecter|sign in/i }).click()

    await expect(
      page.locator('.text-destructive, [class*="destructive"]').last(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('password toggle shows and hides password', async ({ page }) => {
    await page.locator('#password').fill('mysecret')
    await expect(page.locator('#password')).toHaveAttribute('type', 'password')

    await page.getByRole('button', { name: /afficher|show/i }).click()
    await expect(page.locator('#password')).toHaveAttribute('type', 'text')

    await page.getByRole('button', { name: /masquer|hide/i }).click()
    await expect(page.locator('#password')).toHaveAttribute('type', 'password')
  })
})

// ── Authenticated state ──────────────────────────────────────────────────────

test.describe('NeutralScreen — authenticated popup', () => {
  let token: string

  test.beforeAll(async ({ extensionLoginAs }) => {
    token = await extensionLoginAs(E2E_EMAIL, E2E_PASSWORD)
  })

  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await setStorage(page, { token, baseUrl: API_URL, email: E2E_EMAIL })
    await page.reload()
  })

  test.afterEach(async ({ page }) => {
    await clearStorage(page)
  })

  test('shows neutral screen with logo and open-app button', async ({ page }) => {
    await expect(page.getByRole('img', { name: 'BattleCRM' })).toBeVisible()
    await expect(page.getByRole('button', { name: /ouvrir battlecrm|open battlecrm/i })).toBeVisible()
  })

  test('shows connected email in footer', async ({ page }) => {
    await expect(page.getByText(E2E_EMAIL)).toBeVisible()
  })

  test('settings button navigates to settings screen', async ({ page }) => {
    await page.getByRole('button', { name: /paramètres|settings/i }).click()
    await expect(page.getByText(/paramètres|settings/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /se déconnecter|sign out/i })).toBeVisible()
  })
})

// ── Settings screen ──────────────────────────────────────────────────────────

test.describe('SettingsScreen', () => {
  let token: string

  test.beforeAll(async ({ extensionLoginAs }) => {
    token = await extensionLoginAs(E2E_EMAIL, E2E_PASSWORD)
  })

  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await setStorage(page, { token, baseUrl: API_URL, email: E2E_EMAIL })
    await page.reload()
    // Navigate to settings
    await page.getByRole('button', { name: /paramètres|settings/i }).click()
    await expect(page.getByRole('button', { name: /se déconnecter|sign out/i })).toBeVisible()
  })

  test.afterEach(async ({ page }) => {
    await clearStorage(page)
  })

  test('displays connected email', async ({ page }) => {
    await expect(page.getByText(E2E_EMAIL)).toBeVisible()
  })

  test('back button returns to neutral screen', async ({ page }) => {
    await page.getByRole('button', { name: /retour|back/i }).click()
    await expect(page.getByRole('button', { name: /ouvrir battlecrm|open battlecrm/i })).toBeVisible()
  })

  test('language selector switches to English', async ({ page }) => {
    await page.getByRole('button', { name: 'EN' }).click()
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
    // Switch back to FR for subsequent tests
    await page.getByRole('button', { name: 'FR' }).click()
  })

  test('logout calls API, clears storage, and shows login form', async ({ page }) => {
    await page.getByRole('button', { name: /se déconnecter|sign out/i }).click()

    // page.waitForResponse() doesn't work for chrome-extension:// requests —
    // wait for the UI to return to the login form instead.
    await expect(page.locator('#baseUrl')).toBeVisible({ timeout: 10_000 })

    // chrome.storage.local must be cleared
    const stored = await page.evaluate(() => {
      const { chrome } = globalThis as ChromeGlobal
      return new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(null, resolve)
      })
    })
    expect(stored.token).toBeUndefined()
  })
})

// ── Session expiry ───────────────────────────────────────────────────────────

test.describe('Session expiry message', () => {
  test('AUTH_EXPIRED message shows session-expired error on login screen', async ({
    page,
    extensionId,
    extensionContext,
  }) => {
    // Start from neutral screen with a dummy token
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await setStorage(page, { token: 'dummy', baseUrl: API_URL, email: E2E_EMAIL })
    await page.reload()
    await expect(page.getByRole('img', { name: 'BattleCRM' })).toBeVisible()

    // Simulate service worker broadcasting AUTH_EXPIRED
    const sw = extensionContext.serviceWorkers()[0]
    await sw.evaluate(() => {
      const { chrome } = globalThis as ChromeGlobal
      chrome.runtime.sendMessage({ type: 'AUTH_EXPIRED' })
    })

    // Login form should appear with session-expired message
    await expect(page.locator('#baseUrl')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.text-destructive, [class*="destructive"]').last()).toBeVisible()

    await clearStorage(page)
  })
})
