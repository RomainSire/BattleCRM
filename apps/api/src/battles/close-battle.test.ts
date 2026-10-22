import { battleTrials } from '@battlecrm/contract';
import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import {
  closeBattle,
  closeBattleRequest,
  openBattle,
  playTrials,
} from '../../test/factories/battle.ts';
import {
  addContact,
  gestureAnswer,
  revealAssignment,
  settleTrial,
  summaryOf,
  usePositioning,
} from '../../test/factories/contact.ts';
import { undo, undone } from '../../test/factories/gesture.ts';
import { createPositioning, stageIdsOf } from '../../test/factories/positioning.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';

type Harness = ReturnType<typeof testApp>;

/** The Trials of a Battle, as its panel reads them. */
async function readTrials(harness: Harness, user: { cookie: string }, battleId: string) {
  const response = await harness.app.request(`/api/battles/${battleId}/trials`, {
    headers: { Cookie: user.cookie },
  });
  expect(response.status).toBe(200);
  return battleTrials.parse(await response.json()).trials;
}

/** An edit of the Takeaway of a closed Battle. */
const editTakeaway = (
  harness: Harness,
  user: { cookie: string },
  battleId: string,
  takeaway: string,
) => postJson(harness.app, `/api/battles/${battleId}/takeaway`, { takeaway }, user.cookie);

/** A Battle opened at the second Stage, Entretien, nothing assigned there, and its token. */
async function openBattleAgain(harness: Harness, user: { cookie: string }) {
  const [, entretien = ''] = await stageIdsOf(harness, user);
  const { positioning: one } = await createPositioning(harness, user, entretien, { label: 'Un' });
  const { positioning: two } = await createPositioning(harness, user, entretien, { label: 'Deux' });
  const { battle, undoToken } = await openBattle(harness, user, {
    stageId: entretien,
    championId: one.id,
    challengerId: two.id,
  });
  return { battleId: battle.id, undoToken };
}

/** At Approche, CV A, the Champion, battles CV B, with an Horizon of `horizon`. */
async function battleAtApproche({ horizon = 25 } = {}) {
  const harness = testApp({}, { startsAt: '2026-01-10T09:00:00Z', chances: Array(80).fill(0) });
  const user = await makeUser(harness);
  const [approche = ''] = await stageIdsOf(harness, user);
  const { positioning: cvA } = await createPositioning(harness, user, approche, { label: 'CV A' });
  const { positioning: cvB } = await createPositioning(harness, user, approche, { label: 'CV B' });
  const { battle } = await openBattle(harness, user, {
    stageId: approche,
    championId: cvA.id,
    challengerId: cvB.id,
    horizon,
  });
  return { harness, user, approche, cvA, cvB, battle };
}

test('a conclusive Battle closed on the Verdict the Win rule proposes: the Challenger becomes Champion, the Champion is archived, beaten by it', async () => {
  const { harness, user, approche, cvA, cvB, battle } = await battleAtApproche();
  await playTrials(harness, user, cvA.id, { successes: 1, noResults: 9 });
  await playTrials(harness, user, cvB.id, { successes: 8, noResults: 2 });
  harness.clock.advance('P2D');

  const changes = await closeBattle(harness, user, battle.id, {
    verdict: 'challenger_wins',
    takeaway: '  Le CV court se lit.  ',
  });

  expect(changes.battles).toEqual([
    expect.objectContaining({
      id: battle.id,
      open: false,
      closedOn: '2026-01-12',
      verdict: 'challenger_wins',
      designated: false,
      takeaway: 'Le CV court se lit.',
    }),
  ]);
  expect(changes.positionings).toEqual([
    expect.objectContaining({
      id: cvA.id,
      archived: true,
      archivedByBattle: { againstId: cvB.id, on: '2026-01-12', verdict: 'challenger_wins' },
    }),
    expect.objectContaining({ id: cvB.id, archived: false, archivedByBattle: null }),
  ]);
  // The next Battle of the Stage opposes the new Champion; the one beaten may come back.
  const { battle: next } = await openBattle(harness, user, {
    stageId: approche,
    challengerId: cvA.id,
  });
  expect(next).toMatchObject({ championId: cvB.id, challengerId: cvA.id });
  const summary = await summaryOf(harness, user);
  expect(summary.positionings.find(({ id }) => id === cvA.id)).toMatchObject({
    archived: false,
    archivedByBattle: null,
  });
}, 60_000);

test('a Battle closes once: a second closing, or another User’s, is refused', async () => {
  const { harness, user, battle } = await battleAtApproche();
  const other = await makeUser(harness);

  await closeBattle(harness, user, battle.id);

  const again = await closeBattleRequest(harness, user, battle.id, { verdict: 'abandoned' });
  expect(again.status).toBe(409);
  expect(await again.json()).toEqual({ error: 'battle_closed' });
  const foreign = await closeBattleRequest(harness, other, battle.id, { verdict: 'abandoned' });
  expect(foreign.status).toBe(404);
});

test('closing cancels the Trials still in progress, “Battle closed”, without touching their Follow-ups, and drops the Assignments', async () => {
  const { harness, user, cvA, battle } = await battleAtApproche();
  const [claire] = await playTrials(harness, user, cvA.id, { inProgress: 1 });
  const { contact: hugo } = await addContact(harness, user, 'Hugo', { status: 'prospecting' });
  await revealAssignment(harness, user, hugo.id);
  const followUpBefore = (await summaryOf(harness, user)).contacts.find(
    ({ id }) => id === claire?.id,
  )?.followUp;

  const changes = await closeBattle(harness, user, battle.id);

  expect(changes.contacts.map(({ id }) => id)).toEqual(
    expect.arrayContaining([claire?.id, hugo.id]),
  );
  expect(changes.contacts).toHaveLength(2);
  for (const contact of changes.contacts) {
    expect(contact).toMatchObject({ trial: null, assignment: null });
  }
  expect(changes.contacts.find(({ id }) => id === claire?.id)?.followUp).toEqual(followUpBefore);
  expect(followUpBefore).not.toBeNull();
  expect(await readTrials(harness, user, battle.id)).toEqual([
    expect.objectContaining({
      contactId: claire?.id,
      outcome: 'canceled',
      cancelReason: 'Battle clôturée',
    }),
  ]);
});

test('a winner the Win rule does not satisfy needs the User to designate it, and is marked so', async () => {
  const { harness, user, approche, cvA, cvB, battle } = await battleAtApproche();

  const refused = await closeBattleRequest(harness, user, battle.id, {
    verdict: 'challenger_wins',
  });
  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ error: 'designation_required' });

  const changes = await closeBattle(harness, user, battle.id, {
    verdict: 'challenger_wins',
    designate: true,
  });
  expect(changes.battles).toEqual([
    expect.objectContaining({ verdict: 'challenger_wins', designated: true, takeaway: null }),
  ]);
  const { battle: next } = await openBattle(harness, user, {
    stageId: approche,
    challengerId: cvA.id,
  });
  expect(next.championId).toBe(cvB.id);
});

test('a draw or not enough data only as the Win rule finds them, at the Horizon', async () => {
  const { harness, user, cvA, cvB, battle } = await battleAtApproche({ horizon: 10 });
  const early = await closeBattleRequest(harness, user, battle.id, { verdict: 'draw' });
  expect(early.status).toBe(409);
  expect(await early.json()).toEqual({ error: 'verdict_unsupported' });
  await playTrials(harness, user, cvA.id, { successes: 3, noResults: 7 });
  await playTrials(harness, user, cvB.id, { successes: 3, noResults: 7 });

  const notEnough = await closeBattleRequest(harness, user, battle.id, {
    verdict: 'not_enough_data',
  });
  expect(notEnough.status).toBe(409);
  const changes = await closeBattle(harness, user, battle.id, { verdict: 'draw' });

  // The Champion keeps its title; the Challenger is archived, it may come back.
  expect(changes.battles).toEqual([
    expect.objectContaining({ verdict: 'draw', designated: false }),
  ]);
  expect(changes.positionings).toEqual([
    expect.objectContaining({ id: cvA.id, archived: false }),
    expect.objectContaining({
      id: cvB.id,
      archived: true,
      archivedByBattle: { againstId: cvA.id, on: '2026-01-10', verdict: 'draw' },
    }),
  ]);
}, 60_000);

test('an abandoned Battle taught nothing: the Champion keeps its title, the Challenger stays available', async () => {
  const { harness, user, approche, cvA, cvB, battle } = await battleAtApproche();

  const changes = await closeBattle(harness, user, battle.id, {
    verdict: 'abandoned',
    takeaway: "J'ai changé mon TJM en cours de route.",
  });

  expect(changes.positionings.map(({ archived }) => archived)).toEqual([false, false]);
  const { battle: next } = await openBattle(harness, user, {
    stageId: approche,
    challengerId: cvB.id,
  });
  expect(next.championId).toBe(cvA.id);
});

test('a closing is never taken back: “Undo” of what it settled for good is refused', async () => {
  const { harness, user, cvA, battle } = await battleAtApproche();
  const opening = await openBattleAgain(harness, user);
  const { contact: claire } = await addContact(harness, user, 'Claire', { status: 'prospecting' });
  await revealAssignment(harness, user, claire.id);
  const { undoToken: used } = await usePositioning(harness, user, claire.id, {
    positioningId: cvA.id,
    occurredOn: '2026-01-05',
  });
  const [hugo] = await playTrials(harness, user, cvA.id, { inProgress: 1 });
  const { undoToken: settled } = await settleTrial(harness, user, hugo?.id ?? '', {
    outcome: 'no_result',
  });

  await closeBattle(harness, user, battle.id);
  await closeBattle(harness, user, opening.battleId);

  for (const token of [used, settled, opening.undoToken]) {
    const response = await undo(harness, user, token);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'superseded' });
  }
}, 30_000);

test('the Takeaway of a closed Battle is edited afterwards, with “Undo”; an open one has none yet', async () => {
  const { harness, user, battle } = await battleAtApproche();
  const early = await editTakeaway(harness, user, battle.id, 'Trop tôt.');
  expect(early.status).toBe(409);
  expect(await early.json()).toEqual({ error: 'battle_open' });
  await closeBattle(harness, user, battle.id, { verdict: 'abandoned', takeaway: 'Première idée.' });

  const response = await editTakeaway(harness, user, battle.id, '  Mieux formulé.  ');

  expect(response.status).toBe(200);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  expect(changes.battles).toEqual([expect.objectContaining({ takeaway: 'Mieux formulé.' })]);
  const emptied = gestureAnswer.parse(
    await (await editTakeaway(harness, user, battle.id, '   ')).json(),
  );
  expect(emptied.changes.battles).toEqual([expect.objectContaining({ takeaway: null })]);
  expect((await undo(harness, user, emptied.undoToken)).status).toBe(200);
  const back = undone.parse(await (await undo(harness, user, undoToken)).json());
  expect(back.changes.battles).toEqual([expect.objectContaining({ takeaway: 'Première idée.' })]);
});
