import { toasts } from '@battlecrm/ui';
import type { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';

import { SUMMARY_KEY } from './summary.ts';

/** Where IndexedDB keeps the working summary: the only copy of a User's data on a device (ST-04). */
export const DEVICE_DATA_KEY = 'battlecrm.summary';

/** As long as a session: past that, the device has to sign in again anyway. */
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

// A device that refuses IndexedDB only loses the offline reading: nothing to report.
const ignore = () => undefined;

/**
 * Keeps the working summary in IndexedDB, and nothing else, so that the app still reads offline
 * (ADR 0004, 0012). A new version of the app starts from a fresh read.
 */
export const devicePersistence: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: {
    persistClient: (client) => set(DEVICE_DATA_KEY, client).catch(ignore),
    restoreClient: () => get(DEVICE_DATA_KEY),
    removeClient: () => del(DEVICE_DATA_KEY).catch(ignore),
  },
  maxAge: MAX_AGE_MS,
  buster: import.meta.env.VITE_APP_VERSION ?? 'dev',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.queryKey[0] === SUMMARY_KEY[0] && query.state.status === 'success',
  },
};

/**
 * Erases what this device keeps of a User (spec UX §5.9): called when signing out, and before a sign-in
 * shows anything, since a device signed out from elsewhere never got to erase it.
 */
export function clearDeviceData(queryClient: QueryClient): void {
  queryClient.clear();
  // A notification of the previous User could still undo one of its gestures.
  toasts.clear();
  void del(DEVICE_DATA_KEY).catch(ignore);
}
