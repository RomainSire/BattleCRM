import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { openBattle } from '../../test/factories/battle.ts';
import {
  addContact,
  changeStage,
  changeStatus,
  recordReply,
  revealAssignment,
  summaryOf,
  usePositioning,
} from '../../test/factories/contact.ts';
import { undo } from '../../test/factories/gesture.ts';
import { createPositioning, stageIdsOf } from '../../test/factories/positioning.ts';
import { archiveStage } from '../../test/factories/stage.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { withUser } from '../db/index.ts';
import { stage } from '../funnel/index.ts';

type Harness = ReturnType<typeof testApp>;

/** The changes of Stage of the thread of a Contact, the latest first, as its record reads them. */
async function stageChangesOf(harness: Harness, user: { cookie: string }, contactId: string) {
  const response = await harness.app.request(`/api/contacts/${contactId}/record`, {
    headers: { Cookie: user.cookie },
  });
  const { thread } = z
    .object({
      thread: z.array(
        z.object({
          kind: z.string(),
          direction: z.string(),
          stageChange: z
            .strictObject({ fromStageId: z.uuid(), toStageId: z.uuid(), forward: z.boolean() })
            .nullable(),
        }),
      ),
    })
    .parse(await response.json());
  return thread.filter(({ kind }) => kind === 'stage_changed');
}

/** Paul, Prospecting at Approche, the first of the four Standard stages, without a Trial. */
async function atOutreach() {
  const harness = testApp();
  const user = await makeUser(harness);
  const stages = await stageIdsOf(harness, user);
  const { contact: paul } = await addContact(harness, user, 'Paul', { status: 'prospecting' });
  return { harness, user, stages, paul };
}

test('a Contact Prospecting changes Stage: an Interaction neither outbound nor inbound, forward in the Funnel of the moment; “Undo” takes it back', async () => {
  const { harness, user, stages, paul } = await atOutreach();
  const [outreach = '', agency = ''] = stages;

  const { contact, undoToken } = await changeStage(harness, user, paul.id, { stageId: agency });

  expect(contact).toMatchObject({ status: 'prospecting', stageId: agency });
  // Neither outbound nor inbound: no Funnel entry, nothing done.
  expect(contact.funnelEntryDays).toEqual(paul.funnelEntryDays);
  expect(contact.lastDoneInteractionOn).toBeNull();
  expect(await stageChangesOf(harness, user, paul.id)).toEqual([
    {
      kind: 'stage_changed',
      direction: 'none',
      stageChange: { fromStageId: outreach, toStageId: agency, forward: true },
    },
  ]);
  expect((await undo(harness, user, undoToken)).status).toBe(200);
  const [back] = (await summaryOf(harness, user)).contacts;
  expect(back?.stageId).toBe(outreach);
  expect(await stageChangesOf(harness, user, paul.id)).toEqual([]);
});

test('reordering the Funnel afterwards does not change the way a past change of Stage reads', async () => {
  const { harness, user, stages, paul } = await atOutreach();
  const [outreach = '', agency = '', client = ''] = stages;
  await changeStage(harness, user, paul.id, { stageId: client });
  await changeStage(harness, user, paul.id, { stageId: agency });

  // Client screening before Outreach now, written straight in until reordering has its gesture (ticket 35).
  await withUser(user.userId, (tx) =>
    tx.update(stage).set({ position: -1 }).where(eq(stage.id, client)),
  );

  expect(
    (await stageChangesOf(harness, user, paul.id)).map(({ stageChange }) => stageChange),
  ).toEqual([
    { fromStageId: client, toStageId: agency, forward: false },
    { fromStageId: outreach, toStageId: client, forward: true },
  ]);
});

test('only a Contact Prospecting changes Stage, to another Stage of the Funnel', async () => {
  const { harness, user, stages, paul } = await atOutreach();
  const [outreach = '', agency = '', , closing = ''] = stages;
  const { contact: anne } = await addContact(harness, user, 'Anne');
  await archiveStage(user, closing, harness.clock.now());
  const move = (contactId: string, stageId: string) =>
    postJson(harness.app, `/api/contacts/${contactId}/change-stage`, { stageId }, user.cookie);

  const fromPool = await move(anne.id, agency);
  const same = await move(paul.id, outreach);
  const archived = await move(paul.id, closing);

  expect(fromPool.status).toBe(409);
  expect(await fromPool.json()).toEqual({ error: 'not_prospecting' });
  expect(same.status).toBe(409);
  expect(await same.json()).toEqual({ error: 'same_stage' });
  expect(archived.status).toBe(400);
  expect(await archived.json()).toEqual({ error: 'unknown_stage' });
});

/**
 * Claire, Prospecting at Approche, where CV A, the Champion, battles CV B: sent CV A, the Positioning
 * assigned, she has a Trial in progress and Follow-up 1 scheduled.
 */
async function trialInProgress() {
  const harness = testApp({}, { chances: [0, 0] });
  const user = await makeUser(harness);
  const stages = await stageIdsOf(harness, user);
  const [outreach = ''] = stages;
  const { positioning: cvA } = await createPositioning(harness, user, outreach, { label: 'CV A' });
  const { positioning: cvB } = await createPositioning(harness, user, outreach, { label: 'CV B' });
  const { battle } = await openBattle(harness, user, {
    stageId: outreach,
    championId: cvA.id,
    challengerId: cvB.id,
  });
  const { contact: claire } = await addContact(harness, user, 'Claire', { status: 'prospecting' });
  await revealAssignment(harness, user, claire.id);
  await usePositioning(harness, user, claire.id, {
    positioningId: cvA.id,
    occurredOn: '2026-01-05',
  });
  harness.clock.advance('PT1M');
  return { harness, user, stages, battle, claire };
}

test('with a Trial in progress, a change of Stage settles it first: a Success, Follow-up 1 canceled; “Undo” puts both back', async () => {
  const { harness, user, stages, battle, claire } = await trialInProgress();
  const [, agency = ''] = stages;

  const unsettled = await postJson(
    harness.app,
    `/api/contacts/${claire.id}/change-stage`,
    { stageId: agency },
    user.cookie,
  );
  const { contact, undoToken } = await changeStage(harness, user, claire.id, {
    stageId: agency,
    trialOutcome: 'success',
    cancelFollowUp: true,
  });

  expect(unsettled.status).toBe(409);
  expect(await unsettled.json()).toEqual({ error: 'trial_in_progress' });
  expect(contact).toMatchObject({ stageId: agency, trial: null, followUp: null });
  expect((await summaryOf(harness, user)).battles[0]).toMatchObject({ finishedTrials: 1 });
  expect((await undo(harness, user, undoToken)).status).toBe(200);
  const [back] = (await summaryOf(harness, user)).contacts;
  expect(back?.trial?.battleId).toBe(battle.id);
  expect(back?.followUp?.rank).toBe(1);
});

test('left in progress, the Trial stays where it was; the Assignment falls with the Stage left, and “Undo” brings it back', async () => {
  const { harness, user, stages, battle, claire } = await trialInProgress();
  const [, agency = ''] = stages;

  const { contact, undoToken } = await changeStage(harness, user, claire.id, {
    stageId: agency,
    trialOutcome: 'in_progress',
  });

  expect(contact.trial?.battleId).toBe(battle.id);
  expect(contact.assignment).toBeNull();
  expect(contact.followUp?.rank).toBe(1);
  await undo(harness, user, undoToken);
  const [back] = (await summaryOf(harness, user)).contacts;
  expect(back?.assignment?.battleId).toBe(battle.id);
});

test('“Replied…” moves a Contact Prospecting to another Stage in the same gesture; “Undo” takes it back', async () => {
  const { harness, user, stages, claire } = await trialInProgress();
  const [outreach = '', agency = ''] = stages;

  const { contact, undoToken } = await recordReply(harness, user, claire.id, {
    occurredOn: '2026-01-05',
    channel: 'email',
    trialOutcome: 'success',
    stageId: agency,
  });

  expect(contact).toMatchObject({ status: 'prospecting', stageId: agency, trial: null });
  expect(await stageChangesOf(harness, user, claire.id)).toHaveLength(1);
  await undo(harness, user, undoToken);
  const [back] = (await summaryOf(harness, user)).contacts;
  expect(back?.stageId).toBe(outreach);
  expect(await stageChangesOf(harness, user, claire.id)).toEqual([]);
});

test('after a Success in “Replied…”, the Contact may join the Circle; without one, a Contact Prospecting does not', async () => {
  const { harness, user, claire } = await trialInProgress();
  const { contact: paul } = await addContact(harness, user, 'Paul', { status: 'prospecting' });

  const spontaneous = await postJson(
    harness.app,
    `/api/contacts/${paul.id}/record-reply`,
    { occurredOn: '2026-01-05', channel: 'email', status: 'ally' },
    user.cookie,
  );
  const { contact } = await recordReply(harness, user, claire.id, {
    occurredOn: '2026-01-05',
    channel: 'email',
    trialOutcome: 'success',
    status: 'ally',
  });

  expect(spontaneous.status).toBe(409);
  expect(contact).toMatchObject({ status: 'ally', trial: null });
});

test('the Stage of a reply is for a Contact Prospecting, or one brought in', async () => {
  const { harness, user, stages } = await atOutreach();
  const [, agency = ''] = stages;
  const { contact: anne } = await addContact(harness, user, 'Anne');
  const { contact: ally } = await changeStatus(harness, user, anne.id, { status: 'ally' });

  const response = await postJson(
    harness.app,
    `/api/contacts/${ally.id}/record-reply`,
    { occurredOn: '2026-01-05', channel: 'email', stageId: agency },
    user.cookie,
  );

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'not_prospecting' });
});

test('once an Assignment is revealed at the Stage it moved to, the change of Stage can no longer be taken back', async () => {
  const { harness, user, stages, claire } = await trialInProgress();
  const [, agency = ''] = stages;
  const { positioning: mail } = await createPositioning(harness, user, agency, { label: 'Mail' });
  const { positioning: call } = await createPositioning(harness, user, agency, { label: 'Appel' });
  await openBattle(harness, user, { stageId: agency, championId: mail.id, challengerId: call.id });
  const { undoToken } = await changeStage(harness, user, claire.id, {
    stageId: agency,
    trialOutcome: 'success',
  });

  await revealAssignment(harness, user, claire.id);
  const undoing = await undo(harness, user, undoToken);

  expect(undoing.status).toBe(409);
  expect(await undoing.json()).toEqual({ error: 'superseded' });
});
