import { createContext, use, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

/** The theme is a device preference, not a User one (ST-52). */
export type ThemePreference = 'system' | 'light' | 'dark';

const storageKey = 'battlecrm.theme';

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';

// Storage can throw (private mode, blocked site data): the theme then lives for the session only.
function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(storageKey);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function writePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(storageKey, preference);
  } catch {
    // Kept in memory only.
  }
}

const darkScheme = '(prefers-color-scheme: dark)';

function subscribeToSystemScheme(onChange: () => void) {
  const query = matchMedia(darkScheme);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const systemPrefersDark = () => matchMedia(darkScheme).matches;

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** System / Light / Dark per device, following the system's scheme live (spec UX §2). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readPreference);
  const systemIsDark = useSyncExternalStore(subscribeToSystemScheme, systemPrefersDark);
  const resolvedTheme = preference === 'system' ? (systemIsDark ? 'dark' : 'light') : preference;

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  const setPreference = (next: ThemePreference) => {
    writePreference(next);
    setPreferenceState(next);
  };

  return (
    <ThemeContext value={{ preference, resolvedTheme, setPreference }}>{children}</ThemeContext>
  );
}

export function useTheme() {
  const context = use(ThemeContext);
  if (context === null) throw new Error('useTheme needs a ThemeProvider');
  return context;
}
