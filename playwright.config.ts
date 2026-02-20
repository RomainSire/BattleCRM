import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * BattleCRM - Playwright E2E configuration
 *
 * Prerequisites before running:
 *   1. docker compose up postgres -d
 *   2. cd apps/backend && ENV_PATH=../../ node ace serve --hmr
 *   3. cd apps/frontend && pnpm dev
 *
 * Then run: pnpm test:e2e
 */

// Auth state file produced by auth.setup.ts
export const STORAGE_STATE = path.join(__dirname, 'tests/.auth/user.json')

export default defineConfig({
  // Root test directory — setup files live in tests/, specs in tests/e2e/
  // testMatch on each project filters which files each project picks up
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Standardized timeouts (TEA knowledge: action 15s, nav 30s, expect 10s, test 60s)
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Failure-only artifacts (saves disk space)
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['list'],
  ],

  projects: [
    // ── Setup project: creates test user and saves auth session ─────────────
    // testMatch uses a regex against the full file path — finds tests/auth.setup.ts
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // ── Chromium: runs only spec files in tests/e2e/ ────────────────────────
    {
      name: 'chromium',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },
  ],
})
