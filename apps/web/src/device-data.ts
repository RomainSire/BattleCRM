import type { QueryClient } from '@tanstack/react-query';

/**
 * Erases what this device keeps of a User (spec UX §5.9): called when signing out, and before a sign-in
 * shows anything, since a device signed out from elsewhere never got to erase it.
 * The working summary persisted in IndexedDB joins here with its ticket (13).
 */
export function clearDeviceData(queryClient: QueryClient): void {
  queryClient.clear();
}
