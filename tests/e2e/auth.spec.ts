/**
 * Auth E2E tests — covers login, logout, and route guards.
 *
 * Authenticated tests: use storageState from playwright.config.ts (default).
 * Unauthenticated tests: override with empty storageState via test.use().
 *
 * Routing note: the dashboard lives at "/" (not "/dashboard").
 * The catch-all route (*) redirects everything else to "/".
 */

import { expect, test } from '../support/fixtures'

// ── Unauthenticated flows ────────────────────────────────────────────────────
// These tests override the global storageState to simulate a guest user.

test.describe('Guest user', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('is redirected to /login when accessing /', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('can access the login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('can access the register page', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    // Two password fields (password + confirmation)
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('login with wrong password shows an error', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('wrong@example.com')
    await page.locator('input[type="password"]').fill('wrongpassword')

    // Register network interception BEFORE submitting (network-first pattern)
    const loginResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/login') && resp.status() !== 200,
    )
    await page.locator('button[type="submit"]').click()
    await loginResponse

    // Error message should be visible
    await expect(page.locator('[role="alert"], .text-destructive, [data-error]').first()).toBeVisible()
    // URL should NOT have changed (still on login page)
    await expect(page).toHaveURL(/\/login/)
  })

  test('successful login redirects to dashboard (/)', async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL || 'e2e-test@battlecrm.test'
    const password = process.env.E2E_TEST_PASSWORD || 'E2eTestPwd123!'

    await page.goto('/login')
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)

    // Intercept before submit
    const loginResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/login') && resp.status() === 200,
    )
    await page.locator('button[type="submit"]').click()
    await loginResponse

    // Dashboard lives at "/" — GuestGuard redirects authenticated users to "/"
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
  })
})

// ── Authenticated flows ──────────────────────────────────────────────────────
// These tests use the global storageState (logged-in test user).

test.describe('Authenticated user', () => {
  test('can access the dashboard at /', async ({ page }) => {
    await page.goto('/')
    // AuthGuard lets the request through — DashboardPage renders
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
  })

  test('is redirected away from /login when already authenticated', async ({ page }) => {
    await page.goto('/login')
    // GuestGuard redirects authenticated users to "/"
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
  })

  test('is redirected away from /register when already authenticated', async ({ page }) => {
    await page.goto('/register')
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
  })

  test('session persists after page refresh', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)

    await page.reload()
    // Should still be on dashboard (session cookie is valid)
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
  })

  test('logout redirects to /login', async ({ page }) => {
    await page.goto('/')

    // Intercept logout request before clicking
    const logoutResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/logout') && resp.status() === 200,
    )
    // i18n-safe: en="Log out", fr="Se déconnecter"
    await page.getByRole('button', { name: /log out|se déconnecter/i }).click()
    await logoutResponse

    await expect(page).toHaveURL(/\/login/)
  })

  test('cannot access dashboard after logout', async ({ page, logoutUser }) => {
    // Logout via API (fast — no UI interaction needed)
    await logoutUser()

    // Try to access dashboard — AuthGuard should redirect to /login
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })
})
