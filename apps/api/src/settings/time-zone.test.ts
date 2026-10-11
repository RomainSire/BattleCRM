import { expect, test } from 'vitest';

import { isTimeZone, localDate } from './time-zone.ts';

test('the local day follows the time zone on both sides of midnight', () => {
  const instant = new Date('2026-03-28T23:30:00Z');

  expect(localDate('UTC', instant)).toBe('2026-03-28');
  expect(localDate('Europe/Paris', instant)).toBe('2026-03-29');
  expect(localDate('America/Los_Angeles', instant)).toBe('2026-03-28');
});

test('the local day holds across a daylight saving change', () => {
  // Paris moves from UTC+1 to UTC+2 on 2026-03-29 at 01:00 UTC.
  expect(localDate('Europe/Paris', new Date('2026-03-29T21:59:59Z'))).toBe('2026-03-29');
  expect(localDate('Europe/Paris', new Date('2026-03-29T22:00:00Z'))).toBe('2026-03-30');
});

test('only IANA time zones the runtime knows are accepted', () => {
  expect(isTimeZone('Europe/Paris')).toBe(true);
  expect(isTimeZone('UTC')).toBe(true);
  expect(isTimeZone('Mars/Olympus')).toBe(false);
  expect(isTimeZone('')).toBe(false);
});
