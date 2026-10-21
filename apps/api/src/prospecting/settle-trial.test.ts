import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { openBattle } from '../../test/factories/battle.ts';
import {
  addContact,
  cancelFollowUp,
  changeStatus,
  followUp,
  recordReply,
  revealAssignment,
  scheduleFollowUp,
  settleTrial,
  summaryOf,
  usePositioning,
} from '../../test/factories/contact.ts';
import { undo, undone } from '../../test/factories/gesture.ts';
import { createPositioning, stageIdsOf } from '../../test/factories/positioning.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { withUser } from '../db/index.ts';
import { trialDeviation } from './tables.ts';

/**
 * Claire, Prospecting at Approche, where CV A, the Champion, battles CV B: sent CV A, the Positioning
 * assigned, on 2026-01-05, she has a Trial in progress.
 */
async function trialInProgress() {
  const harness = testApp({}, { chances: [0] });
  const user = await makeUser(harness);
  const [approche = ''] = await stageIdsOf(harness, user);
  const { positioning: cvA } = await createPositioning(harness, user, approche, { label: 'CV A' });
  const { positioning: cvB } = await createPositioning(harness, user, approche, { label: 'CV B' });
  const { battle } = await openBattle(harness, user, {
    stageId: approche,
    championId: cvA.id,
    challengerId: cvB.id,
  });
  const { contact: claire } = await addContact(harness, user, 'Claire Martin', {
    status: 'prospecting',
  });
  await revealAssignment(harness, user, claire.id);
  await usePositioning(harness, user, claire.id, {
    positioningId: cvA.id,
    occurredOn: '2026-01-05',
  });
  harness.clock.advance('PT1M');
  return { harness, user, approche, cvA, cvB, battle, claire };
}

test('“Replied…” settles the Trial in progress as a Success; “Undo” puts it back in progress', async () => {
  const { harness, user, battle, claire } = await trialInProgress();

  const { contact, undoToken } = await recordReply(harness, user, claire.id, {
    occurredOn: '2026-01-05',
    channel: 'email',
    trialOutcome: 'success',
  });

  expect(contact.trial).toBeNull();
  expect(contact.status).toBe('prospecting');
  const [counted] = (await summaryOf(harness, user)).battles;
  expect(counted).toMatchObject({ id: battle.id, startedTrials: 1, finishedTrials: 1 });
  const undoing = await undo(harness, user, undoToken);
  expect(undoing.status).toBe(200);
  const { changes } = undone.parse(await undoing.json());
  expect(changes.contacts[0]?.trial).toMatchObject({ battleId: battle.id });
  expect(changes.battles[0]).toMatchObject({ startedTrials: 1, finishedTrials: 0 });
});

test('a No result in “Replied…” may put the Contact back in the Pool, with a reason, in the same gesture; “Undo” takes it all back', async () => {
  const { harness, user, approche, battle, claire } = await trialInProgress();

  const { contact, undoToken } = await recordReply(harness, user, claire.id, {
    occurredOn: '2026-01-05',
    channel: 'linkedin',
    trialOutcome: 'no_result',
    status: 'pool',
    reason: 'pas de besoin',
  });

  expect(contact).toMatchObject({ status: 'pool', statusReason: 'pas de besoin', trial: null });
  const undoing = await undo(harness, user, undoToken);
  const { changes } = undone.parse(await undoing.json());
  expect(changes.contacts[0]).toMatchObject({ status: 'prospecting', stageId: approche });
  expect(changes.contacts[0]?.trial?.battleId).toBe(battle.id);
});

test('“Replied…” leaving the Trial in progress keeps it; a Contact Prospecting changes Status by a reply only after a No result', async () => {
  const { harness, user, claire } = await trialInProgress();

  const refused = await postJson(
    harness.app,
    `/api/contacts/${claire.id}/record-reply`,
    { occurredOn: '2026-01-05', channel: 'email', trialOutcome: 'success', status: 'pool' },
    user.cookie,
  );
  const { contact } = await recordReply(harness, user, claire.id, {
    occurredOn: '2026-01-05',
    channel: 'email',
    trialOutcome: 'in_progress',
  });

  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ error: 'no_status_choice' });
  expect(contact.trial).not.toBeNull();
  expect(contact.lastDoneInteractionOn).toBe('2026-01-05');
});

test('leaving Prospecting settles the Trial in progress: a Success to the Circle, or canceled with its reason; “Undo” puts it back', async () => {
  const { harness, user, claire } = await trialInProgress();
  const leave = (body: object) =>
    postJson(harness.app, `/api/contacts/${claire.id}/change-status`, body, user.cookie);

  const unsettled = await leave({ status: 'archived' });
  const reasonless = await leave({ status: 'archived', trialOutcome: 'canceled' });
  const { contact, undoToken } = await changeStatus(harness, user, claire.id, {
    status: 'ally',
    trialOutcome: 'success',
  });

  expect(unsettled.status).toBe(409);
  expect(await unsettled.json()).toEqual({ error: 'trial_in_progress' });
  expect(reasonless.status).toBe(400);
  expect(contact).toMatchObject({ status: 'ally', trial: null });
  expect((await summaryOf(harness, user)).battles[0]).toMatchObject({ finishedTrials: 1 });
  await undo(harness, user, undoToken);
  const { contact: archived } = await changeStatus(harness, user, claire.id, {
    status: 'archived',
    trialOutcome: 'canceled',
    cancelReason: 'a changé de métier',
  });
  expect(archived.trial).toBeNull();
  expect((await summaryOf(harness, user)).battles[0]).toMatchObject({
    startedTrials: 0,
    finishedTrials: 0,
  });
});

test('“No result…” settles the Trial without a reply, then may archive the Contact; “Undo” takes both back', async () => {
  const { harness, user, claire } = await trialInProgress();

  const { contact, undoToken } = await settleTrial(harness, user, claire.id, {
    outcome: 'no_result',
    status: 'archived',
    reason: 'hors sujet',
  });

  expect(contact).toMatchObject({ status: 'archived', statusReason: 'hors sujet', trial: null });
  expect((await summaryOf(harness, user)).battles[0]).toMatchObject({ finishedTrials: 1 });
  expect((await undo(harness, user, undoToken)).status).toBe(200);
  const [back] = (await summaryOf(harness, user)).contacts;
  expect(back).toMatchObject({ status: 'prospecting' });
  expect(back?.trial).not.toBeNull();
});

test('“No result…” kept Prospecting leaves the Contact where it is; without a Trial in progress, it is refused', async () => {
  const { harness, user, claire } = await trialInProgress();

  const { contact } = await settleTrial(harness, user, claire.id, { outcome: 'no_result' });
  const again = await postJson(
    harness.app,
    `/api/contacts/${claire.id}/settle-trial`,
    { outcome: 'no_result' },
    user.cookie,
  );

  expect(contact).toMatchObject({ status: 'prospecting', trial: null });
  expect(again.status).toBe(409);
  expect(await again.json()).toEqual({ error: 'no_trial' });
});

const deviationsOf = ({ userId }: { userId: string }) =>
  withUser(userId, (tx) =>
    tx
      .select({ kind: trialDeviation.kind, trialId: trialDeviation.trialId })
      .from(trialDeviation)
      .where(eq(trialDeviation.userId, userId)),
  );

test('“Follow up anyway”, without a Follow-up scheduled, is a Follow-up off the Cadence traced on the Trial; “Undo” leaves no trace', async () => {
  const { harness, user, claire } = await trialInProgress();
  await cancelFollowUp(harness, user, claire.id);

  const { contact, undoToken } = await followUp(harness, user, claire.id, {
    occurredOn: '2026-01-05',
    anyway: true,
  });

  expect(contact.followUp).toBeNull();
  expect(contact.prospectingActionDays).toEqual(['2026-01-05', '2026-01-05']);
  expect(await deviationsOf(user)).toEqual([
    { kind: 'off_cadence_follow_up', trialId: expect.any(String) },
  ]);
  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect(await deviationsOf(user)).toEqual([]);
  const [back] = (await summaryOf(harness, user)).contacts;
  expect(back?.prospectingActionDays).toEqual(['2026-01-05']);
});

test('without a Trial in progress, there is nothing to follow up anyway', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact } = await addContact(harness, user, 'Paul', { status: 'prospecting' });

  const response = await postJson(
    harness.app,
    `/api/contacts/${contact.id}/follow-up`,
    { occurredOn: '2026-01-05', anyway: true },
    user.cookie,
  );

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'no_follow_up' });
});

test('changing the day of a Follow-up during a Trial is a deviation traced on it, “Undo” removes it; its note alone is none', async () => {
  const { harness, user, claire } = await trialInProgress();
  const [scheduled] = (await summaryOf(harness, user)).contacts;
  const dueOn = scheduled?.followUp?.dueOn ?? '';

  await scheduleFollowUp(harness, user, claire.id, { dueOn, note: 'relire le CV' });
  const { undoToken } = await scheduleFollowUp(harness, user, claire.id, { dueOn: '2026-01-20' });

  expect((await deviationsOf(user)).map(({ kind }) => kind)).toEqual(['follow_up_moved']);
  await undo(harness, user, undoToken);
  expect(await deviationsOf(user)).toEqual([]);
});

test('the first Follow-up moved when the Positioning is sent is a deviation traced on the Trial it starts', async () => {
  const { harness, user, cvA, claire } = await trialInProgress();
  const { contact: paul } = await addContact(harness, user, 'Paul', { status: 'prospecting' });
  await revealAssignment(harness, user, paul.id);
  await settleTrial(harness, user, claire.id, { outcome: 'no_result' });

  const [revealed] = (await summaryOf(harness, user)).contacts.filter(({ id }) => id === paul.id);
  await usePositioning(harness, user, paul.id, {
    positioningId: revealed?.assignment?.positioningId ?? cvA.id,
    occurredOn: '2026-01-05',
    followUpOn: '2026-01-12',
  });

  expect((await deviationsOf(user)).map(({ kind }) => kind)).toEqual(['follow_up_moved']);
});
