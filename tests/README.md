# BattleCRM — E2E Tests (Playwright)

End-to-end tests using [Playwright](https://playwright.dev/). Tests run against the real frontend + backend stack.

---

## Prerequisites

### 1. Environment

Copy the E2E variables into your root `.env`:

```bash
# These are already in .env.example — fill in if you changed the defaults
E2E_BASE_URL=http://localhost:5173
E2E_API_URL=http://localhost:3333
E2E_TEST_EMAIL=e2e-test@battlecrm.test
E2E_TEST_PASSWORD=E2eTestPwd123!
```

Make sure `ALLOW_REGISTRATION=true` in your `.env` so the setup can create the test user.

### 2. Start services

```bash
# 1. Start PostgreSQL
docker compose up postgres -d

# 2. Start backend (terminal 1)
cd apps/backend
ENV_PATH=../../ node ace serve --hmr

# 3. Start frontend (terminal 2)
cd apps/frontend
pnpm dev
```

### 3. Install Playwright browsers (first time only)

```bash
pnpm exec playwright install chromium
```

---

## Running tests

```bash
# Run all E2E tests (headless)
pnpm test:e2e

# Run with Playwright UI (interactive mode — great for debugging)
pnpm test:e2e:ui

# Run in headed browser (see the browser)
pnpm exec playwright test --headed

# Run a specific file
pnpm exec playwright test tests/e2e/auth.spec.ts

# Debug a specific test
pnpm exec playwright test --debug tests/e2e/auth.spec.ts
```

---

## Architecture

```
tests/
├── auth.setup.ts              # Runs first: creates test user + saves session cookie
├── .auth/
│   └── user.json              # Saved session state (gitignored)
├── e2e/
│   └── auth.spec.ts           # Auth flows: login, logout, guards
└── support/
    ├── fixtures/
    │   ├── index.ts            # Merged fixtures entry point (import test from here)
    │   └── auth-fixture.ts     # loginAs(), logoutUser() helpers
    └── helpers/
        └── api.ts              # Pure API helpers (register, login, logout)
```

### Key patterns

**Fixture composition** (`mergeTests`): Each fixture has one responsibility. Import `{ test, expect }` from `tests/support/fixtures/index.ts`.

**Network-first**: Register `page.waitForResponse()` BEFORE the action that triggers the request. Avoids race conditions.

**Auth strategy**:
- `auth.setup.ts` runs once → creates test user + saves `battlecrm_session` cookie to `.auth/user.json`
- Authenticated tests load this storageState automatically (via `playwright.config.ts`)
- Guest tests override with `test.use({ storageState: { cookies: [], origins: [] } })`

**Selectors**: Prefer semantic selectors (`input[type="email"]`, `button[type="submit"]`, `role` attributes) over fragile CSS classes. Add `data-testid` attributes to key elements as the app grows.

---

## Adding tests for a new feature

1. Create `tests/e2e/<feature>.spec.ts`
2. Import from fixtures: `import { test, expect } from '../support/fixtures'`
3. Use `test.use({ storageState: { cookies: [], origins: [] } })` for guest scenarios
4. Use network-first pattern for form submissions

**Example:**
```typescript
import { expect, test } from '../support/fixtures'

test.describe('Funnel stages', () => {
  test('user can create a stage', async ({ page }) => {
    await page.goto('/settings/funnel')

    const apiResponse = page.waitForResponse(
      (r) => r.url().includes('/api/funnel_stages') && r.status() === 201,
    )
    await page.getByRole('button', { name: /add stage/i }).click()
    await page.locator('input[name="name"]').fill('My Stage')
    await page.getByRole('button', { name: /save/i }).click()
    await apiResponse

    await expect(page.getByText('My Stage')).toBeVisible()
  })
})
```

---

## Failure artifacts

When a test fails, Playwright saves:
- **Screenshot** → `test-results/<test-name>/test-failed-*.png`
- **Video** → `test-results/<test-name>/video.webm`
- **Trace** → `test-results/<test-name>/trace.zip` (open with `pnpm exec playwright show-trace`)
- **HTML report** → `playwright-report/` (open with `pnpm exec playwright show-report`)

---

## Test user

The E2E test user is created automatically by `auth.setup.ts`. It's a dedicated account that should not be used for manual testing. The user is NOT cleaned up between runs (idempotent registration).

Default credentials (override via `.env`):
- Email: `e2e-test@battlecrm.test`
- Password: `E2eTestPwd123!`
