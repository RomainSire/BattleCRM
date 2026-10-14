import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import {
  addContact,
  changeStatus,
  gestureAnswer,
  summaryChanges,
  summaryOf,
} from '../../test/factories/contact.ts';
import { archiveStage } from '../../test/factories/stage.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { withUser } from '../db/index.ts';
import { contact, interaction, statusChange } from './index.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const rowsOf = ({ userId }: User) =>
  withUser(userId, async (tx) => ({
    contacts: await tx.select().from(contact).where(eq(contact.userId, userId)),
    interactions: await tx.select().from(interaction).where(eq(interaction.userId, userId)),
    statusChanges: await tx.select().from(statusChange).where(eq(statusChange.userId, userId)),
  }));

const change = (harness: Harness, user: User, contactId: string, body: object) =>
  postJson(harness.app, `/api/contacts/${contactId}/change-status`, body, user.cookie);

const undo = (harness: Harness, user: User, undoToken: string) =>
  postJson(harness.app, `/api/gestures/${undoToken}/undo`, {}, user.cookie);

const undone = z.object({ changes: summaryChanges });

const stagesOf = async (harness: Harness, user: User) => {
  const [outreach, agency, client, closing] = (await summaryOf(harness, user)).stages;
  if (!outreach || !agency || !client || !closing)
    throw new Error('The Standard stages are missing');
  return { outreach, agency, client, closing };
};

test('“Bring in…” puts a Contact of the Pool Prospecting at the Stage chosen: a Funnel entry, dated today', async () => {
  const harness = testApp({}, { startsAt: '2026-01-05T23:30:00Z' });
  const user = await makeUser(harness, { timeZone: 'Europe/Paris' });
  const { agency } = await stagesOf(harness, user);
  const { contact: jean } = await addContact(harness, user);
  harness.clock.advance('PT1M');

  const response = await change(harness, user, jean.id, {
    status: 'prospecting',
    stageId: agency.id,
    reason: ' Back from holidays ',
  });

  expect(response.status).toBe(200);
  const { changes } = gestureAnswer.parse(await response.json());
  // Past midnight in Paris: the entry counts on the local day of the User.
  expect(changes.contacts).toEqual([
    {
      ...jean,
      status: 'prospecting',
      stageId: agency.id,
      lastInteractionAt: '2026-01-05T23:31:00.000Z',
      lastInteractionOn: '2026-01-06',
      funnelEntryDays: ['2026-01-06'],
      statusReason: 'Back from holidays',
    },
  ]);
  expect((await summaryOf(harness, user)).contacts).toEqual(changes.contacts);
  const { interactions, statusChanges } = await rowsOf(user);
  const recorded = interactions.find(({ kind }) => kind === 'status_changed');
  expect(recorded).toMatchObject({
    direction: 'none',
    occurredAt: new Date('2026-01-05T23:31:00Z'),
    recordedAt: new Date('2026-01-05T23:31:00Z'),
    localDate: '2026-01-06',
  });
  expect(statusChanges.find(({ interactionId }) => interactionId === recorded?.id)).toMatchObject({
    fromStatus: 'pool',
    toStatus: 'prospecting',
    stageId: agency.id,
    reason: 'Back from holidays',
  });
});

test('“Bring in…” enters at the last Stage reached unless one is chosen', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { client } = await stagesOf(harness, user);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
    stageId: client.id,
  });
  await changeStatus(harness, user, jean.id, { status: 'pool' });

  const { contact: changed } = await changeStatus(harness, user, jean.id, {
    status: 'prospecting',
  });

  expect(changed).toMatchObject({ status: 'prospecting', stageId: client.id });
  // Each entry counts, even twice the same day.
  expect(changed.funnelEntryDays).toEqual(['2026-01-05', '2026-01-05']);
});

test('a Stage must be chosen when the Contact never reached one, or when the last one is archived', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { outreach, agency } = await stagesOf(harness, user);
  const { contact: never } = await addContact(harness, user, 'Julie Martin');
  const { contact: left } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
    stageId: agency.id,
  });
  await changeStatus(harness, user, left.id, { status: 'archived' });
  await archiveStage(user, agency.id, harness.clock.now());
  const before = await rowsOf(user);

  const withoutStage = await change(harness, user, never.id, { status: 'prospecting' });
  const archivedLast = await change(harness, user, left.id, { status: 'prospecting' });
  const archivedChosen = await change(harness, user, left.id, {
    status: 'prospecting',
    stageId: agency.id,
  });

  expect(withoutStage.status).toBe(400);
  expect(await withoutStage.json()).toEqual({ error: 'stage_required' });
  expect(archivedLast.status).toBe(400);
  expect(await archivedLast.json()).toEqual({ error: 'stage_required' });
  expect(archivedChosen.status).toBe(400);
  expect(await archivedChosen.json()).toEqual({ error: 'unknown_stage' });
  expect(await rowsOf(user)).toEqual(before);
  const { contact: changed } = await changeStatus(harness, user, left.id, {
    status: 'prospecting',
    stageId: outreach.id,
  });
  expect(changed).toMatchObject({ status: 'prospecting', stageId: outreach.id });
});

test('leaving Prospecting keeps the last Stage reached, which the change records', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { agency } = await stagesOf(harness, user);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
    stageId: agency.id,
  });

  const { contact: changed } = await changeStatus(harness, user, jean.id, { status: 'ally' });

  expect(changed).toMatchObject({ status: 'ally', stageId: agency.id });
  expect(changed.funnelEntryDays).toEqual(['2026-01-05']);
  expect((await rowsOf(user)).statusChanges).toContainEqual(
    expect.objectContaining({
      fromStatus: 'prospecting',
      toStatus: 'ally',
      stageId: agency.id,
      reason: null,
    }),
  );
});

test('every Status can come back to any other; a blank reason is none', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { outreach } = await stagesOf(harness, user);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', { status: 'ally' });

  await changeStatus(harness, user, jean.id, { status: 'archived', reason: '  ' });
  await changeStatus(harness, user, jean.id, { status: 'ally' });
  await changeStatus(harness, user, jean.id, { status: 'pool' });
  await changeStatus(harness, user, jean.id, { status: 'prospecting', stageId: outreach.id });
  const { contact: changed } = await changeStatus(harness, user, jean.id, { status: 'archived' });

  expect(changed).toMatchObject({ status: 'archived', statusReason: null });
  expect(
    (await rowsOf(user)).statusChanges.map(({ toStatus, reason }) => [toStatus, reason]),
  ).toEqual(
    expect.arrayContaining([
      ['ally', null],
      ['archived', null],
      ['pool', null],
      ['prospecting', null],
    ]),
  );
});

test('the Status the Contact already has, a Stage outside Prospecting or an unknown Status is refused', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { outreach } = await stagesOf(harness, user);
  const { contact: jean } = await addContact(harness, user);
  const before = await rowsOf(user);

  const same = await change(harness, user, jean.id, { status: 'pool' });
  const stageOutside = await change(harness, user, jean.id, {
    status: 'archived',
    stageId: outreach.id,
  });
  const unknown = await change(harness, user, jean.id, { status: 'won' });

  expect(same.status).toBe(409);
  expect(await same.json()).toEqual({ error: 'same_status' });
  expect(stageOutside.status).toBe(400);
  expect(unknown.status).toBe(400);
  expect(await rowsOf(user)).toEqual(before);
});

test('a Contact of another User, or none, answers 404', async () => {
  const harness = testApp();
  const alice = await makeUser(harness);
  const bob = await makeUser(harness);
  const { contact: hers } = await addContact(harness, alice);

  const responses = [
    await change(harness, bob, hers.id, { status: 'archived' }),
    await change(harness, bob, crypto.randomUUID(), { status: 'archived' }),
    await change(harness, bob, 'not-an-id', { status: 'archived' }),
  ];

  expect(responses.map(({ status }) => status)).toEqual([404, 404, 404]);
});

test('“Undo” takes the change of Status back and leaves no Funnel entry', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { agency } = await stagesOf(harness, user);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
    stageId: agency.id,
  });
  harness.clock.advance('PT1M');
  await changeStatus(harness, user, jean.id, { status: 'pool' });
  const before = await rowsOf(user);
  const summaryBefore = await summaryOf(harness, user);
  harness.clock.advance('PT1M');
  const { undoToken } = await changeStatus(harness, user, jean.id, { status: 'prospecting' });
  harness.clock.advance('PT1M');

  const response = await undo(harness, user, undoToken);

  expect(response.status).toBe(200);
  const { changes } = undone.parse(await response.json());
  expect(changes.contacts).toEqual(summaryBefore.contacts);
  expect(changes.contacts[0]?.funnelEntryDays).toEqual(['2026-01-05']);
  expect(await rowsOf(user)).toEqual(before);
  expect(await summaryOf(harness, user)).toEqual(summaryBefore);
});

test('“Undo” is refused when it would put the Contact back Prospecting at a Stage archived since', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { agency } = await stagesOf(harness, user);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
    stageId: agency.id,
  });
  harness.clock.advance('PT1M');
  const { undoToken } = await changeStatus(harness, user, jean.id, { status: 'ally' });
  await archiveStage(user, agency.id, harness.clock.now());
  const before = await rowsOf(user);

  const response = await undo(harness, user, undoToken);

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'superseded' });
  expect(await rowsOf(user)).toEqual(before);
});

test('a change of Status closes the way back of the gesture before it', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean, undoToken: added } = await addContact(harness, user);
  harness.clock.advance('PT1M');
  const first = await changeStatus(harness, user, jean.id, { status: 'ally' });
  harness.clock.advance('PT1M');
  await changeStatus(harness, user, jean.id, { status: 'archived' });

  expect((await undo(harness, user, added)).status).toBe(409);
  expect((await undo(harness, user, first.undoToken)).status).toBe(409);
});

test('the summary carries the time zone of the User in effect now', async () => {
  const harness = testApp();
  const user = await makeUser(harness, { timeZone: 'America/New_York' });

  expect((await summaryOf(harness, user)).timeZone).toBe('America/New_York');
});
