import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

// Offline, the app reads what the device kept and saves nothing (ADR 0004). Whether it is online is
// TanStack Query's own view, set from the browser's: screens and queries never disagree.

const subscribe = (listener: () => void) => onlineManager.subscribe(listener);
const isOnline = () => onlineManager.isOnline();

/** Whether this device can reach the API: actions are disabled when it cannot (ST-03). */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline);
}

/** Submits a form from the keyboard as its button would: never offline, where nothing is saved. */
export function submitIfOnline(form: HTMLFormElement | null): void {
  if (isOnline()) form?.requestSubmit();
}
