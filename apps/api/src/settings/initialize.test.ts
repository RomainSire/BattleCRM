import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { makeUser } from '../../test/factories/user.ts';
import { withUser } from '../db/index.ts';
import { effectiveTimeZone, userSettings } from './tables.ts';

const settingsOf = (userId: string) =>
  withUser(userId, async (tx) => ({
    settings: await tx.select().from(userSettings),
    timeZones: await tx.select().from(effectiveTimeZone),
  }));

test('a new User starts with the language of the sign-up and its time zone, in effect from that local day', async () => {
  const harness = testApp();
  // 23:30 UTC on January 5th is already January 6th in Paris.
  harness.clock.advance('PT14H30M');

  const paris = await makeUser(harness, { locale: 'en', timeZone: 'Europe/Paris' });
  const losAngeles = await makeUser(harness, { locale: 'fr', timeZone: 'America/Los_Angeles' });

  expect(await settingsOf(paris.userId)).toEqual({
    settings: [{ userId: paris.userId, locale: 'en' }],
    timeZones: [{ userId: paris.userId, effectiveFrom: '2026-01-06', value: 'Europe/Paris' }],
  });
  expect(await settingsOf(losAngeles.userId)).toEqual({
    settings: [{ userId: losAngeles.userId, locale: 'fr' }],
    timeZones: [
      { userId: losAngeles.userId, effectiveFrom: '2026-01-05', value: 'America/Los_Angeles' },
    ],
  });
});

test('a time zone the API does not know falls back to UTC', async () => {
  const harness = testApp();

  const { userId } = await makeUser(harness, { timeZone: 'Mars/Olympus' });

  expect((await settingsOf(userId)).timeZones).toEqual([
    { userId, effectiveFrom: '2026-01-05', value: 'UTC' },
  ]);
});
