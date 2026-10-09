import { getLocale } from '@battlecrm/i18n/runtime';

/** The page's `lang` follows the current locale, for screen readers and hyphenation. */
export function applyDocumentLanguage() {
  document.documentElement.lang = getLocale();
}
