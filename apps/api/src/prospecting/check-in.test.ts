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

const threadOf = async (harness: Harness, user: User, contactId: string) => {
  const response = await harness.app.request(`/api/contacts/${contactId}/record`, {
    headers: { Cookie: user.cookie },
  });
  return z.object({ thread: z.array(z.unknown()) }).parse(await response.json()).thread;
};

test('“Check in…” records an outbound Interaction with an Ally, a Prospecting action on the day entered, keeping its Follow-up; then “Undo”', async () => {
  const harness = testApp({}, { startsAt: '2026-01-07T23:30:00Z' });
  const user = await makeUser(harness, { timeZone: 'Europe/Paris' });
  const { contact: ines } = await addContact(harness, user, 'Inès Moreau', { status: 'ally' });
  const { contact: scheduled } = await scheduleFollowUp(harness, user, ines.id, {
    dueOn: '2026-01-20',
  });
  harness.clock.advance('PT1M');
  const before = await rowsOf(user);

  // A coffee yesterday, the 7th in Paris, written down past midnight.
  const response = await post(harness, user, `/api/contacts/${ines.id}/check-in`, {
    channel: 'meeting',
    occurredOn: '2026-01-07',
    note: ' Coffee near the station ',
  });

  expect(response.status).toBe(200);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  // A Prospecting action: the Activity of its day; the Follow-up is never consumed.
  expect(changes.contacts).toEqual([
    { ...scheduled, lastDoneInteractionOn: '2026-01-07', prospectingActionDays: ['2026-01-07'] },
  ]);
  expect((await summaryOf(harness, user)).contacts).toEqual(changes.contacts);
  const checkedIn = (await rowsOf(user)).interactions.find(({ kind }) => kind === 'check_in');
  expect(checkedIn).toMatchObject({
    contactId: ines.id,
    direction: 'outbound',
    localDate: '2026-01-07',
    note: 'Coffee near the station',
    channel: 'meeting',
    positioningId: null,
  });
  expect(await threadOf(harness, user, ines.id)).toContainEqual(
    expect.objectContaining({ kind: 'check_in', channel: 'meeting' }),
  );

  const undoing = await undo(harness, user, undoToken);

  expect(undoing.status).toBe(200);
  expect(undone.parse(await undoing.json()).changes.contacts).toEqual([scheduled]);
  expect(await rowsOf(user)).toEqual(before);
});

test('“Check in…” may cancel the Follow-up to come, which “Undo” gives back', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: ines } = await addContact(harness, user, 'Inès Moreau', { status: 'ally' });
  const { contact: scheduled } = await scheduleFollowUp(harness, user, ines.id, {
    dueOn: '2026-01-20',
  });
  const before = await rowsOf(user);

  const response = await post(harness, user, `/api/contacts/${ines.id}/check-in`, {
    channel: 'phone',
    occurredOn: '2026-01-05',
    cancelFollowUp: true,
  });

  expect(response.status).toBe(200);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  expect(changes.contacts[0]?.followUp).toBeNull();
  expect((await rowsOf(user)).followUps.map(({ status }) => status)).toEqual(['canceled']);

  await undo(harness, user, undoToken);

  expect((await summaryOf(harness, user)).contacts).toEqual([scheduled]);
  expect(await rowsOf(user)).toEqual(before);
});

test('“Check in…” is for an Ally only, never on a day to come, nor cancels a Follow-up it has not', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: ines } = await addContact(harness, user, 'Inès Moreau', { status: 'ally' });
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
  });
  const { contact: julie } = await addContact(harness, user, 'Julie Martin', { status: 'ally' });
  await changeStatus(harness, user, julie.id, { status: 'pool' });
  const before = await rowsOf(user);
  const checkIn = (id: string, body: object) =>
    post(harness, user, `/api/contacts/${id}/check-in`, {
      channel: 'email',
      occurredOn: '2026-01-05',
      ...body,
    });

  const prospecting = await checkIn(jean.id, {});
  const pool = await checkIn(julie.id, {});
  const tomorrow = await checkIn(ines.id, { occurredOn: '2026-01-06' });
  const noFollowUp = await checkIn(ines.id, { cancelFollowUp: true });
  const byMail = await checkIn(ines.id, { channel: 'mail' });

  expect(prospecting.status).toBe(409);
  expect(await prospecting.json()).toEqual({ error: 'not_ally' });
  expect(pool.status).toBe(409);
  expect(tomorrow.status).toBe(400);
  expect(await tomorrow.json()).toEqual({ error: 'future_day' });
  expect(noFollowUp.status).toBe(409);
  expect(await noFollowUp.json()).toEqual({ error: 'no_follow_up' });
  expect(byMail.status).toBe(400);
  expect(await rowsOf(user)).toEqual(before);
});
