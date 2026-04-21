/**
 * Extension fixture — Chromium persistent context with the BattleCRM extension loaded.
 *
 * ## Prerequisites
 *
 *   1. Build the extension:    pnpm build:extension
 *      (output must exist at:  apps/extension/.output/chrome-mv3/)
 *   2. Backend running:        cd apps/backend && ENV_PATH=../../ node ace serve --hmr
 *
 * ## Headless constraint
 *
 *   Chrome extensions require a headed browser (--load-extension is ignored in headless).
 *   - Locally: `headless: false` (default here)
 *   - CI:      wrap with xvfb-run → `xvfb-run pnpm test:e2e:extension`
 *
 * ## Usage
 *
 *   import { test, expect } from '../support/fixtures/extension-fixture'
 *
 *   test('popup loads', async ({ page, extensionId }) => {
 *     await page.goto(`chrome-extension://${extensionId}/popup/index.html`)
 *     await expect(page.getByRole('heading')).toBeVisible()
 *   })
 *
 * ## Auth (available after Story 7.1)
 *
 *   test('auth flow', async ({ page, extensionId, extensionLoginAs }) => {
 *     const token = await extensionLoginAs('user@test.com', 'password')
 *     // inject token into chrome.storage.local via the extension service worker…
 *   })
 */

import { chromium, test as base } from '@playwright/test'
import type { BrowserContext } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Absolute path to the WXT Chrome MV3 build output. */
export const EXTENSION_PATH = path.resolve(
  __dirname,
  '../../../apps/extension/.output/chrome-mv3',
)

const API_URL = process.env.E2E_API_URL || 'http://localhost:3333'

type ExtensionFixtures = {
  /**
   * Logs in via POST /api/extension/auth/login (Bearer token endpoint).
   * Returns the raw token. Available after Story 7.1 is implemented.
   *
   * Example:
   *   const token = await extensionLoginAs('user@e2e.test', 'password')
   *   await extensionContext.addInitScript(() => {
   *     chrome.storage.local.set({ token: '<token>', baseUrl: 'http://localhost:3333' })
   *   })
   */
  extensionLoginAs: (email: string, password: string) => Promise<string>
}

type ExtensionWorkerFixtures = {
  /** Worker-scoped persistent browser context with the extension loaded. */
  extensionContext: BrowserContext

  /**
   * The loaded extension's ID extracted from the background service worker URL.
   * Use it to navigate to extension pages:
   *   chrome-extension://${extensionId}/popup/index.html
   *   chrome-extension://${extensionId}/panel/index.html
   */
  extensionId: string
}

export const test = base.extend<ExtensionFixtures, ExtensionWorkerFixtures>({
  // ── Worker-scoped: one persistent context per worker ────────────────────────
  extensionContext: [
    async ({}, use) => {
      const context = await chromium.launchPersistentContext('', {
        headless: false,
        args: [
          `--disable-extensions-except=${EXTENSION_PATH}`,
          `--load-extension=${EXTENSION_PATH}`,
        ],
      })
      await use(context)
      await context.close()
    },
    { scope: 'worker' },
  ],

  extensionId: [
    async ({ extensionContext }, use) => {
      // The extension ID is the hostname in the service worker URL:
      // chrome-extension://<extensionId>/background.js
      let [background] = extensionContext.serviceWorkers()
      if (!background) {
        background = await extensionContext.waitForEvent('serviceworker', {
          timeout: 10_000,
        })
      }
      const extensionId = new URL(background.url()).hostname
      await use(extensionId)
    },
    { scope: 'worker' },
  ],

  // ── Test-scoped: override context so page uses the persistent context ────────
  context: async ({ extensionContext }, use) => {
    await use(extensionContext)
  },

  // ── Test-scoped: explicitly close the page after each test ──────────────────
  // Without this override, pages accumulate in the persistent context until the
  // worker shuts down (context.close() is the only cleanup, but it's worker-scoped).
  page: async ({ extensionContext }, use) => {
    const page = await extensionContext.newPage()
    await use(page)
    await page.close().catch(() => {})
  },

  // ── Test-scoped helpers ──────────────────────────────────────────────────────
  extensionLoginAs: async ({ extensionContext }, use) => {
    await use(async (email: string, password: string) => {
      const res = await extensionContext.request.post(
        `${API_URL}/api/extension/auth/login`,
        { data: { email, password, name: 'E2E Test' } },
      )
      if (!res.ok()) {
        throw new Error(`extensionLoginAs failed: ${res.status()} ${await res.text()}`)
      }
      const body = await res.json()
      return body.token as string
    })
  },
})

export { expect } from '@playwright/test'
