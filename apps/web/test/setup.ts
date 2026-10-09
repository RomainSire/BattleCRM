import { setLocale } from '@battlecrm/i18n/runtime';
import { beforeEach } from 'vitest';
import { commands } from 'vitest/browser';

import '../src/index.css';

beforeEach(async () => {
  localStorage.clear();
  document.documentElement.className = '';
  await setLocale('fr', { reload: false });
  await commands.emulateColorScheme('light');
});

declare module 'vitest/browser' {
  interface BrowserCommands {
    /** Defined in vitest.config.ts. */
    emulateColorScheme: (scheme: 'light' | 'dark') => Promise<void>;
  }
}
