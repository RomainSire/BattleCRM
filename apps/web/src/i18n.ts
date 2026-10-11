import { getLocale, locales, setLocale } from '@battlecrm/i18n/runtime';
import { useSyncExternalStore } from 'react';

export type Locale = (typeof locales)[number];
export { locales };

/** The page's `lang` follows the current locale, for screen readers and hyphenation. */
export function applyDocumentLanguage() {
  document.documentElement.lang = getLocale();
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Changes the language of this device without reloading the page: what is being typed stays. */
export async function changeLocale(locale: Locale) {
  await setLocale(locale, { reload: false });
  applyDocumentLanguage();
  for (const listener of listeners) listener();
}

/** The current locale; a component that calls it is rendered again when the language changes. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale);
}
