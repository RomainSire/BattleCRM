import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { makeUser } from '../../test/factories/user.ts';
import { withUser } from '../db/index.ts';
import { effectiveActivityGoal } from './tables.ts';
import { activityGoalOn, entryGoalForWeek, timeZoneAt } from './read.ts';
import { changeActivityGoal, changeEntryGoal, changeTimeZone } from './write.ts';

type Harness = ReturnType<typeof testApp>;

async function parisUser(harness: Harness) {
  const { userId } = await makeUser(harness, { timeZone: 'Europe/Paris' });
  return userId;
}

test('a User starts with the default goals, on every day', async () => {
  const harness = testApp();
  const userId = await parisUser(harness);

  expect(await withUser(userId, (tx) => activityGoalOn(tx, userId, '2020-01-01'))).toBe(1);
  expect(await withUser(userId, (tx) => activityGoalOn(tx, userId, '2026-01-05'))).toBe(1);
  expect(await withUser(userId, (tx) => entryGoalForWeek(tx, userId, '2026-01-05'))).toBe(5);
});

test('a new Activity goal applies from the next local day, even a minute before midnight', async () => {
  // 22:59 UTC on Saturday March 28th is 23:59 in Paris.
  const harness = testApp({}, { startsAt: '2026-03-28T22:59:00Z' });
  const userId = await parisUser(harness);

  await withUser(userId, (tx) => changeActivityGoal(tx, userId, 3, harness.clock.now()));

  const goalOn = (day: string) => withUser(userId, (tx) => activityGoalOn(tx, userId, day));
  expect(await goalOn('2026-03-28')).toBe(1);
  expect(await goalOn('2026-03-29')).toBe(3);
  expect(await goalOn('2026-12-31')).toBe(3);
});

test('a new Activity goal waits for the day after the one that just began, across the change of hour', async () => {
  // 23:30 UTC on March 28th is already 00:30 on March 29th in Paris, the day it moves to summer time.
  const harness = testApp({}, { startsAt: '2026-03-28T23:30:00Z' });
  const userId = await parisUser(harness);

  await withUser(userId, (tx) => changeActivityGoal(tx, userId, null, harness.clock.now()));

  const goalOn = (day: string) => withUser(userId, (tx) => activityGoalOn(tx, userId, day));
  expect(await goalOn('2026-03-29')).toBe(1);
  expect(await goalOn('2026-03-30')).toBeNull();
});

test('back to winter time, a minute before midnight is still the same day', async () => {
  // Paris moves back to UTC+1 on Sunday October 25th: 22:59 UTC is then 23:59 there.
  const harness = testApp({}, { startsAt: '2026-10-25T22:59:00Z' });
  const userId = await parisUser(harness);

  await withUser(userId, async (tx) => {
    await changeActivityGoal(tx, userId, 2, harness.clock.now());
    await changeEntryGoal(tx, userId, 6, harness.clock.now());
  });

  const goals = (day: string) =>
    withUser(userId, async (tx) => [
      await activityGoalOn(tx, userId, day),
      await entryGoalForWeek(tx, userId, day),
    ]);
  expect(await goals('2026-10-19')).toEqual([1, 5]);
  expect(await goals('2026-10-26')).toEqual([2, 6]);
});

test('changing the Activity goal twice the same day keeps the latest, and changing it back leaves no row', async () => {
  const harness = testApp();
  const userId = await parisUser(harness);
  const change = (goal: number | null) =>
    withUser(userId, (tx) => changeActivityGoal(tx, userId, goal, harness.clock.now()));

  await change(3);
  await change(4);
  expect(await withUser(userId, (tx) => activityGoalOn(tx, userId, '2026-01-06'))).toBe(4);

  await change(1);
  expect(await withUser(userId, (tx) => activityGoalOn(tx, userId, '2026-01-06'))).toBe(1);
  expect(await withUser(userId, (tx) => tx.select().from(effectiveActivityGoal))).toEqual([]);
});

test('a new Entry goal applies from the next Monday: the week under way keeps its own', async () => {
  // 22:30 UTC on Sunday January 11th is 23:30 in Paris: the next Monday is the day after.
  const harness = testApp({}, { startsAt: '2026-01-11T22:30:00Z' });
  const userId = await parisUser(harness);

  await withUser(userId, (tx) => changeEntryGoal(tx, userId, 8, harness.clock.now()));
  const goalFor = (monday: string) =>
    withUser(userId, (tx) => entryGoalForWeek(tx, userId, monday));
  expect(await goalFor('2026-01-05')).toBe(5);
  expect(await goalFor('2026-01-12')).toBe(8);

  // An hour later, it is Monday in Paris: a change now waits for the Monday after.
  harness.clock.advance('PT1H');
  await withUser(userId, (tx) => changeEntryGoal(tx, userId, null, harness.clock.now()));
  expect(await goalFor('2026-01-12')).toBe(8);
  expect(await goalFor('2026-01-19')).toBeNull();
});

test('a new time zone applies from the next local day of the one in effect', async () => {
  const harness = testApp({}, { startsAt: '2026-03-28T22:59:00Z' });
  const userId = await parisUser(harness);

  await withUser(userId, (tx) => changeTimeZone(tx, userId, 'Asia/Tokyo', harness.clock.now()));

  const zoneAt = (instant: string) =>
    withUser(userId, (tx) => timeZoneAt(tx, userId, new Date(instant)));
  // Still March 28th in Paris, though already the 29th in Tokyo.
  expect(await zoneAt('2026-03-28T22:59:30Z')).toBe('Europe/Paris');
  // From midnight in Paris on, March 29th.
  expect(await zoneAt('2026-03-28T23:30:00Z')).toBe('Asia/Tokyo');

  // Back to the zone in effect before: nothing is left to change.
  await withUser(userId, (tx) => changeTimeZone(tx, userId, 'Europe/Paris', harness.clock.now()));
  expect(await zoneAt('2026-03-30T12:00:00Z')).toBe('Europe/Paris');
});
