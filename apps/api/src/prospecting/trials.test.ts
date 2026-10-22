import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { closeBattle, openBattle } from '../../test/factories/battle.ts';
import {
  addContact,
  changeStatus,
  gestureAnswer,
  revealAssignment,
  revealAssignmentRequest,
  summaryOf,
  usePositioning,
} from '../../test/factories/contact.ts';
import { undo, undone } from '../../test/factories/gesture.ts';
import {
  attachFile,
  createPositioning,
  SHORT_EMAIL,
  stageIdsOf,
} from '../../test/factories/positioning.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { withUser } from '../db/index.ts';
import { trial } from './index.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

/**
 * A User whose first Stage, Approche, has an open Battle: CV A, the Champion, against CV B; each
 * choice by chance, at a tie, takes the next of `chances`.
 */
async function battleAtApproche({
  chances = [],
  target = null,
  horizon,
}: {
  chances?: number[];
  target?: 'consultancy' | 'end_client' | 'unknown' | null;
  horizon?: number;
} = {}) {
  const harness = testApp({}, { chances });
  const user = await makeUser(harness);
  const [approche = '', qualif = ''] = await stageIdsOf(harness, user);
  const { positioning: cvA } = await createPositioning(harness, user, approche, { label: 'CV A' });
  const { positioning: cvB } = await createPositioning(harness, user, approche, { label: 'CV B' });
  const { battle, undoToken } = await openBattle(harness, user, {
    stageId: approche,
    championId: cvA.id,
    challengerId: cvB.id,
    target,
    ...(horizon !== undefined && { horizon }),
  });
  return { harness, user, approche, qualif, cvA, cvB, battle, openingToken: undoToken };
}

/** A Contact entered at Approche, of an ESN when said so. */
async function prospect(harness: Harness, user: User, name: string, esn?: string) {
  const { contact } = await addContact(harness, user, name, {
    status: 'prospecting',
    ...(esn !== undefined && { newOrganization: { name: esn, type: 'consultancy' } }),
  });
  return contact;
}

const trialsOf = ({ userId }: User) =>
  withUser(userId, (tx) => tx.select().from(trial).where(eq(trial.userId, userId)));

test('opening “Send to” reveals the Assignment, chosen by chance at a tie, then reserved: never chosen again', async () => {
  // One chance only: a second choice would fail the test.
  const { harness, user, cvB, battle } = await battleAtApproche({ chances: [1] });
  const claire = await prospect(harness, user, 'Claire Martin');

  const revealed = await revealAssignment(harness, user, claire.id);
  const again = await revealAssignment(harness, user, claire.id);

  expect(revealed.assignment).toEqual({ battleId: battle.id, positioningId: cvB.id });
  expect(revealed.withoutTrial).toBeNull();
  expect(revealed.changes.contacts[0]?.assignment).toEqual(revealed.assignment);
  expect(again.assignment).toEqual(revealed.assignment);
  const [summarized] = (await summaryOf(harness, user)).contacts;
  expect(summarized?.assignment).toEqual(revealed.assignment);
});

test('the Assignment balances the two Positionings among the Contacts of the same Target', async () => {
  // Claire gets by chance CV A; Paul gets CV B without chance; Inès, at a tie again, gets by chance CV B; Marc, of an
  // ESN, is balanced among the Contacts of ESN alone: by chance, CV A.
  const { harness, user, cvA, cvB } = await battleAtApproche({ chances: [0, 1, 0] });
  const assigned = [];
  for (const name of ['Claire', 'Paul', 'Inès']) {
    const contact = await prospect(harness, user, name);
    assigned.push((await revealAssignment(harness, user, contact.id)).assignment?.positioningId);
  }
  const marc = await prospect(harness, user, 'Marc', 'Capgemini');

  const forMarc = await revealAssignment(harness, user, marc.id);

  expect(assigned).toEqual([cvA.id, cvB.id, cvB.id]);
  expect(forMarc.assignment?.positioningId).toBe(cvA.id);
});

test('two Contacts revealed at once are balanced all the same: the Battle assigns one at a time', async () => {
  // One chance only: the second Contact must see the first one's Assignment.
  const { harness, user, cvA, cvB } = await battleAtApproche({ chances: [0] });
  const claire = await prospect(harness, user, 'Claire');
  const paul = await prospect(harness, user, 'Paul');

  const answers = await Promise.all([
    revealAssignmentRequest(harness, user, claire.id),
    revealAssignmentRequest(harness, user, paul.id),
  ]);

  expect(answers.map(({ status }) => status)).toEqual([200, 200]);
  const assigned = (await summaryOf(harness, user)).contacts.map(
    ({ assignment }) => assignment?.positioningId,
  );
  expect(new Set(assigned)).toEqual(new Set([cvA.id, cvB.id]));
});

test("“It's sent” with the Positioning assigned starts a Trial on the day of the use; “Undo” removes the Trial but keeps the Assignment", async () => {
  const { harness, user, cvA, battle } = await battleAtApproche({ chances: [0] });
  const claire = await prospect(harness, user, 'Claire');
  await revealAssignment(harness, user, claire.id);
  harness.clock.advance('PT1M');

  const response = await postJson(
    harness.app,
    `/api/contacts/${claire.id}/use-positioning`,
    { positioningId: cvA.id, occurredOn: '2026-01-04' },
    user.cookie,
  );

  expect(response.status).toBe(200);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  expect(changes.contacts[0]?.trial).toEqual({
    battleId: battle.id,
    positioningId: cvA.id,
    startedOn: '2026-01-04',
    overridden: false,
  });
  // Frozen from its first Trial.
  expect(changes.positionings).toEqual([expect.objectContaining({ id: cvA.id, trialCount: 1 })]);
  expect(changes.battles.map(({ id }) => id)).toEqual([battle.id]);
  expect(await trialsOf(user)).toEqual([
    expect.objectContaining({ target: 'unknown', overridden: false, outcome: 'in_progress' }),
  ]);

  const undoing = await undo(harness, user, undoToken);

  expect(undoing.status).toBe(200);
  const [restored] = undone.parse(await undoing.json()).changes.contacts;
  expect(restored?.trial).toBeNull();
  expect(restored?.assignment).toEqual({ battleId: battle.id, positioningId: cvA.id });
  expect(await trialsOf(user)).toEqual([]);
  // Revealed again, the same: no chance is left.
  expect((await revealAssignment(harness, user, claire.id)).assignment?.positioningId).toBe(cvA.id);
});

test('using the other Positioning is an Override, allowed and traced on the Trial with its optional reason', async () => {
  const { harness, user, cvB } = await battleAtApproche({ chances: [0] });
  const claire = await prospect(harness, user, 'Claire');
  const paul = await prospect(harness, user, 'Paul');
  await revealAssignment(harness, user, claire.id);
  await revealAssignment(harness, user, paul.id);

  const { contact: overridden } = await usePositioning(harness, user, claire.id, {
    positioningId: cvB.id,
    occurredOn: '2026-01-05',
    overrideReason: '  elle préfère LinkedIn  ',
  });
  // Paul was assigned CV B: a reason without an Override is not kept.
  await usePositioning(harness, user, paul.id, {
    positioningId: cvB.id,
    occurredOn: '2026-01-05',
    overrideReason: 'sans objet',
  });

  expect(overridden.trial).toMatchObject({ positioningId: cvB.id, overridden: true });
  const trials = await trialsOf(user);
  expect(trials.find(({ contactId }) => contactId === claire.id)).toMatchObject({
    overridden: true,
    overrideReason: 'elle préfère LinkedIn',
  });
  expect(trials.find(({ contactId }) => contactId === paul.id)).toMatchObject({
    overridden: false,
    overrideReason: null,
  });
});

test('the Assignment is revealed before anything is sent: a use at a Stage with an open Battle waits for it', async () => {
  const { harness, user, cvA } = await battleAtApproche();
  const claire = await prospect(harness, user, 'Claire');

  const response = await postJson(
    harness.app,
    `/api/contacts/${claire.id}/use-positioning`,
    { positioningId: cvA.id, occurredOn: '2026-01-05' },
    user.cookie,
  );

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'assignment_required' });
});

test('a Contact already tried in this Battle is told so, and its next use starts no Trial', async () => {
  const { harness, user, cvA, cvB } = await battleAtApproche({ chances: [0] });
  const claire = await prospect(harness, user, 'Claire');
  await revealAssignment(harness, user, claire.id);
  await usePositioning(harness, user, claire.id, {
    positioningId: cvA.id,
    occurredOn: '2026-01-05',
  });

  const revealed = await revealAssignment(harness, user, claire.id);
  await usePositioning(harness, user, claire.id, {
    positioningId: cvB.id,
    occurredOn: '2026-01-05',
  });

  expect(revealed).toMatchObject({ assignment: null, withoutTrial: 'already_tried' });
  expect(await trialsOf(user)).toHaveLength(1);
});

test('out of the Target of a restricted Battle, or with a Positioning out of the Battle, a use starts no Trial', async () => {
  const { harness, user, approche, cvA } = await battleAtApproche({
    target: 'consultancy',
    chances: [0],
  });
  const claire = await prospect(harness, user, 'Claire');
  const marc = await prospect(harness, user, 'Marc', 'Capgemini');
  const { positioning: other } = await createPositioning(harness, user, approche, {
    label: 'Appel',
  });

  const revealed = await revealAssignment(harness, user, claire.id);
  await usePositioning(harness, user, claire.id, {
    positioningId: cvA.id,
    occurredOn: '2026-01-05',
  });
  // Of an ESN, Marc is in the Target, but sent a Positioning the Battle does not oppose.
  await revealAssignment(harness, user, marc.id);
  const { contact: sentOther } = await usePositioning(harness, user, marc.id, {
    positioningId: other.id,
    occurredOn: '2026-01-05',
  });

  expect(revealed).toMatchObject({ assignment: null, withoutTrial: 'off_target' });
  expect(sentOther.trial).toBeNull();
  expect(await trialsOf(user)).toEqual([]);
}, 20_000);

test('a Positioning at the Horizon is no longer assigned; both at it, no Trial', async () => {
  // Every other Contact finds the two even, and chances: 10 Trials each.
  const { harness, user } = await battleAtApproche({ horizon: 10, chances: Array(10).fill(0) });
  for (let index = 0; index < 20; index += 1) {
    const contact = await prospect(harness, user, `Contact ${index}`);
    const { assignment } = await revealAssignment(harness, user, contact.id);
    if (!assignment) throw new Error('An Assignment was expected');
    await usePositioning(harness, user, contact.id, {
      positioningId: assignment.positioningId,
      occurredOn: '2026-01-05',
    });
  }
  const late = await prospect(harness, user, 'En retard');

  const revealed = await revealAssignment(harness, user, late.id);

  expect(revealed).toMatchObject({ assignment: null, withoutTrial: 'horizon' });
  const counts = (await summaryOf(harness, user)).positionings.map(({ trialCount }) => trialCount);
  expect(counts).toEqual([10, 10]);
}, 30_000);

test('leaving Prospecting waits for the Trial in progress to be settled; without one, the Assignment falls, and “Undo” brings it back', async () => {
  const { harness, user, cvA } = await battleAtApproche({ chances: [0] });
  const claire = await prospect(harness, user, 'Claire');
  const paul = await prospect(harness, user, 'Paul');
  await revealAssignment(harness, user, claire.id);
  await usePositioning(harness, user, claire.id, {
    positioningId: cvA.id,
    occurredOn: '2026-01-05',
  });
  const { assignment } = await revealAssignment(harness, user, paul.id);

  const refused = await postJson(
    harness.app,
    `/api/contacts/${claire.id}/change-status`,
    { status: 'pool' },
    user.cookie,
  );
  const { contact: pooled, undoToken } = await changeStatus(harness, user, paul.id, {
    status: 'pool',
  });

  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ error: 'trial_in_progress' });
  expect(pooled.assignment).toBeNull();

  const undoing = await undo(harness, user, undoToken);

  expect(undoing.status).toBe(200);
  expect(undone.parse(await undoing.json()).changes.contacts[0]?.assignment).toEqual(assignment);
});

test('once an Assignment is revealed, neither the entry of the Contact nor the opening of the Battle can be taken back', async () => {
  const { harness, user, approche, openingToken } = await battleAtApproche({ chances: [0] });
  const { contact: claire } = await addContact(harness, user, 'Claire');
  const { undoToken: entryToken } = await changeStatus(harness, user, claire.id, {
    status: 'prospecting',
    stageId: approche,
  });
  await revealAssignment(harness, user, claire.id);

  const entry = await undo(harness, user, entryToken);
  const opening = await undo(harness, user, openingToken);

  expect(entry.status).toBe(409);
  expect(await entry.json()).toEqual({ error: 'superseded' });
  expect(opening.status).toBe(409);
  expect(await opening.json()).toEqual({ error: 'superseded' });
});

test('a Contact out of a Stage with an open Battle has no Assignment to reveal', async () => {
  const { harness, user, qualif } = await battleAtApproche();
  const { contact: pool } = await addContact(harness, user, 'Claire');
  const { contact: elsewhere } = await addContact(harness, user, 'Paul', {
    status: 'prospecting',
    stageId: qualif,
  });

  for (const contact of [pool, elsewhere]) {
    const response = await revealAssignmentRequest(harness, user, contact.id);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'not_in_battle' });
  }
});

test('frozen from its first Trial, a Positioning is neither edited nor its attachments changed; an edit made before is no longer taken back', async () => {
  const { harness, user, cvA } = await battleAtApproche({ chances: [0] });
  const claire = await prospect(harness, user, 'Claire');
  const { attachment } = await attachFile(harness, user, cvA.id);
  // The last gesture on CV A before its first Trial: “Undo” could still reach it.
  const editing = await postJson(
    harness.app,
    `/api/positionings/${cvA.id}/edit`,
    { ...SHORT_EMAIL, label: 'CV A', content: 'Avant le premier Essai' },
    user.cookie,
  );
  const { undoToken: editToken } = gestureAnswer.parse(await editing.json());
  await revealAssignment(harness, user, claire.id);
  await usePositioning(harness, user, claire.id, {
    positioningId: cvA.id,
    occurredOn: '2026-01-05',
  });

  const edited = await postJson(
    harness.app,
    `/api/positionings/${cvA.id}/edit`,
    { ...SHORT_EMAIL, label: 'CV A' },
    user.cookie,
  );
  const removed = await postJson(
    harness.app,
    `/api/attachments/${attachment.id}/remove`,
    {},
    user.cookie,
  );
  const undoneEdit = await undo(harness, user, editToken);
  const relabeled = await postJson(
    harness.app,
    `/api/positionings/${cvA.id}/relabel`,
    { label: 'CV A (corrigé)' },
    user.cookie,
  );

  expect(edited.status).toBe(409);
  expect(await edited.json()).toEqual({ error: 'frozen' });
  expect(removed.status).toBe(409);
  expect(await removed.json()).toEqual({ error: 'frozen' });
  expect(undoneEdit.status).toBe(409);
  expect(await undoneEdit.json()).toEqual({ error: 'superseded' });
  // Only a typo in its label stays fixable.
  expect(relabeled.status).toBe(200);
});

/** As many Trials as `each` for both Positionings, each Contact sent what it is assigned. */
async function tryEach(harness: Harness, user: User, each: number) {
  for (let index = 0; index < 2 * each; index += 1) {
    const contact = await prospect(harness, user, `Contact ${index}`);
    const { assignment } = await revealAssignment(harness, user, contact.id);
    if (!assignment) throw new Error('An Assignment was expected');
    await usePositioning(harness, user, contact.id, {
      positioningId: assignment.positioningId,
      occurredOn: '2026-01-05',
    });
  }
}

test('two uses at once, one Trial short of the Horizon: only one starts a Trial', async () => {
  // A chance for every other Contact of the 18, then Claire gets by chance CV A; Paul gets CV B.
  const { harness, user, cvA, cvB } = await battleAtApproche({
    horizon: 10,
    chances: [...Array<number>(9).fill(0), 0],
  });
  await tryEach(harness, user, 9);
  const claire = await prospect(harness, user, 'Claire');
  const paul = await prospect(harness, user, 'Paul');
  await revealAssignment(harness, user, claire.id);
  await revealAssignment(harness, user, paul.id);

  const answers = await Promise.all(
    [claire, paul].map(async (contact) =>
      postJson(
        harness.app,
        `/api/contacts/${contact.id}/use-positioning`,
        { positioningId: cvA.id, occurredOn: '2026-01-05' },
        user.cookie,
      ),
    ),
  );

  expect(answers.map(({ status }) => status)).toEqual([200, 200]);
  const { positionings } = await summaryOf(harness, user);
  expect(positionings.find(({ id }) => id === cvA.id)?.trialCount).toBe(10);
  expect(positionings.find(({ id }) => id === cvB.id)?.trialCount).toBe(9);
}, 30_000);

test('a reserved Positioning that reached the Horizon since is no longer assigned: the other one is, without an Override', async () => {
  // Claire gets by chance CV A, Paul gets CV B, Inès gets by chance CV A: both are as loaded then.
  const { harness, user, cvA, cvB } = await battleAtApproche({
    horizon: 10,
    chances: [...Array<number>(9).fill(0), 0, 0],
  });
  await tryEach(harness, user, 9);
  const [claire, paul, ines] = [
    await prospect(harness, user, 'Claire'),
    await prospect(harness, user, 'Paul'),
    await prospect(harness, user, 'Inès'),
  ];
  for (const contact of [claire, paul, ines]) await revealAssignment(harness, user, contact.id);
  await usePositioning(harness, user, claire.id, {
    positioningId: cvA.id,
    occurredOn: '2026-01-05',
  });

  const revealed = await revealAssignment(harness, user, ines.id);
  const { contact: sent } = await usePositioning(harness, user, ines.id, {
    positioningId: cvB.id,
    occurredOn: '2026-01-05',
  });

  expect(revealed.assignment?.positioningId).toBe(cvB.id);
  expect(sent.trial).toMatchObject({ positioningId: cvB.id, overridden: false });
}, 30_000);

test('an Assignment left from a closed Battle falls: the next Battle of the Stage assigns anew', async () => {
  const { harness, user, approche, cvB, battle } = await battleAtApproche({ chances: [0, 1] });
  const claire = await prospect(harness, user, 'Claire');
  await revealAssignment(harness, user, claire.id);
  await closeBattle(harness, user, battle.id);
  const { battle: next } = await openBattle(harness, user, {
    stageId: approche,
    challengerId: cvB.id,
  });

  const revealed = await revealAssignment(harness, user, claire.id);

  expect(revealed.assignment).toEqual({ battleId: next.id, positioningId: cvB.id });
});
