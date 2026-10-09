import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'domain',
          root: 'packages/domain',
          environment: 'node',
        },
      },
      {
        test: {
          name: 'api',
          root: 'apps/api',
          environment: 'node',
          // Time-zone cases are written explicitly; the process itself always runs in UTC.
          env: { TZ: 'UTC' },
          globalSetup: ['test/global-setup.ts'],
          setupFiles: ['test/setup.ts'],
        },
      },
      {
        test: {
          name: 'web',
          root: 'apps/web',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
