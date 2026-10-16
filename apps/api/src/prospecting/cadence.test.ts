import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import {
  addContact,
  followUp as followUpGesture,
  noteInteraction,
  recordReply,
  scheduleFollowUp,
  summaryOf,
  usePositioning,
} from '../../test/factories/contact.ts';
import { undo } from '../../test/factories/gesture.ts';
import { positioningOf } from '../../test/factories/positioning.ts';
import { makeUser } from '../../test/factories/user.ts';
import { withUser } from '../db/index.ts';
import { followUp, interaction } from './index.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const rowsOf = ({ userId }: User) =>
  withUser(userId, async (tx) => ({
    followUps: await tx
      .select()
      .from(followUp)
      .where(eq(followUp.userId, userId))
      .orderBy(followUp.id),
    interactions: await tx
      .select()
      .from(interaction)
      .where(eq(interaction.userId, userId))
      .orderBy(interaction.id),
  }));

/**
 * A Contact Prospecting sent the short e-mail today, 2026-01-05 (the Default follow-up cadence: +3,
 * +7, +14): Follow-up 1 on the 8th.
 */
async function sentToday(harness: Harness) {
  const user = await makeUser(harness);
  const { positioning } = await positioningOf(harness, user);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
  });
  const { contact } = await usePositioning(harness, user, jean.id, {
    positioningId: positioning.id,
    occurredOn: '2026-01-05',
  });
  return { user, contact };
}

test('“Follow up…” on a rank of the Cadence schedules the next one, its interval after the day it was done; then “Undo”', async () => {
  const harness = testApp();
  const { user, contact: jean } = await sentToday(harness);
  harness.clock.advance('P4D');
  const before = await rowsOf(user);

  // Follow-up 1, due on the 8th, done on the 9th: Follow-up 2 seven days after.
  const { contact: done, undoToken } = await followUpGesture(harness, user, jean.id, {
    occurredOn: '2026-01-09',
  });

  expect(done.followUp).toEqual({ dueOn: '2026-01-16', note: null, rank: 2 });
  expect((await rowsOf(user)).followUps.map(({ status, rank }) => [status, rank])).toEqual([
    ['done', 1],
    ['scheduled', 2],
  ]);

  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect((await summaryOf(harness, user)).contacts[0]?.followUp).toEqual(jean.followUp);
  expect(await rowsOf(user)).toEqual(before);
});

test('after the last rank, “Follow up…” schedules nothing: the Response window comes next', async () => {
  const harness = testApp();
  const { user, contact: jean } = await sentToday(harness);

  harness.clock.advance('P3D');
  await followUpGesture(harness, user, jean.id, { occurredOn: '2026-01-08' });
  harness.clock.advance('P7D');
  const { contact: third } = await followUpGesture(harness, user, jean.id, {
    occurredOn: '2026-01-15',
  });
  expect(third.followUp).toEqual({ dueOn: '2026-01-29', note: null, rank: 3 });
  harness.clock.advance('P14D');
  const { contact: last } = await followUpGesture(harness, user, jean.id, {
    occurredOn: '2026-01-29',
  });

  expect(last.followUp).toBeNull();
});

test('off the Cadence, “Follow up…” schedules nothing', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
  });
  await scheduleFollowUp(harness, user, jean.id, { dueOn: '2026-01-05' });

  const { contact: done } = await followUpGesture(harness, user, jean.id, {
    occurredOn: '2026-01-05',
  });

  expect(done.followUp).toBeNull();
});

test('the next interval counts from the last outbound Interaction done, even one dated after the Follow-up', async () => {
  const harness = testApp();
  const { user, contact: jean } = await sentToday(harness);
  harness.clock.advance('P5D');
  await noteInteraction(harness, user, jean.id, { kind: 'call', occurredOn: '2026-01-10' });

  // Follow-up 1 done on the 9th, noted after a call on the 10th: Follow-up 2 counts from the call.
  const { contact: done } = await followUpGesture(harness, user, jean.id, {
    occurredOn: '2026-01-09',
  });

  expect(done.followUp).toMatchObject({ dueOn: '2026-01-17', rank: 2 });
});

test('“Note an Interaction” pushes the Follow-up of the Cadence back, its interval counted from it; then “Undo”', async () => {
  const harness = testApp();
  const { user, contact: jean } = await sentToday(harness);
  harness.clock.advance('P1D');
  const before = await rowsOf(user);

  // A call on the 6th: Follow-up 1 moves from the 8th to the 9th.
  const { contact: shifted, undoToken } = await noteInteraction(harness, user, jean.id, {
    kind: 'call',
    occurredOn: '2026-01-06',
  });

  expect(shifted.followUp).toEqual({ dueOn: '2026-01-09', note: null, rank: 1 });

  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect((await summaryOf(harness, user)).contacts[0]?.followUp).toEqual(jean.followUp);
  expect(await rowsOf(user)).toEqual(before);
});

test('“Note an Interaction” leaves a Follow-up off the Cadence where it is', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
  });
  const { contact: scheduled } = await scheduleFollowUp(harness, user, jean.id, {
    dueOn: '2026-01-06',
  });

  const { contact: noted } = await noteInteraction(harness, user, jean.id, {
    kind: 'meeting',
    occurredOn: '2026-01-05',
  });

  expect(noted.followUp).toEqual(scheduled.followUp);
});

test('a reply stops the Cadence: the Follow-up kept leaves it, with no rank; then “Undo”', async () => {
  const harness = testApp();
  const { user, contact: jean } = await sentToday(harness);
  harness.clock.advance('P1D');
  const before = await rowsOf(user);

  const { contact: replied, undoToken } = await recordReply(harness, user, jean.id, {
    occurredOn: '2026-01-06',
    channel: 'email',
  });

  expect(replied.followUp).toEqual({ dueOn: '2026-01-08', note: null, rank: null });

  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect((await summaryOf(harness, user)).contacts[0]?.followUp).toEqual(jean.followUp);
  expect(await rowsOf(user)).toEqual(before);
});

test('once the Cadence stopped, an outbound Interaction moves the Follow-up no more, and doing it schedules nothing', async () => {
  const harness = testApp();
  const { user, contact: jean } = await sentToday(harness);
  harness.clock.advance('P1D');
  const { contact: replied } = await recordReply(harness, user, jean.id, {
    occurredOn: '2026-01-06',
    channel: 'email',
  });

  const { contact: noted } = await noteInteraction(harness, user, jean.id, {
    kind: 'call',
    occurredOn: '2026-01-06',
  });
  const { contact: done } = await followUpGesture(harness, user, jean.id, {
    occurredOn: '2026-01-06',
  });

  expect(noted.followUp).toEqual(replied.followUp);
  expect(done.followUp).toBeNull();
});

test('after a reply, a Follow-up scheduled by hand is off the Cadence', async () => {
  const harness = testApp();
  const { user, contact: jean } = await sentToday(harness);
  harness.clock.advance('P1D');
  await recordReply(harness, user, jean.id, {
    occurredOn: '2026-01-06',
    channel: 'email',
    cancelFollowUp: true,
  });

  const { contact: scheduled } = await scheduleFollowUp(harness, user, jean.id, {
    dueOn: '2026-01-12',
  });

  expect(scheduled.followUp).toEqual({ dueOn: '2026-01-12', note: null, rank: null });
});

test('“Edit the follow-up” keeps its rank', async () => {
  const harness = testApp();
  const { user, contact: jean } = await sentToday(harness);

  const { contact: edited } = await scheduleFollowUp(harness, user, jean.id, {
    dueOn: '2026-01-12',
    note: 'After the holidays',
  });

  expect(edited.followUp).toEqual({ dueOn: '2026-01-12', note: 'After the holidays', rank: 1 });
});
