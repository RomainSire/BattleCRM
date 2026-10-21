import { summaryChanges } from '@battlecrm/contract';
import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { addContact, gestureAnswer, summaryOf } from '../../test/factories/contact.ts';
import { undo } from '../../test/factories/gesture.ts';
import { archiveStage } from '../../test/factories/stage.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { withUser } from '../db/index.ts';
import { stageOrder } from '../funnel/index.ts';
import { contact, interaction, statusChange } from './tables.ts';

type User = Awaited<ReturnType<typeof makeUser>>;

const rowsOf = ({ userId }: User) =>
  withUser(userId, async (tx) => ({
    contacts: await tx.select().from(contact).where(eq(contact.userId, userId)).orderBy(contact.id),
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

const stagesOf = ({ userId }: User) => withUser(userId, (tx) => stageOrder(tx, userId));

test('adding a Contact puts it in the Pool and answers with its row of the summary', async () => {
  const harness = testApp();
  const user = await makeUser(harness);

  const response = await postJson(
    harness.app,
    '/api/contacts',
    { name: '  Jean Dupont ' },
    user.cookie,
  );

  expect(response.status).toBe(201);
  const { changes } = gestureAnswer.parse(await response.json());
  expect(changes).toEqual({
    contacts: [
      {
        id: expect.any(String),
        name: 'Jean Dupont',
        status: 'pool',
        stageId: null,
        organizationId: null,
        jobTitle: null,
        email: null,
        phone: null,
        linkedinUrl: null,
        lastInteractionAt: '2026-01-05T09:00:00.000Z',
        lastInteractionOn: '2026-01-05',
        // Adding it is no exchange with it.
        lastDoneInteractionOn: null,
        funnelEntryDays: [],
        statusReason: null,
        followUp: null,
        prospectingActionDays: [],
        assignment: null,
        trial: null,
      },
    ],
    removedContactIds: [],
    organizations: [],
    removedOrganizationIds: [],
    positionings: [],
    removedPositioningIds: [],
    battles: [],
    removedBattleIds: [],
  });
  expect((await summaryOf(harness, user)).contacts).toEqual(changes.contacts);
});

test('the addition is an Interaction neither outbound nor inbound, dated by the clock of the app in the local day of the User', async () => {
  const harness = testApp();
  const user = await makeUser(harness, { timeZone: 'Europe/Paris' });
  // 23:30 UTC on January 5th is already January 6th in Paris.
  harness.clock.advance('PT14H30M');

  const { contact: added } = await addContact(harness, user);

  const now = new Date('2026-01-05T23:30:00Z');
  expect(await rowsOf(user)).toEqual({
    contacts: [
      {
        id: added.id,
        userId: user.userId,
        name: 'Jean Dupont',
        status: 'pool',
        stageId: null,
        organizationId: null,
        jobTitle: null,
        email: null,
        phone: null,
        linkedinUrl: null,
        note: null,
        createdAt: now,
      },
    ],
    interactions: [
      {
        id: expect.any(String),
        userId: user.userId,
        contactId: added.id,
        kind: 'contact_added',
        direction: 'none',
        occurredAt: now,
        localDate: '2026-01-06',
        recordedAt: now,
        note: null,
        channel: null,
        positioningId: null,
      },
    ],
    // Its first Status is written down as a change from none.
    statusChanges: [
      {
        id: expect.any(String),
        userId: user.userId,
        contactId: added.id,
        interactionId: expect.any(String),
        fromStatus: null,
        toStatus: 'pool',
        stageId: null,
        reason: null,
      },
    ],
  });
  expect(added.lastInteractionOn).toBe('2026-01-06');
});

test.each([
  ['no name', {}],
  ['an empty name', { name: '' }],
  ['a blank name', { name: '   ' }],
  ['a name too long', { name: 'a'.repeat(201) }],
  ['a name that is no text', { name: 42 }],
])('a Contact needs a name: %s is refused and writes nothing', async (_case, body) => {
  const harness = testApp();
  const user = await makeUser(harness);

  const response = await postJson(harness.app, '/api/contacts', body, user.cookie);

  expect(response.status).toBe(400);
  expect(await rowsOf(user)).toEqual({ contacts: [], interactions: [], statusChanges: [] });
});

test('two Contacts may carry the same name', async () => {
  const harness = testApp();
  const user = await makeUser(harness);

  const first = await addContact(harness, user, 'Jean Dupont');
  const second = await addContact(harness, user, 'Jean Dupont');

  expect(second.contact.id).not.toBe(first.contact.id);
  expect((await summaryOf(harness, user)).contacts).toHaveLength(2);
});

test('“Undo” takes the addition back: neither the Contact nor its Interaction is left', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const kept = await addContact(harness, user, 'Julie Martin');
  const { contact: added, undoToken } = await addContact(harness, user);

  const response = await undo(harness, user, undoToken);

  expect(response.status).toBe(200);
  expect(z.strictObject({ changes: summaryChanges }).parse(await response.json())).toEqual({
    changes: {
      contacts: [],
      removedContactIds: [added.id],
      organizations: [],
      removedOrganizationIds: [],
      positionings: [],
      removedPositioningIds: [],
      battles: [],
      removedBattleIds: [],
    },
  });
  expect((await summaryOf(harness, user)).contacts).toEqual([kept.contact]);
  const rows = await rowsOf(user);
  expect(rows.contacts.map((row) => row.id)).toEqual([kept.contact.id]);
  expect(rows.interactions.map((row) => row.contactId)).toEqual([kept.contact.id]);
  expect(rows.statusChanges.map((row) => row.contactId)).toEqual([kept.contact.id]);
});

test('a gesture is undone once', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { undoToken } = await addContact(harness, user);
  await undo(harness, user, undoToken);

  const again = await undo(harness, user, undoToken);

  expect(again.status).toBe(404);
});

test('“Undo” is accepted for 15 minutes, then refused and the Contact stays', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const late = await addContact(harness, user, 'Julie Martin');
  harness.clock.advance('PT1S');
  const inTime = await addContact(harness, user);
  harness.clock.advance('PT15M');

  const refused = await undo(harness, user, late.undoToken);
  const accepted = await undo(harness, user, inTime.undoToken);

  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ error: 'expired' });
  expect(accepted.status).toBe(200);
  expect((await summaryOf(harness, user)).contacts).toEqual([late.contact]);
});

test('added Prospecting, a Contact enters the Funnel at the first Stage: a Funnel entry, recorded by its Interaction', async () => {
  const harness = testApp();
  const user = await makeUser(harness, { timeZone: 'Europe/Paris' });
  // 23:30 UTC on January 5th is already January 6th in Paris: the entry counts on the 6th.
  harness.clock.advance('PT14H30M');
  const [first] = await stagesOf(user);

  const { contact: added } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
  });

  expect(added).toMatchObject({
    status: 'prospecting',
    stageId: first!.id,
    funnelEntryDays: ['2026-01-06'],
  });
  const rows = await rowsOf(user);
  expect(rows.contacts).toMatchObject([{ status: 'prospecting', stageId: first!.id }]);
  expect(rows.interactions).toMatchObject([
    { kind: 'contact_added', direction: 'none', localDate: '2026-01-06' },
  ]);
  expect(rows.statusChanges).toEqual([
    {
      id: expect.any(String),
      userId: user.userId,
      contactId: added.id,
      interactionId: rows.interactions[0]!.id,
      fromStatus: null,
      toStatus: 'prospecting',
      stageId: first!.id,
      reason: null,
    },
  ]);
});

test('added Prospecting at a chosen Stage, it enters there', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const [, second] = await stagesOf(user);

  const { contact: added } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
    stageId: second!.id,
  });

  expect(added.stageId).toBe(second!.id);
  expect((await rowsOf(user)).statusChanges).toMatchObject([{ stageId: second!.id }]);
});

test('added as an Ally, a Contact joins the Circle without a Stage', async () => {
  const harness = testApp();
  const user = await makeUser(harness);

  const { contact: added } = await addContact(harness, user, 'Jean Dupont', { status: 'ally' });

  expect(added).toMatchObject({ status: 'ally', stageId: null });
  expect((await rowsOf(user)).statusChanges).toMatchObject([
    { fromStatus: null, toStatus: 'ally', stageId: null },
  ]);
});

test('the first Stage not archived is where a Contact enters by default', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const [first, second] = await stagesOf(user);
  await archiveStage(user, first!.id, harness.clock.now());

  const { contact: added } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
  });

  expect(added.stageId).toBe(second!.id);
});

test('“Undo” takes back an addition Prospecting: it leaves no Funnel entry', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { undoToken } = await addContact(harness, user, 'Jean Dupont', { status: 'prospecting' });

  const response = await undo(harness, user, undoToken);

  expect(response.status).toBe(200);
  expect(await rowsOf(user)).toEqual({ contacts: [], interactions: [], statusChanges: [] });
});

test('a Stage is chosen for an addition Prospecting only, among the Stages of the Funnel of its User', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const other = await makeUser(harness);
  const [first, second] = await stagesOf(user);
  const [elsewhere] = await stagesOf(other);
  await archiveStage(user, second!.id, harness.clock.now());
  const add = (body: object) =>
    postJson(harness.app, '/api/contacts', { name: 'Jean Dupont', ...body }, user.cookie);

  const refusals = [
    await add({ status: 'pool', stageId: first!.id }),
    await add({ status: 'ally', stageId: first!.id }),
    await add({ status: 'archived' }),
    await add({ status: 'prospecting', stageId: elsewhere!.id }),
    await add({ status: 'prospecting', stageId: second!.id }),
    await add({ status: 'prospecting', stageId: '00000000-0000-7000-8000-000000000000' }),
  ];

  expect(refusals.map((response) => response.status)).toEqual([400, 400, 400, 400, 400, 400]);
  expect(await refusals[3]!.json()).toEqual({ error: 'unknown_stage' });
  expect(await rowsOf(user)).toEqual({ contacts: [], interactions: [], statusChanges: [] });
});
