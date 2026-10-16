import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import {
  addContact,
  changeStatus,
  gestureAnswer,
  noteInteraction,
  recordReply,
  scheduleFollowUp,
  summaryOf,
} from '../../test/factories/contact.ts';
import { undo, undone } from '../../test/factories/gesture.ts';
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

/** A Contact Prospecting at the first Stage. */
const prospecting = async (harness: Harness, user: User, name = 'Jean Dupont') =>
  (await addContact(harness, user, name, { status: 'prospecting' })).contact;

test('“Note an Interaction” records an outbound Interaction of its kind on the day entered, off the Activity, then “Undo”', async () => {
  const harness = testApp({}, { startsAt: '2026-01-07T23:30:00Z' });
  const user = await makeUser(harness, { timeZone: 'Europe/Paris' });
  const jean = await prospecting(harness, user);
  const { contact: scheduled } = await scheduleFollowUp(harness, user, jean.id, {
    dueOn: '2026-01-12',
  });
  harness.clock.advance('PT1M');
  const before = await rowsOf(user);

  // A call yesterday, the 7th in Paris, written down past midnight.
  const response = await post(harness, user, `/api/contacts/${jean.id}/note-interaction`, {
    kind: 'call',
    occurredOn: '2026-01-07',
    note: ' Talked about the tender ',
  });

  expect(response.status).toBe(200);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  // Off the Activity, the Follow-up left where it was.
  expect(changes.contacts).toEqual([{ ...scheduled, lastDoneInteractionOn: '2026-01-07' }]);
  expect((await summaryOf(harness, user)).contacts).toEqual(changes.contacts);
  const noted = (await rowsOf(user)).interactions.find(({ kind }) => kind === 'call');
  expect(noted).toMatchObject({
    contactId: jean.id,
    direction: 'outbound',
    localDate: '2026-01-07',
    note: 'Talked about the tender',
    channel: null,
    recordedAt: new Date('2026-01-07T23:31:00Z'),
  });
  expect(noted?.occurredAt.getTime()).toBeLessThan(new Date('2026-01-07T23:00:00Z').getTime());
  expect(await threadOf(harness, user, jean.id)).toContainEqual(
    expect.objectContaining({
      kind: 'call',
      direction: 'outbound',
      note: 'Talked about the tender',
    }),
  );

  const undoing = await undo(harness, user, undoToken);

  expect(undoing.status).toBe(200);
  expect(undone.parse(await undoing.json()).changes.contacts).toEqual([scheduled]);
  expect(await rowsOf(user)).toEqual(before);
});

test('“Note an Interaction” takes any Contact but an Ally, whose free outbound Interaction is a Check-in; never a day to come', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: ally } = await addContact(harness, user, 'Inès Moreau', { status: 'ally' });
  const { contact: pool } = await addContact(harness, user, 'Julie Martin');
  const { contact: archived } = await addContact(harness, user, 'Nina Roux');
  await changeStatus(harness, user, archived.id, { status: 'archived' });
  const jean = await prospecting(harness, user);
  const before = await rowsOf(user);

  const toAlly = await post(harness, user, `/api/contacts/${ally.id}/note-interaction`, {
    kind: 'meeting',
    occurredOn: '2026-01-05',
  });
  const tomorrow = await post(harness, user, `/api/contacts/${jean.id}/note-interaction`, {
    kind: 'call',
    occurredOn: '2026-01-06',
  });
  const unknownKind = await post(harness, user, `/api/contacts/${jean.id}/note-interaction`, {
    kind: 'reply',
    occurredOn: '2026-01-05',
  });

  expect(toAlly.status).toBe(409);
  expect(await toAlly.json()).toEqual({ error: 'check_in_instead' });
  expect(tomorrow.status).toBe(400);
  expect(await tomorrow.json()).toEqual({ error: 'future_day' });
  expect(unknownKind.status).toBe(400);
  expect(await rowsOf(user)).toEqual(before);
  for (const [{ id }, kind] of [
    [pool, 'message'],
    [archived, 'other'],
  ] as const) {
    const { contact: noted } = await noteInteraction(harness, user, id, {
      kind,
      occurredOn: '2026-01-05',
    });
    expect(noted).toMatchObject({ lastDoneInteractionOn: '2026-01-05', prospectingActionDays: [] });
  }
});

test('“Replied…” records an inbound Interaction with its Channel, cancels the scheduled Follow-up when asked, then “Undo”', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const jean = await prospecting(harness, user);
  const { contact: scheduled } = await scheduleFollowUp(harness, user, jean.id, {
    dueOn: '2026-01-08',
    note: 'Tender',
  });
  harness.clock.advance('PT1M');
  const before = await rowsOf(user);

  const response = await post(harness, user, `/api/contacts/${jean.id}/record-reply`, {
    occurredOn: '2026-01-04',
    channel: 'linkedin',
    note: ' Asked for my resume ',
    cancelFollowUp: true,
  });

  expect(response.status).toBe(200);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  // Neither a Prospecting action nor a change of Status.
  expect(changes.contacts).toEqual([
    { ...scheduled, followUp: null, lastDoneInteractionOn: '2026-01-04' },
  ]);
  const after = await rowsOf(user);
  expect(after.interactions.find(({ kind }) => kind === 'reply')).toMatchObject({
    direction: 'inbound',
    localDate: '2026-01-04',
    channel: 'linkedin',
    note: 'Asked for my resume',
  });
  expect(after.followUps).toMatchObject([{ status: 'canceled' }]);
  expect(after.statusChanges).toEqual(before.statusChanges);
  expect(await threadOf(harness, user, jean.id)).toContainEqual(
    expect.objectContaining({ kind: 'reply', direction: 'inbound', channel: 'linkedin' }),
  );

  const undoing = await undo(harness, user, undoToken);

  expect(undoing.status).toBe(200);
  expect(undone.parse(await undoing.json()).changes.contacts).toEqual([scheduled]);
  expect(await rowsOf(user)).toEqual(before);
});

test('“Replied…” keeps the Follow-up unless asked; never a nature, never a day to come, never a Follow-up it does not have', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const jean = await prospecting(harness, user);
  const julie = await prospecting(harness, user, 'Julie Martin');
  await scheduleFollowUp(harness, user, jean.id, { dueOn: '2026-01-08' });
  const before = await rowsOf(user);

  const tomorrow = await post(harness, user, `/api/contacts/${jean.id}/record-reply`, {
    occurredOn: '2026-01-06',
    channel: 'email',
  });
  const noFollowUp = await post(harness, user, `/api/contacts/${julie.id}/record-reply`, {
    occurredOn: '2026-01-05',
    channel: 'email',
    cancelFollowUp: true,
  });
  const noChannel = await post(harness, user, `/api/contacts/${jean.id}/record-reply`, {
    occurredOn: '2026-01-05',
  });
  // A Contact Prospecting changes Status by its own gesture.
  const statusChoice = await post(harness, user, `/api/contacts/${julie.id}/record-reply`, {
    occurredOn: '2026-01-05',
    channel: 'email',
    status: 'ally',
  });

  expect(tomorrow.status).toBe(400);
  expect(await tomorrow.json()).toEqual({ error: 'future_day' });
  expect(noFollowUp.status).toBe(409);
  expect(await noFollowUp.json()).toEqual({ error: 'no_follow_up' });
  expect(noChannel.status).toBe(400);
  expect(statusChoice.status).toBe(409);
  expect(await statusChoice.json()).toEqual({ error: 'no_status_choice' });
  expect(await rowsOf(user)).toEqual(before);
  const { contact: replied } = await recordReply(harness, user, jean.id, {
    occurredOn: '2026-01-05',
    channel: 'phone',
  });
  expect(replied.followUp).toEqual({ dueOn: '2026-01-08', note: null, rank: null });
});

test('a spontaneous reply brings a Contact of the Pool into the Funnel, dated now; “Undo” leaves no Funnel entry', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const [, agency] = (await summaryOf(harness, user)).stages;
  if (!agency) throw new Error('The Standard stages are missing');
  const { contact: lea } = await addContact(harness, user, 'Léa Bernard');
  harness.clock.advance('P2D');
  const before = await rowsOf(user);

  // Without a Stage reached, one must be chosen.
  const withoutStage = await post(harness, user, `/api/contacts/${lea.id}/record-reply`, {
    occurredOn: '2026-01-06',
    channel: 'email',
    status: 'prospecting',
  });
  expect(withoutStage.status).toBe(400);
  expect(await withoutStage.json()).toEqual({ error: 'stage_required' });
  expect(await rowsOf(user)).toEqual(before);

  const { contact: entered, undoToken } = await recordReply(harness, user, lea.id, {
    occurredOn: '2026-01-06',
    channel: 'email',
    status: 'prospecting',
    stageId: agency.id,
  });

  expect(entered).toMatchObject({
    status: 'prospecting',
    stageId: agency.id,
    // The reply on the day entered; the entry today, never earlier.
    lastDoneInteractionOn: '2026-01-06',
    lastInteractionOn: '2026-01-07',
    funnelEntryDays: ['2026-01-07'],
    prospectingActionDays: [],
  });
  const { interactions, statusChanges } = await rowsOf(user);
  expect(interactions.map(({ kind }) => kind)).toEqual([
    'contact_added',
    'reply',
    'status_changed',
  ]);
  expect(statusChanges.at(-1)).toMatchObject({ fromStatus: 'pool', toStatus: 'prospecting' });

  const undoing = await undo(harness, user, undoToken);

  expect(undoing.status).toBe(200);
  expect(undone.parse(await undoing.json()).changes.contacts).toEqual([lea]);
  expect(await rowsOf(user)).toEqual(before);
});

test('a spontaneous reply adds an Archived Contact to the Circle; an Ally’s reply restarts its Days since contact', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: nina } = await addContact(harness, user, 'Nina Roux');
  await changeStatus(harness, user, nina.id, { status: 'archived' });
  const { contact: ines } = await addContact(harness, user, 'Inès Moreau', { status: 'ally' });

  const { contact: added } = await recordReply(harness, user, nina.id, {
    occurredOn: '2026-01-05',
    channel: 'mail',
    status: 'ally',
  });
  harness.clock.advance('P3D');
  const { contact: replied } = await recordReply(harness, user, ines.id, {
    occurredOn: '2026-01-07',
    channel: 'phone',
  });

  expect(added).toMatchObject({ status: 'ally', lastDoneInteractionOn: '2026-01-05' });
  expect(ines.lastDoneInteractionOn).toBeNull();
  expect(replied).toMatchObject({ status: 'ally', lastDoneInteractionOn: '2026-01-07' });
});

test('“Leave archived” records the reply alone', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: nina } = await addContact(harness, user, 'Nina Roux');
  const { contact: archived } = await changeStatus(harness, user, nina.id, { status: 'archived' });

  const { contact: left } = await recordReply(harness, user, nina.id, {
    occurredOn: '2026-01-05',
    channel: 'email',
  });

  expect(left).toEqual({ ...archived, lastDoneInteractionOn: '2026-01-05' });
});
