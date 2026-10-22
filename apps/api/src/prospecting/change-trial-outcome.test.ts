import { summaryChanges, type TrialOutcome } from '@battlecrm/contract';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { closeBattle, openBattle } from '../../test/factories/battle.ts';
import {
  addContact,
  changeStage,
  changeStatus,
  recordReply,
  revealAssignment,
  summaryOf,
  usePositioning,
} from '../../test/factories/contact.ts';
import { undo, undone } from '../../test/factories/gesture.ts';
import { createPositioning, stageIdsOf } from '../../test/factories/positioning.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';

type Harness = ReturnType<typeof testApp>;

/** The outcome of a Trial changed from the Trials of its Battle (spec UX §5.5). */
const changeOutcome = (
  harness: Harness,
  user: { cookie: string },
  trialId: string,
  body: { outcome: TrialOutcome; cancelReason?: string },
) => postJson(harness.app, `/api/trials/${trialId}/change-outcome`, body, user.cookie);

const gestureAnswer = z.strictObject({ changes: summaryChanges, undoToken: z.uuid() });

/** The Trials of a Battle, as its panel reads them. */
const battleTrials = z.object({
  trials: z.array(
    z.strictObject({
      id: z.uuid(),
      contactId: z.uuid(),
      positioningId: z.uuid(),
      startedOn: z.iso.date(),
      outcome: z.enum(['in_progress', 'success', 'no_result', 'canceled']),
      target: z.enum(['consultancy', 'end_client', 'unknown']),
      cancelReason: z.string().nullable(),
    }),
  ),
});

const trialsOf = (harness: Harness, user: { cookie: string }, battleId: string) =>
  harness.app.request(`/api/battles/${battleId}/trials`, { headers: { Cookie: user.cookie } });

async function readTrials(harness: Harness, user: { cookie: string }, battleId: string) {
  const response = await trialsOf(harness, user, battleId);
  expect(response.status).toBe(200);
  return battleTrials.parse(await response.json()).trials;
}

/**
 * At Approche, CV A, the Champion, battles CV B: Claire was sent CV A on 2026-01-05, Hugo CV B on
 * 2026-01-06; both Trials in progress.
 */
async function battleUnderWay() {
  const harness = testApp({}, { startsAt: '2026-01-10T09:00:00Z', chances: [0, 0, 0, 0] });
  const user = await makeUser(harness);
  const [approche = '', entretien = ''] = await stageIdsOf(harness, user);
  const { positioning: cvA } = await createPositioning(harness, user, approche, { label: 'CV A' });
  const { positioning: cvB } = await createPositioning(harness, user, approche, { label: 'CV B' });
  const { battle } = await openBattle(harness, user, {
    stageId: approche,
    championId: cvA.id,
    challengerId: cvB.id,
  });
  const sent = async (name: string, positioningId: string, occurredOn: string) => {
    const { contact } = await addContact(harness, user, name, { status: 'prospecting' });
    await revealAssignment(harness, user, contact.id);
    await usePositioning(harness, user, contact.id, { positioningId, occurredOn });
    return contact;
  };
  const claire = await sent('Claire Martin', cvA.id, '2026-01-05');
  const hugo = await sent('Hugo Bernard', cvB.id, '2026-01-06');
  harness.clock.advance('PT1M');
  return { harness, user, approche, entretien, cvA, cvB, battle, claire, hugo, sent };
}

test('the summary counts the Trials of a Battle per Positioning, the canceled ones aside', async () => {
  const { harness, user, cvB, battle, claire, sent } = await battleUnderWay();
  await recordReply(harness, user, claire.id, {
    occurredOn: '2026-01-07',
    channel: 'email',
    trialOutcome: 'success',
  });
  const lea = await sent('Léa Petit', cvB.id, '2026-01-07');
  await changeStatus(harness, user, lea.id, {
    status: 'pool',
    trialOutcome: 'canceled',
    cancelReason: 'mauvaise adresse',
  });

  const [counted] = (await summaryOf(harness, user)).battles;

  expect(counted).toMatchObject({
    id: battle.id,
    trials: {
      champion: { successes: 1, noResults: 0, inProgress: 0 },
      challenger: { successes: 0, noResults: 0, inProgress: 1 },
    },
  });
});

test('the Trials of a Battle are read on demand, the latest first, with their Contact, outcome and Target', async () => {
  const { harness, user, cvA, cvB, battle, claire, hugo } = await battleUnderWay();

  const trials = await readTrials(harness, user, battle.id);

  expect(trials).toEqual([
    expect.objectContaining({
      contactId: hugo.id,
      positioningId: cvB.id,
      startedOn: '2026-01-06',
      outcome: 'in_progress',
      target: 'unknown',
      cancelReason: null,
    }),
    expect.objectContaining({ contactId: claire.id, positioningId: cvA.id }),
  ]);
});

test('the Trials of another User’s Battle, or of none, answer alike', async () => {
  const { harness, battle } = await battleUnderWay();
  const other = await makeUser(harness);

  expect((await trialsOf(harness, other, battle.id)).status).toBe(404);
  expect((await trialsOf(harness, other, 'not-an-id')).status).toBe(404);
});

test('the outcome of a Trial changes while its Battle is open; “Undo” puts it back', async () => {
  const { harness, user, battle, claire } = await battleUnderWay();
  await recordReply(harness, user, claire.id, {
    occurredOn: '2026-01-07',
    channel: 'email',
    trialOutcome: 'success',
  });
  const [, claireTrial] = await readTrials(harness, user, battle.id);
  harness.clock.advance('PT1M');

  const response = await changeOutcome(harness, user, claireTrial?.id ?? '', {
    outcome: 'no_result',
  });

  expect(response.status).toBe(200);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  expect(changes.battles[0]?.trials.champion).toEqual({
    successes: 0,
    noResults: 1,
    inProgress: 0,
  });
  expect(changes.contacts.map(({ id }) => id)).toEqual([claire.id]);
  const undoing = await undo(harness, user, undoToken);
  expect(undoing.status).toBe(200);
  const restored = undone.parse(await undoing.json()).changes;
  expect(restored.battles[0]?.trials.champion).toMatchObject({ successes: 1, noResults: 0 });
});

test('a Trial in progress settled from its Battle leaves its Contact without one', async () => {
  const { harness, user, battle, hugo } = await battleUnderWay();
  const [hugoTrial] = await readTrials(harness, user, battle.id);

  const response = await changeOutcome(harness, user, hugoTrial?.id ?? '', { outcome: 'success' });

  expect(response.status).toBe(200);
  const { changes } = gestureAnswer.parse(await response.json());
  expect(changes.contacts).toEqual([expect.objectContaining({ id: hugo.id, trial: null })]);
});

test('a Trial canceled from its Battle needs a reason, kept on it', async () => {
  const { harness, user, battle } = await battleUnderWay();
  const [hugoTrial] = await readTrials(harness, user, battle.id);
  const trialId = hugoTrial?.id ?? '';

  expect((await changeOutcome(harness, user, trialId, { outcome: 'canceled' })).status).toBe(400);
  const response = await changeOutcome(harness, user, trialId, {
    outcome: 'canceled',
    cancelReason: 'mauvais Contact',
  });

  expect(response.status).toBe(200);
  const [canceled] = await readTrials(harness, user, battle.id);
  expect(canceled).toMatchObject({ outcome: 'canceled', cancelReason: 'mauvais Contact' });
  const [counted] = (await summaryOf(harness, user)).battles;
  expect(counted?.trials.challenger).toEqual({ successes: 0, noResults: 0, inProgress: 0 });
});

test('a Trial put back in progress, its Contact Prospecting, gets its Trial back', async () => {
  const { harness, user, battle, claire } = await battleUnderWay();
  await recordReply(harness, user, claire.id, {
    occurredOn: '2026-01-07',
    channel: 'email',
    trialOutcome: 'no_result',
  });
  const [, claireTrial] = await readTrials(harness, user, battle.id);

  const response = await changeOutcome(harness, user, claireTrial?.id ?? '', {
    outcome: 'in_progress',
  });

  expect(response.status).toBe(200);
  const { changes } = gestureAnswer.parse(await response.json());
  expect(changes.contacts[0]?.trial).toMatchObject({ battleId: battle.id });
});

test('the outcome of a Trial no longer changes once its Battle is closed', async () => {
  const { harness, user, battle } = await battleUnderWay();
  const [hugoTrial] = await readTrials(harness, user, battle.id);
  await closeBattle(harness, user, battle.id);

  const response = await changeOutcome(harness, user, hugoTrial?.id ?? '', { outcome: 'success' });

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'battle_closed' });
});

test('the same outcome again is refused', async () => {
  const { harness, user, battle } = await battleUnderWay();
  const [hugoTrial] = await readTrials(harness, user, battle.id);

  const response = await changeOutcome(harness, user, hugoTrial?.id ?? '', {
    outcome: 'in_progress',
  });

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'same_outcome' });
});

test('a Trial goes back in progress only for a Contact Prospecting without another one', async () => {
  const { harness, user, entretien, battle, claire, hugo } = await battleUnderWay();
  // Claire left Prospecting, her Trial settled.
  await changeStatus(harness, user, claire.id, { status: 'pool', trialOutcome: 'no_result' });
  // Hugo moved on to Entretien, where another Battle started him a Trial.
  await recordReply(harness, user, hugo.id, {
    occurredOn: '2026-01-07',
    channel: 'email',
    trialOutcome: 'success',
  });
  const { positioning: pitch } = await createPositioning(harness, user, entretien, {
    label: 'Pitch',
  });
  const { positioning: demo } = await createPositioning(harness, user, entretien, {
    label: 'Démo',
  });
  await openBattle(harness, user, {
    stageId: entretien,
    championId: pitch.id,
    challengerId: demo.id,
  });
  await changeStage(harness, user, hugo.id, { stageId: entretien });
  await revealAssignment(harness, user, hugo.id);
  await usePositioning(harness, user, hugo.id, {
    positioningId: pitch.id,
    occurredOn: '2026-01-08',
  });
  const [hugoTrial, claireTrial] = await readTrials(harness, user, battle.id);

  const forClaire = await changeOutcome(harness, user, claireTrial?.id ?? '', {
    outcome: 'in_progress',
  });
  const forHugo = await changeOutcome(harness, user, hugoTrial?.id ?? '', {
    outcome: 'in_progress',
  });

  expect(forClaire.status).toBe(409);
  expect(await forClaire.json()).toEqual({ error: 'not_prospecting' });
  expect(forHugo.status).toBe(409);
  expect(await forHugo.json()).toEqual({ error: 'trial_in_progress' });
});

test('a canceled Trial is not counted again once its Contact has another one in the Battle', async () => {
  const { harness, user, cvB, battle, hugo } = await battleUnderWay();
  await changeStatus(harness, user, hugo.id, {
    status: 'pool',
    trialOutcome: 'canceled',
    cancelReason: 'parti en vacances',
  });
  await changeStatus(harness, user, hugo.id, { status: 'prospecting' });
  await revealAssignment(harness, user, hugo.id);
  await usePositioning(harness, user, hugo.id, {
    positioningId: cvB.id,
    occurredOn: '2026-01-09',
  });
  const canceled = (await readTrials(harness, user, battle.id)).find(
    ({ outcome }) => outcome === 'canceled',
  );

  const response = await changeOutcome(harness, user, canceled?.id ?? '', { outcome: 'success' });

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'already_tried' });
});

test('another User’s Trial answers as unknown', async () => {
  const { harness, user, battle } = await battleUnderWay();
  const [hugoTrial] = await readTrials(harness, user, battle.id);
  const other = await makeUser(harness);

  const response = await changeOutcome(harness, other, hugoTrial?.id ?? '', {
    outcome: 'success',
  });

  expect(response.status).toBe(404);
});

test('a change of outcome is no longer taken back once its Battle is closed', async () => {
  const { harness, user, battle } = await battleUnderWay();
  const [hugoTrial] = await readTrials(harness, user, battle.id);
  const response = await changeOutcome(harness, user, hugoTrial?.id ?? '', { outcome: 'success' });
  const { undoToken } = gestureAnswer.parse(await response.json());
  await closeBattle(harness, user, battle.id);

  const undoing = await undo(harness, user, undoToken);

  expect(undoing.status).toBe(409);
  expect(await undoing.json()).toEqual({ error: 'superseded' });
  const [kept] = await readTrials(harness, user, battle.id);
  expect(kept?.outcome).toBe('success');
});
