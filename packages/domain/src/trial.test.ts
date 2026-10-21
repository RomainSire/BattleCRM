import { expect, test } from 'vitest';

import { isWindowElapsed, responseWindowEndsOn } from './trial.ts';

const silent = { followUp: null, lastDoneOn: '2026-01-05', responseWindowDays: 14 };

test('once no Follow-up is scheduled, the Response window counts from the last Interaction done', () => {
  expect(responseWindowEndsOn(silent)).toBe('2026-01-19');
});

test('a Trial in progress is Window elapsed from the last day of its Response window, not before', () => {
  expect(isWindowElapsed(silent, '2026-01-18')).toBe(false);
  expect(isWindowElapsed(silent, '2026-01-19')).toBe(true);
  expect(isWindowElapsed(silent, '2026-02-01')).toBe(true);
});

test('while a Follow-up is scheduled, of the Cadence or not, a silence calls it, not the signal', () => {
  for (const rank of [2, null]) {
    const waiting = { ...silent, followUp: { rank } };
    expect(responseWindowEndsOn(waiting)).toBeUndefined();
    expect(isWindowElapsed(waiting, '2026-03-01')).toBe(false);
  }
});

test('a reply or an outbound Interaction done since starts the Response window again', () => {
  expect(isWindowElapsed({ ...silent, lastDoneOn: '2026-01-10' }, '2026-01-19')).toBe(false);
});
