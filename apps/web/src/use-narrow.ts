import { useSyncExternalStore } from 'react';

/** Narrow width, where the mobile layout takes over: below Tailwind's `md` (ST-02, spec UX §1). */
const NARROW = '(width < 48rem)';

function subscribe(listener: () => void) {
  const query = matchMedia(NARROW);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

/** Whether the screen is narrow; a component that calls it is rendered again when that changes. */
export function useIsNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => matchMedia(NARROW).matches);
}
