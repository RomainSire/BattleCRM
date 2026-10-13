import { setLocale } from '@battlecrm/i18n/runtime';
import { del } from 'idb-keyval';
import { beforeEach } from 'vitest';
import { commands } from 'vitest/browser';

import { toasts } from '../src/components/ui/toast.tsx';
import { DEVICE_DATA_KEY } from '../src/device-data.ts';

import '../src/index.css';

beforeEach(async () => {
  localStorage.clear();
  // What a previous test left on the device: the summary it kept and its notifications.
  await del(DEVICE_DATA_KEY);
  toasts.clear();
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
