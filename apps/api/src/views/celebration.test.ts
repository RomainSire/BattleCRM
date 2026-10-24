import { celebration } from '@battlecrm/contract';
import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { addContact, followUp, scheduleFollowUp, summaryOf } from '../../test/factories/contact.ts';
import { undo } from '../../test/factories/gesture.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

/** What a device sends once a gesture brought the Activity of the day to its goal (ST-44). */
async function celebrate(harness: Harness, user: User) {
  const response = await postJson(harness.app, '/api/today/celebration', {}, user.cookie);
  expect(response.status).toBe(200);
  return celebration.parse(await response.json());
}

/** A Prospecting action: a Follow-up of a new Contact, done on a local day, before the day it was due. */
async function prospectingAction(harness: Harness, user: User, occurredOn: string) {
  const { contact } = await addContact(harness, user, 'Jean Dupont', { status: 'prospecting' });
  await scheduleFollowUp(harness, user, contact.id, { dueOn: '2027-01-04' });
  return followUp(harness, user, contact.id, { occurredOn });
}

test('the Activity goal reached is celebrated once a day, on every device, and the summary says on which day', async () => {
  // 23:30 in Paris, on Monday 5 January: the Activity goal is 1 by default.
  const harness = testApp({}, { startsAt: '2026-01-05T22:30:00Z' });
  const user = await makeUser(harness);

  // Nothing done yet: nothing to celebrate.
  expect(await celebrate(harness, user)).toEqual({ celebrate: false, celebratedOn: null });
  await prospectingAction(harness, user, '2026-01-05');

  expect(await celebrate(harness, user)).toEqual({ celebrate: true, celebratedOn: '2026-01-05' });
  // Another device, or a second crossing the same day: already celebrated.
  expect(await celebrate(harness, user)).toEqual({ celebrate: false, celebratedOn: '2026-01-05' });
  expect((await summaryOf(harness, user)).celebratedOn).toBe('2026-01-05');

  // Past midnight in Paris: a new day, to celebrate again once reached.
  harness.clock.advance('PT40M');
  expect(await celebrate(harness, user)).toEqual({ celebrate: false, celebratedOn: '2026-01-05' });
  await prospectingAction(harness, user, '2026-01-06');
  expect(await celebrate(harness, user)).toEqual({ celebrate: true, celebratedOn: '2026-01-06' });
});

test('“Undo” never takes a celebration back: the goal reached again the same day is not celebrated twice', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { undoToken } = await prospectingAction(harness, user, '2026-01-05');
  await celebrate(harness, user);

  const undoing = await undo(harness, user, undoToken);
  expect(undoing.status).toBe(200);

  expect((await summaryOf(harness, user)).celebratedOn).toBe('2026-01-05');
  await prospectingAction(harness, user, '2026-01-05');
  expect(await celebrate(harness, user)).toEqual({ celebrate: false, celebratedOn: '2026-01-05' });
});

test('nothing is celebrated below the goal of the day, with the goal turned off, or the celebration turned off', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const settings = (body: object) => postJson(harness.app, '/api/settings', body, user.cookie);

  // Done yesterday: the Activity of today is still 0.
  await prospectingAction(harness, user, '2026-01-04');
  expect(await celebrate(harness, user)).toEqual({ celebrate: false, celebratedOn: null });

  // The celebration turned off: the goal is reached, nothing is recorded.
  await settings({ celebrateGoal: false });
  await prospectingAction(harness, user, '2026-01-05');
  expect(await celebrate(harness, user)).toEqual({ celebrate: false, celebratedOn: null });
  await settings({ celebrateGoal: true });

  // A goal of 2 from tomorrow on: one Action is not enough.
  await settings({ activityGoal: 2 });
  harness.clock.advance('P1D');
  await prospectingAction(harness, user, '2026-01-06');
  expect(await celebrate(harness, user)).toEqual({ celebrate: false, celebratedOn: null });

  // The goal turned off from tomorrow on: never reached.
  await settings({ activityGoal: null });
  harness.clock.advance('P1D');
  await prospectingAction(harness, user, '2026-01-07');
  await prospectingAction(harness, user, '2026-01-07');
  expect(await celebrate(harness, user)).toEqual({ celebrate: false, celebratedOn: null });
});
