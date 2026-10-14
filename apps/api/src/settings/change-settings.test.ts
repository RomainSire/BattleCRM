import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { summaryOf } from '../../test/factories/contact.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { withUser } from '../db/index.ts';
import { languageAndTimeZoneOf } from './read.ts';
import { effectiveActivityGoal, effectiveEntryGoal, effectiveTimeZone } from './tables.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const changeSettings = (harness: Harness, user: User, body: object) =>
  postJson(harness.app, '/api/settings', body, user.cookie);

const summarySettings = async (harness: Harness, user: User) =>
  (await summaryOf(harness, user)).settings;

/** What a new User finds in Settings (CONTEXT.md). */
const DEFAULTS = {
  locale: 'fr',
  timeZone: { inEffect: 'Europe/Paris', chosen: 'Europe/Paris' },
  activityGoal: { inEffect: 1, chosen: 1 },
  entryGoal: { inEffect: 5, chosen: 5 },
  celebrateGoal: true,
  singleKeyShortcuts: true,
  checkInRhythmDays: 28,
  circleSizeGoal: 10,
  defaultCadence: { intervals: [3, 7, 14], responseWindowDays: 14 },
};

test('the summary carries the settings of the User', async () => {
  const harness = testApp();
  const user = await makeUser(harness, { locale: 'fr', timeZone: 'Europe/Paris' });

  expect(await summarySettings(harness, user)).toEqual(DEFAULTS);
});

test('each setting saves on its own; the dated ones are chosen now and take effect later', async () => {
  const harness = testApp();
  const user = await makeUser(harness, { locale: 'fr', timeZone: 'Europe/Paris' });

  const response = await changeSettings(harness, user, {
    locale: 'en',
    timeZone: 'America/New_York',
    activityGoal: 3,
    entryGoal: null,
    celebrateGoal: false,
    singleKeyShortcuts: false,
    checkInRhythmDays: 21,
    circleSizeGoal: null,
    defaultCadence: { intervals: [2, 5], responseWindowDays: 10 },
  });

  const changed = {
    locale: 'en',
    timeZone: { inEffect: 'Europe/Paris', chosen: 'America/New_York' },
    activityGoal: { inEffect: 1, chosen: 3 },
    entryGoal: { inEffect: 5, chosen: null },
    celebrateGoal: false,
    singleKeyShortcuts: false,
    checkInRhythmDays: 21,
    circleSizeGoal: null,
    defaultCadence: { intervals: [2, 5], responseWindowDays: 10 },
  };
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ settings: changed });
  expect(await summarySettings(harness, user)).toEqual(changed);
  // E-mails follow the new language at once.
  expect((await languageAndTimeZoneOf(user.userId, harness.clock.now())).locale).toBe('en');

  // The next day, the Activity goal and the time zone are in effect; the Entry goal waits for Monday.
  harness.clock.advance('P1D');
  expect(await summarySettings(harness, user)).toEqual({
    ...changed,
    timeZone: { inEffect: 'America/New_York', chosen: 'America/New_York' },
    activityGoal: { inEffect: 3, chosen: 3 },
  });
  harness.clock.advance('P6D');
  expect(await summarySettings(harness, user)).toMatchObject({
    entryGoal: { inEffect: null, chosen: null },
  });
});

test('Undo writes the values from before back, which leaves no trace', async () => {
  const harness = testApp();
  const user = await makeUser(harness, { locale: 'fr', timeZone: 'Europe/Paris' });
  await changeSettings(harness, user, {
    timeZone: 'Asia/Tokyo',
    activityGoal: null,
    entryGoal: 8,
    circleSizeGoal: 12,
  });

  const undone = await changeSettings(harness, user, {
    timeZone: 'Europe/Paris',
    activityGoal: 1,
    entryGoal: 5,
    circleSizeGoal: 10,
  });

  expect(undone.status).toBe(200);
  expect(await summarySettings(harness, user)).toEqual(DEFAULTS);
  expect(
    await withUser(user.userId, async (tx) => ({
      activityGoals: await tx.select().from(effectiveActivityGoal),
      entryGoals: await tx.select().from(effectiveEntryGoal),
      timeZones: (await tx.select().from(effectiveTimeZone)).length,
    })),
  ).toEqual({ activityGoals: [], entryGoals: [], timeZones: 1 });
});

test.each([
  { activityGoal: 0 },
  { entryGoal: -1 },
  { activityGoal: 2.5 },
  { timeZone: 'Mars/Olympus' },
  { locale: 'de' },
  { checkInRhythmDays: 0 },
  { circleSizeGoal: 0 },
  { checkInRhythmDays: null },
  { defaultCadence: { intervals: [], responseWindowDays: 14 } },
  { defaultCadence: { intervals: [3, 0], responseWindowDays: 14 } },
  { defaultCadence: { intervals: [3] } },
])('a setting out of bounds is refused, and nothing changes: %j', async (body) => {
  const harness = testApp();
  const user = await makeUser(harness, { locale: 'fr', timeZone: 'Europe/Paris' });

  const response = await changeSettings(harness, user, { celebrateGoal: false, ...body });

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'invalid' });
  expect(await summarySettings(harness, user)).toEqual(DEFAULTS);
});
