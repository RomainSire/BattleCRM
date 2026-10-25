import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import {
  addContact,
  changeStatus,
  gestureAnswer,
  scheduleFollowUp,
  summaryOf,
  usePositioning,
} from '../../test/factories/contact.ts';
import { undo, undone } from '../../test/factories/gesture.ts';
import {
  createPositioning,
  positioningGesture,
  stageIdsOf,
} from '../../test/factories/positioning.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { withUser } from '../db/index.ts';
import { contact, followUp, interaction, statusChange } from './index.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const rowsOf = ({ userId }: User) =>
  withUser(userId, async (tx) => ({
    contacts: await tx.select().from(contact).where(eq(contact.userId, userId)).orderBy(contact.id),
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
    statusChanges: await tx
      .select()
      .from(statusChange)
      .where(eq(statusChange.userId, userId))
      .orderBy(statusChange.id),
  }));

const post = (harness: Harness, user: User, path: string, body: object) =>
  postJson(harness.app, path, body, user.cookie);

const threadOf = async (harness: Harness, user: User, contactId: string) => {
  const response = await harness.app.request(`/api/contacts/${contactId}/record`, {
    headers: { Cookie: user.cookie },
  });
  return z.object({ thread: z.array(z.unknown()) }).parse(await response.json()).thread;
};

/** A User with a Positioning at each of its first two Stages (the Default follow-up cadence: +3, +7, +14). */
async function workshop(harness: Harness) {
  const user = await makeUser(harness);
  const [first, second] = await stageIdsOf(harness, user);
  if (first === undefined || second === undefined) throw new Error('Two Stages expected');
  const { positioning: shortEmail } = await createPositioning(harness, user, first);
  const { positioning: callScript } = await createPositioning(harness, user, second, {
    label: 'Appel',
    channel: 'phone',
  });
  return { user, stageIds: [first, second] as const, shortEmail, callScript };
}

test('“Use a Positioning” records an outbound Interaction that names it, a Prospecting action, and schedules Follow-up 1; then “Undo”', async () => {
  const harness = testApp();
  const { user, shortEmail } = await workshop(harness);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
  });
  harness.clock.advance('PT1M');
  const before = await rowsOf(user);

  const response = await post(harness, user, `/api/contacts/${jean.id}/use-positioning`, {
    positioningId: shortEmail.id,
    occurredOn: '2026-01-05',
  });

  expect(response.status).toBe(200);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  const [used] = changes.contacts;
  // Sent today: +1 to the Activity, the Cadence starts, Follow-up 1 three days after.
  expect(used).toMatchObject({
    lastInteractionOn: '2026-01-05',
    lastDoneInteractionOn: '2026-01-05',
    prospectingActionDays: ['2026-01-05'],
    followUp: { dueOn: '2026-01-08', note: null, rank: 1 },
    // What the device copies the Follow-up messages from, offline too (ST-03).
    lastPositioningUse: { positioningId: shortEmail.id, sentOn: '2026-01-05' },
  });
  // The Positioning is used now: no longer deletable.
  expect(changes.positionings).toEqual([{ ...shortEmail, used: true }]);
  const summary = await summaryOf(harness, user);
  expect(summary.contacts).toEqual(changes.contacts);
  expect(summary.positionings.find(({ id }) => id === shortEmail.id)?.used).toBe(true);
  const sent = (await rowsOf(user)).interactions.find(({ kind }) => kind === 'positioning_used');
  expect(sent).toMatchObject({
    direction: 'outbound',
    localDate: '2026-01-05',
    positioningId: shortEmail.id,
  });
  expect(await threadOf(harness, user, jean.id)).toContainEqual(
    expect.objectContaining({ kind: 'positioning_used', positioningId: shortEmail.id }),
  );

  const undoing = await undo(harness, user, undoToken);

  expect(undoing.status).toBe(200);
  const restored = undone.parse(await undoing.json()).changes;
  expect(restored.contacts).toEqual([jean]);
  expect(restored.positionings).toEqual([shortEmail]);
  expect(await rowsOf(user)).toEqual(before);
});

test('sent on an earlier day, the use is dated then and Follow-up 1 counts from it, overdue if it must; its day may be changed', async () => {
  const harness = testApp();
  const { user, shortEmail } = await workshop(harness);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
  });
  const { contact: julie } = await addContact(harness, user, 'Julie Martin', {
    status: 'prospecting',
  });

  const { contact: late } = await usePositioning(harness, user, jean.id, {
    positioningId: shortEmail.id,
    occurredOn: '2025-12-30',
  });
  const { contact: moved } = await usePositioning(harness, user, julie.id, {
    positioningId: shortEmail.id,
    occurredOn: '2026-01-04',
    followUpOn: '2026-01-09',
  });

  // Counted on the day it was sent (ST-36); its Follow-up already overdue, as the panel said.
  expect(late).toMatchObject({
    prospectingActionDays: ['2025-12-30'],
    followUp: { dueOn: '2026-01-02', rank: 1 },
  });
  expect(moved.followUp).toEqual({ dueOn: '2026-01-09', note: null, rank: 1 });
});

test('Follow-up 1 replaces the Follow-up scheduled by hand, which “Undo” gives back', async () => {
  const harness = testApp();
  const { user, shortEmail } = await workshop(harness);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
  });
  const { contact: scheduled } = await scheduleFollowUp(harness, user, jean.id, {
    dueOn: '2026-01-20',
    note: 'Tender',
  });
  harness.clock.advance('PT1M');
  const before = await rowsOf(user);

  const { contact: used, undoToken } = await usePositioning(harness, user, jean.id, {
    positioningId: shortEmail.id,
    occurredOn: '2026-01-05',
  });

  // At most one scheduled: the Cadence takes over.
  expect(used.followUp).toEqual({ dueOn: '2026-01-08', note: null, rank: 1 });
  const { followUps } = await rowsOf(user);
  expect(followUps.map(({ status }) => status)).toEqual(['canceled', 'scheduled']);

  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect((await summaryOf(harness, user)).contacts).toEqual([scheduled]);
  expect(await rowsOf(user)).toEqual(before);
});

test('from the Pool, “Bring in and continue” enters the Funnel at the Stage of the Positioning before the use; “Undo” takes both back', async () => {
  const harness = testApp();
  const { user, stageIds, callScript } = await workshop(harness);
  const { contact: julie } = await addContact(harness, user, 'Julie Martin');
  harness.clock.advance('PT1M');
  const before = await rowsOf(user);

  const { contact: entered, undoToken } = await usePositioning(harness, user, julie.id, {
    positioningId: callScript.id,
    occurredOn: '2026-01-05',
    bringIn: true,
  });

  expect(entered).toMatchObject({
    status: 'prospecting',
    stageId: stageIds[1],
    funnelEntryDays: ['2026-01-05'],
    prospectingActionDays: ['2026-01-05'],
    followUp: { dueOn: '2026-01-08', rank: 1 },
  });

  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect((await summaryOf(harness, user)).contacts).toEqual([julie]);
  expect(await rowsOf(user)).toEqual(before);
});

test('without a Trial nor a Cadence: a Contact of the Pool or Archived stays where it is, an Ally keeps its own Follow-up', async () => {
  const harness = testApp();
  const { user, shortEmail } = await workshop(harness);
  const { contact: julie } = await addContact(harness, user, 'Julie Martin');
  const { contact: nina } = await addContact(harness, user, 'Nina Roux');
  await changeStatus(harness, user, nina.id, { status: 'archived' });
  const { contact: ines } = await addContact(harness, user, 'Inès Moreau', { status: 'ally' });
  await scheduleFollowUp(harness, user, ines.id, { dueOn: '2026-01-20' });

  const { contact: pool } = await usePositioning(harness, user, julie.id, {
    positioningId: shortEmail.id,
    occurredOn: '2026-01-05',
  });
  const { contact: archived } = await usePositioning(harness, user, nina.id, {
    positioningId: shortEmail.id,
    occurredOn: '2026-01-05',
  });
  const { contact: ally } = await usePositioning(harness, user, ines.id, {
    positioningId: shortEmail.id,
    occurredOn: '2026-01-04',
  });

  // Each a Prospecting action; an Ally's Days since contact count from it again.
  expect(pool).toMatchObject({
    status: 'pool',
    followUp: null,
    prospectingActionDays: ['2026-01-05'],
  });
  expect(archived).toMatchObject({ status: 'archived', followUp: null });
  expect(ally).toMatchObject({
    status: 'ally',
    lastDoneInteractionOn: '2026-01-04',
    prospectingActionDays: ['2026-01-04'],
    followUp: { dueOn: '2026-01-20', rank: null },
  });
});

test('a use is refused for a Positioning unknown, archived or of another Stage, a day to come, or a way in the Contact does not have', async () => {
  const harness = testApp();
  const { user, shortEmail, callScript } = await workshop(harness);
  const bob = await workshop(harness);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
  });
  const { contact: julie } = await addContact(harness, user, 'Julie Martin');
  const { positioning: archived } = await createPositioning(harness, user, shortEmail.stageId, {
    label: 'Ancien',
  });
  await positioningGesture(harness, user, `/api/positionings/${archived.id}/archive`);
  const before = await rowsOf(user);
  const use = (contactId: string, body: object) =>
    post(harness, user, `/api/contacts/${contactId}/use-positioning`, {
      positioningId: shortEmail.id,
      occurredOn: '2026-01-05',
      ...body,
    });

  const answers = [
    // Another User's answers as an unknown one.
    await use(jean.id, { positioningId: bob.shortEmail.id }),
    await use(jean.id, { positioningId: archived.id }),
    // A Contact Prospecting is sent what its Stage offers.
    await use(jean.id, { positioningId: callScript.id }),
    await use(jean.id, { occurredOn: '2026-01-06' }),
    await use(jean.id, { followUpOn: '2026-01-04' }),
    await use(jean.id, { bringIn: true }),
    // Neither Follow-up 1 nor its day without the Cadence.
    await use(julie.id, { followUpOn: '2026-01-09' }),
  ];

  expect(
    await Promise.all(
      answers.map(async (answer) => [
        answer.status,
        z.object({ error: z.string() }).parse(await answer.json()).error,
      ]),
    ),
  ).toEqual([
    [400, 'unknown_positioning'],
    [409, 'archived'],
    [409, 'other_stage'],
    [400, 'future_day'],
    [400, 'past_day'],
    [409, 'no_status_choice'],
    [409, 'no_follow_up'],
  ]);
  expect(await rowsOf(user)).toEqual(before);
});

test('a Positioning used can no longer be deleted, nor its creation undone; once the use is undone, it can', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const [stageId] = await stageIdsOf(harness, user);
  if (stageId === undefined) throw new Error('A Stage expected');
  const { positioning, undoToken: creation } = await createPositioning(harness, user, stageId);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
  });
  const { undoToken: use } = await usePositioning(harness, user, jean.id, {
    positioningId: positioning.id,
    occurredOn: '2026-01-05',
  });

  const deleting = await post(harness, user, `/api/positionings/${positioning.id}/delete`, {});
  const undoingCreation = await undo(harness, user, creation);

  expect(deleting.status).toBe(409);
  expect(await deleting.json()).toEqual({ error: 'used' });
  expect(undoingCreation.status).toBe(409);
  expect(await undoingCreation.json()).toEqual({ error: 'superseded' });

  expect((await undo(harness, user, use)).status).toBe(200);
  const { changes } = await positioningGesture(
    harness,
    user,
    `/api/positionings/${positioning.id}/delete`,
  );
  expect(changes.removedPositioningIds).toEqual([positioning.id]);
});
