import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * BattleCRM - Playwright E2E configuration
 *
 * The `webServer` block below builds and starts the backend (compiled, no HMR)
 * and the frontend (production build served by `vite preview`). Serving built
 * assets instead of the Vite/AdonisJS dev servers removes the on-demand
 * compilation jitter that made the suite flaky under parallel load.
 *
 * Only prerequisite:
 *   docker compose up postgres -d   (+ migrations on a fresh volume)
 *
 * Then run: pnpm test:e2e
 *
 * Locally, `reuseExistingServer` means an already-running server on the port is
 * reused as-is — stop `pnpm dev` first if you want the built servers to be used.
 */

// Number of parallel workers — each gets its own test user to avoid DB conflicts.
export const WORKER_COUNT = 8

/** Returns the auth state file path for worker n. */
export const getStorageStatePath = (n: number) =>
  path.join(__dirname, 'tests/.auth', `worker-${n}.json`)

export default defineConfig({
  // Root test directory — setup files live in tests/, specs in tests/e2e/
  // testMatch on each project filters which files each project picks up
  testDir: './tests',
  // Each spec file runs in its own worker; tests within a spec run serially
  // (test.describe.configure({ mode: 'serial' }) inside each describe block).
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: WORKER_COUNT,

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

  // Build + start both apps as compiled/preview servers (no dev-mode jitter).
  // Both build steps run in parallel; healthchecks gate test start.
  webServer: [
    {
      // Backend: `ace build` then run the compiled server (plain JS, no HMR).
      // Run from build/ with ENV_PATH=../../../ → resolves the root .env;
      // deps resolve upward to apps/backend/node_modules (no install needed locally).
      command:
        'pnpm --filter @battlecrm/backend build && cd apps/backend/build && ENV_PATH=../../../ node bin/server.js',
      url: `${process.env.E2E_API_URL || 'http://localhost:3333'}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // Frontend: production build served statically by vite preview.
      command:
        'pnpm --filter @battlecrm/frontend build && pnpm --filter @battlecrm/frontend preview --port 5173 --strictPort',
      url: process.env.E2E_BASE_URL || 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],

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
    // storageState is NOT set here — provided dynamically by the worker fixture
    // (each worker uses its own auth file: tests/.auth/worker-{n}.json).
    {
      name: 'chromium',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        locale: 'en',
      },
      dependencies: ['setup'],
    },

    // ── Extension: runs spec files in tests/e2e-extension/ ──────────────────
    // Uses a persistent Chromium context with --load-extension (see extension-fixture.ts).
    // Does NOT depend on `setup` — extension tests use Bearer tokens, not session cookies.
    // Requires: pnpm build:extension (apps/extension/.output/chrome-mv3/ must exist).
    // CI: wrap with xvfb-run (extensions require a display server).
    // Run standalone: pnpm test:e2e:extension
    {
      name: 'extension',
      testMatch: /e2e-extension\/.*\.spec\.ts/,
    },
  ],
})
