import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { makeUser } from '../../test/factories/user.ts';
import { withUser } from '../db/index.ts';
import { localDateOf } from './read.ts';
import { effectiveTimeZone } from './tables.ts';

test('the local day of an instant is read in the time zone of the User', async () => {
  const harness = testApp();
  const paris = await makeUser(harness, { timeZone: 'Europe/Paris' });
  const losAngeles = await makeUser(harness, { timeZone: 'America/Los_Angeles' });
  const instant = new Date('2026-03-28T23:30:00Z');

  expect(await withUser(paris.userId, (tx) => localDateOf(tx, paris.userId, instant))).toBe(
    '2026-03-29',
  );
  expect(
    await withUser(losAngeles.userId, (tx) => localDateOf(tx, losAngeles.userId, instant)),
  ).toBe('2026-03-28');
});

test('a change of time zone moves no day before the one it takes effect on (ADR 0003)', async () => {
  const harness = testApp();
  const { userId } = await makeUser(harness, { timeZone: 'America/Los_Angeles' });
  await withUser(userId, (tx) =>
    tx
      .insert(effectiveTimeZone)
      .values({ userId, effectiveFrom: '2026-02-01', value: 'Asia/Tokyo' }),
  );
  const localDay = (instant: string) =>
    withUser(userId, (tx) => localDateOf(tx, userId, new Date(instant)));

  // 20:00 UTC is still noon in Los Angeles, already the next day in Tokyo.
  expect(await localDay('2026-01-20T20:00:00Z')).toBe('2026-01-20');
  expect(await localDay('2026-02-10T20:00:00Z')).toBe('2026-02-11');
});
