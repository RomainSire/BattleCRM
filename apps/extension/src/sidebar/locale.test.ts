import { expect, test } from 'vitest';

import { browserLocale } from './locale.ts';

test('the first language of the browser the app speaks, English otherwise', () => {
  expect(browserLocale(['fr-FR', 'en-US'])).toBe('fr');
  expect(browserLocale(['de-DE', 'en-GB', 'fr'])).toBe('en');
  expect(browserLocale(['de-DE', 'fr-CA'])).toBe('fr');
  expect(browserLocale(['de-DE'])).toBe('en');
  expect(browserLocale([])).toBe('en');
});
