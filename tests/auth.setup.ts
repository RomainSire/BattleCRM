/**
 * Authentication Setup — runs once before all E2E tests.
 *
 * Creates one test user per Playwright worker (idempotent — handles existing users),
 * logs each in, and saves the session cookie to tests/.auth/worker-{n}.json.
 *
 * Each worker gets its own isolated user account to prevent cross-worker DB conflicts
 * when specs run in parallel.
 */

import { test as setup } from '@playwright/test'
import { getStorageStatePath, WORKER_COUNT } from '../playwright.config'

// Backend URL (direct — Vite does NOT proxy /api in dev)
const API_URL = process.env.E2E_API_URL || 'http://localhost:3333'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'E2eTestPwd123!'

function workerEmail(n: number) {
  return `e2e-worker-${n}@battlecrm.test`
}

setup('create authenticated sessions', async ({ browser }) => {
  for (let n = 0; n < WORKER_COUNT; n++) {
    const email = workerEmail(n)
    const authFile = getStorageStatePath(n)

    // Create a fresh browser context for each worker's auth session.
    // context.request shares cookies with the browser context, so
    // storageState() captures the session cookie set by register/login.
    const context = await browser.newContext()

    const registerResponse = await context.request.post(`${API_URL}/api/auth/register`, {
      data: { email, password: TEST_PASSWORD, password_confirmation: TEST_PASSWORD },
    })

    if (registerResponse.status() === 422) {
      // User already exists — log in to get a fresh session
      const loginResponse = await context.request.post(`${API_URL}/api/auth/login`, {
        data: { email, password: TEST_PASSWORD },
      })
      if (!loginResponse.ok()) {
        const body = await loginResponse.text()
        throw new Error(`Worker ${n} login failed (${loginResponse.status()}): ${body}`)
      }
    } else if (!registerResponse.ok()) {
      const body = await registerResponse.text()
      throw new Error(`Worker ${n} registration failed (${registerResponse.status()}): ${body}`)
    }
    // else: 201 → register auto-logged in, session cookie already set

    await context.storageState({ path: authFile })
    await context.close()
  }
})
