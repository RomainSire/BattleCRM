import { setLocale } from '@battlecrm/i18n/runtime';
import { beforeEach } from 'vitest';
import { commands } from 'vitest/browser';
import { cleanup } from 'vitest-browser-react/pure';

import '../src/sidebar/sidebar.css';

beforeEach(async () => {
  await cleanup();
  localStorage.clear();
  document.documentElement.className = '';
  await setLocale('fr', { reload: false });
  await commands.emulateColorScheme('light');
  await commands.parkPointer();
});

declare module 'vitest/browser' {
  interface BrowserCommands {
    /** Defined in vitest.config.ts. */
    emulateColorScheme: (scheme: 'light' | 'dark') => Promise<void>;
    /** Defined in vitest.config.ts. */
    parkPointer: () => Promise<void>;
  }
}
