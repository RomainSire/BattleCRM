import { expect, test } from 'vitest';

import { addDays, funnelEntriesInWeek, localDay, mondayOf, nextMondayAfter } from './days.ts';

test('the local day of an instant is read in a time zone', () => {
  const instant = new Date('2026-01-05T23:30:00Z');
  expect(localDay(instant, 'Europe/Paris')).toBe('2026-01-06');
  expect(localDay(instant, 'America/New_York')).toBe('2026-01-05');
});

test('days add up across months, years and changes of hour', () => {
  expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(addDays('2026-03-29', 28)).toBe('2026-04-26');
  expect(addDays('2026-01-05', -1)).toBe('2026-01-04');
});

test('a week runs from Monday to Sunday', () => {
  expect(mondayOf('2026-01-05')).toBe('2026-01-05');
  expect(mondayOf('2026-01-11')).toBe('2026-01-05');
  expect(mondayOf('2026-01-12')).toBe('2026-01-12');
  expect(mondayOf('2026-03-01')).toBe('2026-02-23');
});

test('the next Monday is the one after the week, even on a Sunday or a Monday', () => {
  expect(nextMondayAfter('2026-10-11')).toBe('2026-10-12');
  expect(nextMondayAfter('2026-10-12')).toBe('2026-10-19');
  expect(nextMondayAfter('2026-10-14')).toBe('2026-10-19');
});

test('the Funnel entries of a week count every entry from Monday to Sunday, twice the same Contact too', () => {
  const contacts = [
    { funnelEntryDays: ['2026-01-04', '2026-01-05', '2026-01-07'] },
    { funnelEntryDays: ['2026-01-07', '2026-01-07'] },
    { funnelEntryDays: ['2026-01-12'] },
    { funnelEntryDays: [] },
  ];
  expect(funnelEntriesInWeek(contacts, '2026-01-08')).toBe(4);
  expect(funnelEntriesInWeek(contacts, '2026-01-11')).toBe(4);
  expect(funnelEntriesInWeek(contacts, '2026-01-12')).toBe(1);
});
