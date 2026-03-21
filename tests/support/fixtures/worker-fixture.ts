/**
 * Worker fixture — provides per-worker auth state for parallel test execution.
 *
 * Each Playwright worker gets its own test user (e2e-worker-{n}@battlecrm.test)
 * to avoid DB state conflicts between parallel spec files.
 *
 * - workerStorageState: the auth file path for the current worker (worker-scoped).
 *   Use this in beforeAll hooks when creating manual browser contexts.
 * - storageState: overrides the built-in Playwright fixture to use the worker's
 *   auth file by default. Tests that need a guest context can still override with
 *   test.use({ storageState: { cookies: [], origins: [] } }).
 */

import { test as base, type BrowserContextOptions } from '@playwright/test'
import { getStorageStatePath } from '../../../playwright.config'

// Match the type Playwright uses for the built-in storageState fixture option.
type StorageStateOption = BrowserContextOptions['storageState']

type WorkerFixtures = {
  workerStorageState: string
}

export const test = base.extend<{ storageState: StorageStateOption }, WorkerFixtures>({
  workerStorageState: [
    async ({}, use, workerInfo) => {
      await use(getStorageStatePath(workerInfo.parallelIndex))
    },
    { scope: 'worker' },
  ],

  // Override the built-in storageState fixture so page contexts in tests
  // start authenticated as the worker's dedicated user.
  // test.use({ storageState: { cookies: [], origins: [] } }) still overrides this.
  storageState: ({ workerStorageState }, use) => use(workerStorageState),
})
