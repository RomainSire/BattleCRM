import { expect, test } from 'vitest';

import { activityOn, followUpSignal } from './follow-up.ts';

test('a scheduled Follow-up is overdue once its day is past, due on its day, upcoming before', () => {
  expect(followUpSignal('2026-01-04', '2026-01-05')).toBe('overdue');
  expect(followUpSignal('2026-01-05', '2026-01-05')).toBe('today');
  expect(followUpSignal('2026-01-06', '2026-01-05')).toBe('upcoming');
});

test('the Activity of a day counts every Prospecting action dated that day, on every Contact', () => {
  const contacts = [
    { prospectingActionDays: ['2026-01-04', '2026-01-05', '2026-01-05'] },
    { prospectingActionDays: ['2026-01-05'] },
    { prospectingActionDays: [] },
  ];
  expect(activityOn(contacts, '2026-01-05')).toBe(3);
  expect(activityOn(contacts, '2026-01-04')).toBe(1);
  expect(activityOn(contacts, '2026-01-06')).toBe(0);
});
