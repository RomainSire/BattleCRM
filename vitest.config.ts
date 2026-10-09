import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import type { BrowserCommand } from 'vitest/node';

/** Switches the operating system's colour scheme seen by the page, as a user would. */
const emulateColorScheme: BrowserCommand<['light' | 'dark']> = async (context, scheme) => {
  if (context.provider.name !== 'playwright')
    throw new Error('emulateColorScheme needs Playwright');
  await context.page.emulateMedia({ colorScheme: scheme });
};

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
        // The SPA's own Vite config (React, Tailwind): axe measures the real styles.
        extends: 'apps/web/vite.config.ts',
        test: {
          name: 'web',
          root: 'apps/web',
          setupFiles: ['test/setup.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            commands: { emulateColorScheme },
          },
        },
      },
    ],
  },
});
