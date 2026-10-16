import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import {
  addContact,
  cancelFollowUp,
  changeStatus,
  followUp as followUpGesture,
  gestureAnswer,
  scheduleFollowUp,
  summaryOf,
} from '../../test/factories/contact.ts';
import { undo, undone } from '../../test/factories/gesture.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
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

const post = (harness: Harness, user: User, path: string, body: object) =>
  postJson(harness.app, path, body, user.cookie);

/** A Contact Prospecting at the first Stage. */
const prospecting = async (harness: Harness, user: User, name = 'Jean Dupont') =>
  (await addContact(harness, user, name, { status: 'prospecting' })).contact;

test('“Schedule a follow-up” gives a Contact Prospecting a Follow-up for a day, with its note, then “Undo”', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const jean = await prospecting(harness, user);
  const before = await rowsOf(user);

  const response = await post(harness, user, `/api/contacts/${jean.id}/schedule-follow-up`, {
    dueOn: '2026-01-08',
    note: ' Ask about the tender ',
  });

  expect(response.status).toBe(200);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  // Neither an Interaction nor a Prospecting action: nothing was done yet.
  expect(changes.contacts).toEqual([
    { ...jean, followUp: { dueOn: '2026-01-08', note: 'Ask about the tender', rank: null } },
  ]);
  expect((await summaryOf(harness, user)).contacts).toEqual(changes.contacts);
  const { followUps, interactions } = await rowsOf(user);
  expect(interactions).toEqual(before.interactions);
  expect(followUps).toMatchObject([
    { contactId: jean.id, status: 'scheduled', dueOn: '2026-01-08', interactionId: null },
  ]);

  const undoing = await undo(harness, user, undoToken);

  expect(undoing.status).toBe(200);
  expect(undone.parse(await undoing.json()).changes.contacts).toEqual([jean]);
  expect(await rowsOf(user)).toEqual(before);
});

test('scheduling again modifies the Follow-up: at most one per Contact; “Undo” gives the former one back', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const jean = await prospecting(harness, user);
  await scheduleFollowUp(harness, user, jean.id, { dueOn: '2026-01-08', note: 'Tender' });
  const before = await rowsOf(user);

  const { contact: modified, undoToken } = await scheduleFollowUp(harness, user, jean.id, {
    dueOn: '2026-01-12',
  });

  // A note left out is emptied: the panel sends every field.
  expect(modified.followUp).toEqual({ dueOn: '2026-01-12', note: null, rank: null });
  const { followUps } = await rowsOf(user);
  expect(followUps).toHaveLength(1);
  expect(followUps[0]?.id).toBe(before.followUps[0]?.id);

  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect(await rowsOf(user)).toEqual(before);
});

test('an Ally may have a Follow-up; a Contact of the Pool or Archived may not, nor a day already past', async () => {
  const harness = testApp({}, { startsAt: '2026-01-05T23:30:00Z' });
  const user = await makeUser(harness, { timeZone: 'Europe/Paris' });
  const { contact: ally } = await addContact(harness, user, 'Inès Moreau', { status: 'ally' });
  const { contact: pool } = await addContact(harness, user, 'Julie Martin');
  const jean = await prospecting(harness, user);
  const { contact: archived } = await addContact(harness, user, 'Nina Roux');
  await changeStatus(harness, user, archived.id, { status: 'archived' });
  const before = await rowsOf(user);

  const toPool = await post(harness, user, `/api/contacts/${pool.id}/schedule-follow-up`, {
    dueOn: '2026-01-08',
  });
  const toArchived = await post(harness, user, `/api/contacts/${archived.id}/schedule-follow-up`, {
    dueOn: '2026-01-08',
  });
  // Past midnight in Paris, the 5th is already gone.
  const past = await post(harness, user, `/api/contacts/${jean.id}/schedule-follow-up`, {
    dueOn: '2026-01-05',
  });
  const notADay = await post(harness, user, `/api/contacts/${jean.id}/schedule-follow-up`, {
    dueOn: '2026-02-30',
  });

  expect(toPool.status).toBe(409);
  expect(await toPool.json()).toEqual({ error: 'no_follow_up_in_status' });
  expect(toArchived.status).toBe(409);
  expect(past.status).toBe(400);
  expect(await past.json()).toEqual({ error: 'past_day' });
  expect(notADay.status).toBe(400);
  expect(await rowsOf(user)).toEqual(before);
  // Today is fine.
  const { contact } = await scheduleFollowUp(harness, user, ally.id, { dueOn: '2026-01-06' });
  expect(contact.followUp).toEqual({ dueOn: '2026-01-06', note: null, rank: null });
});

test('“Cancel” takes the scheduled Follow-up away, and “Undo” schedules it again', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const jean = await prospecting(harness, user);
  await scheduleFollowUp(harness, user, jean.id, { dueOn: '2026-01-08', note: 'Tender' });
  const before = await rowsOf(user);

  const { contact: canceled, undoToken } = await cancelFollowUp(harness, user, jean.id);

  expect(canceled.followUp).toBeNull();
  expect((await rowsOf(user)).followUps).toMatchObject([{ status: 'canceled' }]);
  const again = await post(harness, user, `/api/contacts/${jean.id}/cancel-follow-up`, {});
  expect(again.status).toBe(409);
  expect(await again.json()).toEqual({ error: 'no_follow_up' });

  const undoing = await undo(harness, user, undoToken);

  expect(undoing.status).toBe(200);
  expect(undone.parse(await undoing.json()).changes.contacts[0]?.followUp).toEqual({
    dueOn: '2026-01-08',
    note: 'Tender',
    rank: null,
  });
  expect(await rowsOf(user)).toEqual(before);
});

test('“Follow up…” turns the Follow-up into an outbound Interaction dated the day entered, +1 to its Activity, then “Undo”', async () => {
  const harness = testApp({}, { startsAt: '2026-01-07T23:30:00Z' });
  const user = await makeUser(harness, { timeZone: 'Europe/Paris' });
  const jean = await prospecting(harness, user);
  await scheduleFollowUp(harness, user, jean.id, { dueOn: '2026-01-09', note: 'Tender' });
  harness.clock.advance('PT1M');
  const before = await rowsOf(user);

  // Done yesterday, the 7th in Paris, written down past midnight; done before its day too.
  const response = await post(harness, user, `/api/contacts/${jean.id}/follow-up`, {
    occurredOn: '2026-01-07',
    note: ' Sent the case study ',
  });

  expect(response.status).toBe(200);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  expect(changes.contacts).toEqual([
    {
      ...jean,
      followUp: null,
      lastDoneInteractionOn: '2026-01-07',
      prospectingActionDays: ['2026-01-07'],
    },
  ]);
  expect((await summaryOf(harness, user)).contacts).toEqual(changes.contacts);
  const { followUps, interactions } = await rowsOf(user);
  const done = interactions.find(({ kind }) => kind === 'follow_up');
  expect(done).toMatchObject({
    contactId: jean.id,
    direction: 'outbound',
    localDate: '2026-01-07',
    note: 'Sent the case study',
    recordedAt: new Date('2026-01-07T23:31:00Z'),
  });
  // Before it was written down, on the day entered.
  expect(done?.occurredAt.getTime()).toBeLessThan(new Date('2026-01-07T23:00:00Z').getTime());
  expect(followUps).toMatchObject([{ status: 'done', interactionId: done?.id, note: 'Tender' }]);
  // In the thread, with its note.
  const record = await harness.app.request(`/api/contacts/${jean.id}/record`, {
    headers: { Cookie: user.cookie },
  });
  expect(
    z.object({ thread: z.array(z.unknown()) }).parse(await record.json()).thread,
  ).toContainEqual(
    expect.objectContaining({
      kind: 'follow_up',
      direction: 'outbound',
      localDate: '2026-01-07',
      note: 'Sent the case study',
    }),
  );

  const undoing = await undo(harness, user, undoToken);

  expect(undoing.status).toBe(200);
  expect(undone.parse(await undoing.json()).changes.contacts).toEqual([
    { ...jean, followUp: { dueOn: '2026-01-09', note: 'Tender', rank: null } },
  ]);
  expect(await rowsOf(user)).toEqual(before);
});

test('“Follow up…” done today is dated now; it needs a scheduled Follow-up and a day not yet to come', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const jean = await prospecting(harness, user);
  const without = await post(harness, user, `/api/contacts/${jean.id}/follow-up`, {
    occurredOn: '2026-01-05',
  });
  await scheduleFollowUp(harness, user, jean.id, { dueOn: '2026-01-05' });
  const tomorrow = await post(harness, user, `/api/contacts/${jean.id}/follow-up`, {
    occurredOn: '2026-01-06',
  });

  expect(without.status).toBe(409);
  expect(await without.json()).toEqual({ error: 'no_follow_up' });
  expect(tomorrow.status).toBe(400);
  expect(await tomorrow.json()).toEqual({ error: 'future_day' });
  const { contact } = await followUpGesture(harness, user, jean.id, { occurredOn: '2026-01-05' });
  expect(contact).toMatchObject({
    lastInteractionAt: '2026-01-05T09:00:00.000Z',
    prospectingActionDays: ['2026-01-05'],
  });
  // Its note stays with the Follow-up when none is written.
  const { interactions } = await rowsOf(user);
  expect(interactions.find(({ kind }) => kind === 'follow_up')?.note).toBeNull();
});

test('leaving Prospecting, or going to the Pool or Archived, cancels the scheduled Follow-up; “Undo” gives it back', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const jean = await prospecting(harness, user);
  const { contact: ines } = await addContact(harness, user, 'Inès Moreau', { status: 'ally' });
  const julie = await prospecting(harness, user, 'Julie Martin');
  await scheduleFollowUp(harness, user, jean.id, { dueOn: '2026-01-08' });
  await scheduleFollowUp(harness, user, ines.id, { dueOn: '2026-01-09' });
  await scheduleFollowUp(harness, user, julie.id, { dueOn: '2026-01-10' });
  const before = await rowsOf(user);

  const toAlly = await changeStatus(harness, user, jean.id, { status: 'ally' });
  const [outreach] = (await summaryOf(harness, user)).stages;
  if (!outreach) throw new Error('The Standard stages are missing');
  const toProspecting = await changeStatus(harness, user, ines.id, {
    status: 'prospecting',
    stageId: outreach.id,
  });
  const toPool = await changeStatus(harness, user, julie.id, { status: 'pool' });

  expect(toAlly.contact.followUp).toBeNull();
  // An Ally entering the Funnel keeps its own.
  expect(toProspecting.contact.followUp).toEqual({ dueOn: '2026-01-09', note: null, rank: null });
  expect(toPool.contact.followUp).toBeNull();

  expect((await undo(harness, user, toAlly.undoToken)).status).toBe(200);
  expect((await undo(harness, user, toProspecting.undoToken)).status).toBe(200);
  expect((await undo(harness, user, toPool.undoToken)).status).toBe(200);
  const after = await rowsOf(user);
  expect(after.followUps).toEqual(before.followUps);
});

test('a later gesture on the Contact closes the way back of a Follow-up', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const jean = await prospecting(harness, user);
  const { undoToken } = await scheduleFollowUp(harness, user, jean.id, { dueOn: '2026-01-08' });
  await followUpGesture(harness, user, jean.id, { occurredOn: '2026-01-05' });

  const undoing = await undo(harness, user, undoToken);

  expect(undoing.status).toBe(409);
  expect(await undoing.json()).toEqual({ error: 'superseded' });
});
