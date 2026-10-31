import type { locales } from '@battlecrm/i18n/runtime';

export type Locale = (typeof locales)[number];

/**
 * The language of the sidebar (spec extension §9): the browser's first one the app speaks, English
 * otherwise. No setting: nothing is kept.
 */
export function browserLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (base === 'fr' || base === 'en') return base;
  }
  return 'en';
}
