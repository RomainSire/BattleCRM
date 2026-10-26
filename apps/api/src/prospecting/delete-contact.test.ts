import { battleTrials, summaryChanges } from '@battlecrm/contract';
import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { openBattle } from '../../test/factories/battle.ts';
import {
  addContact,
  changeStatus,
  noteInteraction,
  recordReply,
  revealAssignment,
  scheduleFollowUp,
  summaryOf,
  usePositioning,
} from '../../test/factories/contact.ts';
import { undo } from '../../test/factories/gesture.ts';
import { createPositioning, stageIdsOf } from '../../test/factories/positioning.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { withUser } from '../db/index.ts';
import { assignment, contact, followUp, interaction, statusChange, trial } from './index.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

/** What a deletion answers: the rows of the summary it changed, and no token, it is confirmed instead. */
const deleted = z.strictObject({ changes: summaryChanges });

const deleteContact = (harness: Harness, user: User, contactId: string) =>
  postJson(harness.app, `/api/contacts/${contactId}/delete`, {}, user.cookie);

const rowsOf = ({ userId }: User, contactId: string) =>
  withUser(userId, async (tx) => ({
    contact: (await tx.select().from(contact).where(eq(contact.id, contactId)))[0],
    interactions: await tx.select().from(interaction).where(eq(interaction.contactId, contactId)),
    followUps: await tx.select().from(followUp).where(eq(followUp.contactId, contactId)),
    statusChanges: await tx
      .select()
      .from(statusChange)
      .where(eq(statusChange.contactId, contactId)),
    trials: await tx.select().from(trial).where(eq(trial.contactId, contactId)),
    assignments: await tx.select().from(assignment).where(eq(assignment.contactId, contactId)),
  }));

const trialsIn = async (harness: Harness, user: User, battleId: string) => {
  const response = await harness.app.request(`/api/battles/${battleId}/trials`, {
    headers: { Cookie: user.cookie },
  });
  return battleTrials.parse(await response.json()).trials;
};

/** A User whose first Stage has an open Battle, CV A against CV B, each Assignment by chance. */
async function battleAtFirstStage() {
  const harness = testApp({}, { chances: [0, 0, 0, 0] });
  const user = await makeUser(harness);
  const [first = ''] = await stageIdsOf(harness, user);
  const { positioning: cvA } = await createPositioning(harness, user, first, { label: 'CV A' });
  const { positioning: cvB } = await createPositioning(harness, user, first, { label: 'CV B' });
  const { battle } = await openBattle(harness, user, {
    stageId: first,
    championId: cvA.id,
    challengerId: cvB.id,
  });
  return { harness, user, battle };
}

/** A Contact of an ESN, with every Coordinate, entered at the first Stage, sent its Assignment. */
async function contactInTrial(harness: Harness, user: User, name: string, linkedinUrl: string) {
  const { contact: added } = await addContact(harness, user, name, {
    status: 'prospecting',
    newOrganization: { name: `ESN de ${name}`, type: 'consultancy' },
    jobTitle: 'CTO',
    email: `${name.toLowerCase()}@example.com`,
    phone: '+33 6 12 34 56 78',
    linkedinUrl,
    note: 'Rencontré au salon',
  });
  const revealed = await revealAssignment(harness, user, added.id);
  await usePositioning(harness, user, added.id, {
    positioningId: revealed.assignment?.positioningId ?? '',
    occurredOn: '2026-01-05',
  });
  return added;
}

test('deleting a Contact erases what identifies it, keeps its Trials and Interactions, and cancels what was to come', async () => {
  const { harness, user, battle } = await battleAtFirstStage();
  const claire = await contactInTrial(
    harness,
    user,
    'Claire',
    'https://www.linkedin.com/in/claire-martin',
  );
  await noteInteraction(harness, user, claire.id, {
    kind: 'message',
    occurredOn: '2026-01-05',
    note: 'Lui a parlé de sa fille',
  });
  await scheduleFollowUp(harness, user, claire.id, {
    dueOn: '2026-01-09',
    note: 'Relancer Claire',
  });
  const summaryBefore = await summaryOf(harness, user);
  const before = summaryBefore.battles[0];
  const daysBefore = summaryBefore.contacts.find(({ id }) => id === claire.id);
  harness.clock.advance('PT1M');

  const response = await deleteContact(harness, user, claire.id);

  expect(response.status).toBe(200);
  const { changes } = deleted.parse(await response.json());
  expect(changes.contacts).toEqual([]);
  expect(changes.removedContactIds).toEqual([claire.id]);
  // Its Trial in progress, canceled, no longer counts in the Battle.
  expect(changes.battles).toEqual([
    expect.objectContaining({ id: battle.id, startedTrials: (before?.startedTrials ?? 0) - 1 }),
  ]);

  const rows = await rowsOf(user, claire.id);
  expect(rows.contact).toMatchObject({
    name: null,
    jobTitle: null,
    email: null,
    phone: null,
    linkedinUrl: null,
    note: null,
    organizationId: null,
    anonymizedAt: harness.clock.now(),
  });
  // Its Interactions stay, without a note.
  expect(rows.interactions.length).toBeGreaterThanOrEqual(3);
  expect(rows.interactions.map(({ note }) => note)).toEqual(rows.interactions.map(() => null));
  expect(rows.followUps).toEqual([expect.objectContaining({ status: 'canceled', note: null })]);
  expect(rows.trials).toEqual([
    expect.objectContaining({
      battleId: battle.id,
      outcome: 'canceled',
      cancelReason: 'Contact supprimé',
      settledAt: harness.clock.now(),
    }),
  ]);
  expect(rows.assignments).toEqual([]);
  // Out of Contacts, the Funnel and the palette: the summary no longer has it, nor its record.
  const summaryAfter = await summaryOf(harness, user);
  expect(summaryAfter.contacts).toEqual([]);
  // Its days still count: the Entries of the week and the Activity of the day do not change.
  const days = {
    funnelEntryDays: daysBefore?.funnelEntryDays,
    prospectingActionDays: daysBefore?.prospectingActionDays,
  };
  expect(days.prospectingActionDays).toEqual(['2026-01-05']);
  expect(summaryAfter.deletedContactDays).toEqual(days);
  expect(changes.deletedContactDays).toEqual(days);
  const record = await harness.app.request(`/api/contacts/${claire.id}/record`, {
    headers: { Cookie: user.cookie },
  });
  expect(record.status).toBe(404);
  // In its Battle, its Trial stays, under “Contact deleted”.
  expect(await trialsIn(harness, user, battle.id)).toEqual([
    expect.objectContaining({ contactId: claire.id, contactDeleted: true, outcome: 'canceled' }),
  ]);
});

test('a Trial settled before stays counted in its Battle, and the reasons written about the Contact go too', async () => {
  const { harness, user, battle } = await battleAtFirstStage();
  const paul = await contactInTrial(harness, user, 'Paul', 'https://www.linkedin.com/in/paul');
  await recordReply(harness, user, paul.id, {
    occurredOn: '2026-01-06',
    channel: 'email',
    note: 'Intéressé',
    trialOutcome: 'success',
  });
  await changeStatus(harness, user, paul.id, { status: 'ally', reason: 'Ami de Jean' });
  const before = (await summaryOf(harness, user)).battles[0];

  const { changes } = deleted.parse(await (await deleteContact(harness, user, paul.id)).json());

  expect(changes.battles).toEqual([]);
  expect((await summaryOf(harness, user)).battles[0]).toEqual(before);
  const rows = await rowsOf(user, paul.id);
  expect(rows.trials).toEqual([expect.objectContaining({ outcome: 'success' })]);
  expect(rows.statusChanges.map(({ reason }) => reason)).toEqual(
    rows.statusChanges.map(() => null),
  );
  expect(await trialsIn(harness, user, battle.id)).toEqual([
    expect.objectContaining({ contactId: paul.id, contactDeleted: true, outcome: 'success' }),
  ]);
});

test('its LinkedIn profile is free again, its gestures can no longer be undone, nor can it be deleted twice', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const url = 'https://www.linkedin.com/in/jean-dupont';
  const { contact: jean, undoToken } = await addContact(harness, user, 'Jean Dupont', {
    linkedinUrl: url,
  });

  expect((await deleteContact(harness, user, jean.id)).status).toBe(200);

  expect((await undo(harness, user, undoToken)).status).toBe(404);
  expect((await deleteContact(harness, user, jean.id)).status).toBe(404);
  const edit = await postJson(
    harness.app,
    `/api/contacts/${jean.id}/edit`,
    { name: 'Jean' },
    user.cookie,
  );
  expect(edit.status).toBe(404);
  const { contact: again } = await addContact(harness, user, 'Jean Dupont', { linkedinUrl: url });
  expect(again.linkedinUrl).toBe(url);
});
