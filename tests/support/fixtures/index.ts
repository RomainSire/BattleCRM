/**
 * Merged fixture entry point — import { test, expect } from here in all test files.
 *
 * Composition pattern: mergeTests combines focused fixtures without inheritance.
 * Add new fixtures here as the test suite grows.
 */

import { mergeTests } from '@playwright/test'
import { test as authFixture } from './auth-fixture'
import { test as workerFixture } from './worker-fixture'

// Compose all fixtures
export const test = mergeTests(authFixture, workerFixture)
export { expect } from '@playwright/test'
