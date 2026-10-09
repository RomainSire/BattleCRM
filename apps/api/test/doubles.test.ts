import { expect, test } from 'vitest';

import { scriptedRandom, testClock } from './doubles.ts';

test('the test clock only moves when told to', () => {
  const clock = testClock('2026-10-25T00:30:00Z');

  clock.advance('P7D');
  clock.advance('PT1H30M15S');

  expect(clock.now().toISOString()).toBe('2026-11-01T02:00:15.000Z');
  expect(() => clock.advance('P1W')).toThrow(/Unsupported/);
  expect(() => clock.advance('PT')).toThrow(/Unsupported/);
});

test('scripted randomness returns its values in order, within the requested range', () => {
  const random = scriptedRandom(2, 0);

  expect(random.int(0, 3)).toBe(2);
  expect(() => random.int(1, 3)).toThrow(/outside \[1, 3\)/);
  expect(() => random.int(0, 3)).toThrow(/no value left/);
});
