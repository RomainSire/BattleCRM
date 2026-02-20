/**
 * Authentication Setup — runs once before all E2E tests.
 *
 * Creates the E2E test user (idempotent — ignores 409 if already exists),
 * logs in, and saves the session cookie to tests/.auth/user.json.
 *
 * All tests that use storageState will start as this authenticated user.
 */

import { test as setup } from '@playwright/test'

// ESM-compatible path resolution (no __dirname in ES modules)
const AUTH_FILE = new URL('.auth/user.json', import.meta.url).pathname

// Backend URL (direct — Vite does NOT proxy /api in dev)
const API_URL = process.env.E2E_API_URL || 'http://localhost:3333'
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@battlecrm.test'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'E2eTestPwd123!'

setup('create authenticated session', async ({ page }) => {
  // Use the browser context's request so that session cookies are shared
  // with the browser context and captured by storageState().
  //
  // IMPORTANT: The register endpoint (AuthController.register) auto-logs the
  // user in on success (auth.use('web').login(user)). So:
  //   - 201 Created → user is already authenticated in this request context
  //   - 422 Unprocessable Entity → email already exists, must login separately
  //   - Any other status → unexpected failure, throw
  const ctx = page.context()
  const registerResponse = await ctx.request.post(`${API_URL}/api/auth/register`, {
    data: {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      password_confirmation: TEST_PASSWORD,
    },
  })

  if (registerResponse.status() === 422) {
    // User already exists — log in to get a fresh session
    const loginResponse = await ctx.request.post(`${API_URL}/api/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    if (!loginResponse.ok()) {
      const body = await loginResponse.text()
      throw new Error(`E2E test user login failed (${loginResponse.status()}): ${body}`)
    }
  } else if (!registerResponse.ok()) {
    const body = await registerResponse.text()
    throw new Error(`E2E test user registration failed (${registerResponse.status()}): ${body}`)
  }
  // else: 201 → register auto-logged us in, session cookie is already set

  // Cookies from ctx.request are shared with the browser context.
  await ctx.storageState({ path: AUTH_FILE })
})
