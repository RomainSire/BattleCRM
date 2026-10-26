import { CHANNELS } from '@battlecrm/contract';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { addContact, summaryOf } from '../../test/factories/contact.ts';
import { makeUser } from '../../test/factories/user.ts';
import { withUser } from '../db/index.ts';
import { interaction, statusChange } from '../prospecting/index.ts';

type Harness = ReturnType<typeof testApp>;

const recordOf = (harness: Harness, user: { cookie: string }, contactId: string) =>
  harness.app.request(`/api/contacts/${contactId}/record`, { headers: { Cookie: user.cookie } });

/** What the record of a Contact reads beyond the summary: its note and its thread. */
const contactRecord = z.strictObject({
  note: z.string().nullable(),
  /** Its Trials, which its deletion would leave in the Battles. */
  trialCount: z.int(),
  thread: z.array(
    z.strictObject({
      id: z.uuid(),
      kind: z.string(),
      direction: z.enum(['outbound', 'inbound', 'none']),
      occurredAt: z.iso.datetime(),
      localDate: z.iso.date(),
      note: z.string().nullable(),
      /** The Channel of a reply. */
      channel: z.enum(CHANNELS).nullable(),
      positioningId: z.uuid().nullable(),
      statusChange: z
        .strictObject({
          fromStatus: z.string().nullable(),
          toStatus: z.string(),
          stageId: z.uuid().nullable(),
          reason: z.string().nullable(),
        })
        .nullable(),
      /** A change of Stage, forward or back as the Funnel read then. */
      stageChange: z
        .strictObject({ fromStageId: z.uuid(), toStageId: z.uuid(), forward: z.boolean() })
        .nullable(),
    }),
  ),
});

test('the record of a Contact carries its note and its thread: the addition opens it, with its first Status', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const [outreach] = (await summaryOf(harness, user)).stages;
  const { contact } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
    note: 'Rencontré au meetup Rust',
  });

  const response = await recordOf(harness, user, contact.id);

  expect(response.status).toBe(200);
  expect(contactRecord.parse(await response.json())).toEqual({
    note: 'Rencontré au meetup Rust',
    trialCount: 0,
    thread: [
      {
        id: expect.any(String),
        kind: 'contact_added',
        direction: 'none',
        occurredAt: contact.lastInteractionAt,
        localDate: contact.lastInteractionOn,
        note: null,
        channel: null,
        positioningId: null,
        statusChange: {
          fromStatus: null,
          toStatus: 'prospecting',
          stageId: outreach!.id,
          reason: null,
        },
        stageChange: null,
      },
    ],
  });
});

test('the thread reads from the latest Interaction to the earliest', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact } = await addContact(harness, user);
  harness.clock.advance('P2D');
  // A change of Status written straight into the tables until it has its gesture (ticket 19).
  const later = harness.clock.now();
  await withUser(user.userId, async (tx) => {
    const [recorded] = await tx
      .insert(interaction)
      .values({
        userId: user.userId,
        contactId: contact.id,
        kind: 'contact_added',
        direction: 'none',
        occurredAt: later,
        localDate: '2026-01-07',
        note: null,
        recordedAt: later,
      })
      .returning({ id: interaction.id });
    await tx.insert(statusChange).values({
      userId: user.userId,
      contactId: contact.id,
      interactionId: recorded!.id,
      fromStatus: 'pool',
      toStatus: 'archived',
      reason: 'pas de besoin',
    });
  });

  const { thread } = contactRecord.parse(await (await recordOf(harness, user, contact.id)).json());

  expect(
    thread.map(({ localDate, statusChange: change }) => [localDate, change?.toStatus]),
  ).toEqual([
    ['2026-01-07', 'archived'],
    [contact.lastInteractionOn, 'pool'],
  ]);
  expect(thread[0]?.statusChange?.reason).toBe('pas de besoin');
});

test("another User's Contact, an unknown one and an id that is none answer alike", async () => {
  const harness = testApp();
  const alice = await makeUser(harness);
  const bob = await makeUser(harness);
  const { contact } = await addContact(harness, alice);

  for (const id of [contact.id, '01990000-0000-7000-8000-000000000000', 'not-an-id']) {
    const response = await recordOf(harness, bob, id);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  }
});
