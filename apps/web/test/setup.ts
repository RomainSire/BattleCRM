import { setLocale } from '@battlecrm/i18n/runtime';
import { del } from 'idb-keyval';
import { beforeEach, vi } from 'vitest';
import { commands } from 'vitest/browser';
import { cleanup } from 'vitest-browser-react/pure';

import { appUpdate } from '../src/app-update.tsx';
import { toasts } from '../src/components/ui/toast.tsx';
import { DEVICE_DATA_KEY } from '../src/device-data.ts';

import '../src/index.css';

// Test files run side by side in one origin, which shares IndexedDB: each file keeps the device's copy
// in a database of its own, or one file's summary would be restored into another's screens.
vi.mock('idb-keyval', async (importOriginal) => {
  const idb = await importOriginal<typeof import('idb-keyval')>();
  const store = idb.createStore(`battlecrm-test-${crypto.randomUUID()}`, 'keyval');
  return {
    ...idb,
    get: (key: IDBValidKey) => idb.get(key, store),
    set: (key: IDBValidKey, value: unknown) => idb.set(key, value, store),
    del: (key: IDBValidKey) => idb.del(key, store),
  };
});

beforeEach(async () => {
  // The previous test's app goes first: still mounted, it could keep its summary after the erase below.
  await cleanup();
  localStorage.clear();
  // What a previous test left on the device: the summary it kept and its notifications.
  await del(DEVICE_DATA_KEY);
  toasts.clear();
  appUpdate.clear();
  document.documentElement.className = '';
  await setLocale('fr', { reload: false });
  await commands.emulateColorScheme('light');
  await commands.emulateReducedMotion('no-preference');
  await commands.parkPointer();
});

declare module 'vitest/browser' {
  interface BrowserCommands {
    /** Defined in vitest.config.ts. */
    emulateColorScheme: (scheme: 'light' | 'dark') => Promise<void>;
    /** Defined in vitest.config.ts. */
    emulateReducedMotion: (reducedMotion: 'reduce' | 'no-preference') => Promise<void>;
    /** Defined in vitest.config.ts. */
    parkPointer: () => Promise<void>;
  }
}
