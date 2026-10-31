import { useLayoutEffect, useSyncExternalStore } from 'react';

const darkScheme = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void) {
  const query = matchMedia(darkScheme);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const systemIsDark = () => matchMedia(darkScheme).matches;

/**
 * Light or dark as the system is, live (spec extension §13, A5): the app's own choice is a preference
 * of its device, out of the extension's reach.
 */
export function useSystemTheme() {
  const dark = useSyncExternalStore(subscribe, systemIsDark);
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
}
