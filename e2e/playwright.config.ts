import { defineConfig, devices } from '@playwright/test';

// Against compose.e2e.yml, already up: the built images behind a Traefik on port 8080 (spec stack §13).
export default defineConfig({
  testDir: 'tests',
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:8080',
    // The default locale of the SPA, whatever the machine running the tests.
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
