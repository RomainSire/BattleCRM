import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { closeBattle, openBattle, openBattleRequest } from '../../test/factories/battle.ts';
import { summaryOf } from '../../test/factories/contact.ts';
import { undo, undone } from '../../test/factories/gesture.ts';
import {
  createPositioning,
  positioningGesture,
  stageIdsOf,
} from '../../test/factories/positioning.ts';
import { archiveStage } from '../../test/factories/stage.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';

/** A User, the first Stage of its Funnel, and two Positionings there. */
async function stageWithTwo() {
  const harness = testApp();
  const user = await makeUser(harness);
  const [outreach = '', screening = ''] = await stageIdsOf(harness, user);
  const { positioning: mailA } = await createPositioning(harness, user, outreach, {
    label: 'Mail A',
  });
  const { positioning: mailB } = await createPositioning(harness, user, outreach, {
    label: 'Mail B',
  });
  return { harness, user, outreach, screening, mailA, mailB };
}

test('the first Battle of a Stage: its initial Champion against a Challenger, its Success criterion, Target, threshold and Horizon; “Undo” leaves no trace', async () => {
  const { harness, user, outreach, mailA, mailB } = await stageWithTwo();

  const { battle, undoToken } = await openBattle(harness, user, {
    stageId: outreach,
    championId: mailA.id,
    challengerId: mailB.id,
    successCriterion: '  a demandé le CV  ',
    target: 'consultancy',
    threshold: 0.9,
    horizon: 30,
  });

  expect(battle).toEqual({
    id: battle.id,
    stageId: outreach,
    championId: mailA.id,
    challengerId: mailB.id,
    successCriterion: 'a demandé le CV',
    target: 'consultancy',
    threshold: 0.9,
    horizon: 30,
    openedOn: '2026-01-05',
    open: true,
    startedTrials: 0,
    finishedTrials: 0,
    trials: {
      champion: { successes: 0, noResults: 0, inProgress: 0 },
      challenger: { successes: 0, noResults: 0, inProgress: 0 },
    },
    closedOn: null,
    verdict: null,
    designated: false,
    takeaway: null,
  });
  expect((await summaryOf(harness, user)).battles).toEqual([battle]);

  const taken = await undo(harness, user, undoToken);
  expect(taken.status).toBe(200);
  expect(undone.parse(await taken.json()).changes.removedBattleIds).toEqual([battle.id]);
  expect((await summaryOf(harness, user)).battles).toEqual([]);
});

test('a Stage has at most one open Battle; two openings at once, one wins', async () => {
  const { harness, user, outreach, mailA, mailB } = await stageWithTwo();
  const { positioning: mailC } = await createPositioning(harness, user, outreach, {
    label: 'Mail C',
  });
  const opening = { stageId: outreach, championId: mailA.id, challengerId: mailB.id };

  const [first, second] = await Promise.all([
    openBattleRequest(harness, user, opening),
    openBattleRequest(harness, user, { ...opening, challengerId: mailC.id }),
  ]);
  const third = await openBattleRequest(harness, user, opening);

  expect([first.status, second.status].toSorted((a, b) => a - b)).toEqual([201, 409]);
  expect(third.status).toBe(409);
  expect(await third.json()).toEqual({ error: 'battle_open' });
  expect((await summaryOf(harness, user)).battles).toHaveLength(1);
});

test('the first Battle needs an initial Champion; the next ones keep the Champion of the Stage', async () => {
  const { harness, user, outreach, mailA, mailB } = await stageWithTwo();
  const { positioning: mailC } = await createPositioning(harness, user, outreach, {
    label: 'Mail C',
  });

  const without = await openBattleRequest(harness, user, {
    stageId: outreach,
    challengerId: mailB.id,
  });
  expect(without.status).toBe(400);
  expect(await without.json()).toEqual({ error: 'champion_required' });

  const { battle: first } = await openBattle(harness, user, {
    stageId: outreach,
    championId: mailA.id,
    challengerId: mailB.id,
  });
  await closeBattle(harness, user, first.id);
  const another = await openBattleRequest(harness, user, {
    stageId: outreach,
    championId: mailC.id,
    challengerId: mailB.id,
  });
  const { battle: next } = await openBattle(harness, user, {
    stageId: outreach,
    challengerId: mailC.id,
  });

  expect(another.status).toBe(409);
  expect(await another.json()).toEqual({ error: 'champion_set' });
  expect(next).toMatchObject({ championId: mailA.id, challengerId: mailC.id, open: true });
});

test('a Stage archived, another User’s or unknown is refused, and so is a Positioning of another Stage or the Champion against itself', async () => {
  const { harness, user, outreach, screening, mailA, mailB } = await stageWithTwo();
  const other = await makeUser(harness);
  const [othersStage = ''] = await stageIdsOf(harness, other);
  const { positioning: elsewhere } = await createPositioning(harness, user, screening);
  const opening = { championId: mailA.id, challengerId: mailB.id };

  await archiveStage(user, screening, harness.clock.now());
  for (const stageId of [screening, othersStage, '00000000-0000-7000-8000-000000000000']) {
    const refused = await openBattleRequest(harness, user, { ...opening, stageId });
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({ error: 'unknown_stage' });
  }
  const mixed = await openBattleRequest(harness, user, {
    stageId: outreach,
    championId: mailA.id,
    challengerId: elsewhere.id,
  });
  expect(mixed.status).toBe(400);
  expect(await mixed.json()).toEqual({ error: 'unknown_positioning' });
  const alone = await openBattleRequest(harness, user, {
    stageId: outreach,
    championId: mailA.id,
    challengerId: mailA.id,
  });
  expect(alone.status).toBe(400);
  for (const fields of [{ threshold: 0.7 }, { horizon: 9 }, { successCriterion: '  ' }]) {
    const invalid = await openBattleRequest(harness, user, {
      stageId: outreach,
      ...opening,
      ...fields,
    });
    expect(invalid.status).toBe(400);
  }
  expect((await summaryOf(harness, user)).battles).toEqual([]);
});

test('an archived Challenger comes back; “Undo” archives it again', async () => {
  const { harness, user, outreach, mailA, mailB } = await stageWithTwo();
  await positioningGesture(harness, user, `/api/positionings/${mailB.id}/archive`);

  const { changes, undoToken } = await openBattle(harness, user, {
    stageId: outreach,
    championId: mailA.id,
    challengerId: mailB.id,
  });
  expect(changes.positionings).toEqual([{ ...mailB, archived: false }]);

  const taken = undone.parse(await (await undo(harness, user, undoToken)).json());
  expect(taken.changes.positionings).toEqual([{ ...mailB, archived: true }]);
});

test('in the workshop, the Champion and a Positioning in an open Battle cannot be archived, and one that was in a Battle cannot be deleted', async () => {
  const { harness, user, outreach, mailA, mailB } = await stageWithTwo();
  const { positioning: mailC, undoToken: created } = await createPositioning(
    harness,
    user,
    outreach,
    { label: 'Mail C' },
  );
  const { battle } = await openBattle(harness, user, {
    stageId: outreach,
    championId: mailA.id,
    challengerId: mailC.id,
  });
  const refusalOf = async (path: string) => {
    const response = await postJson(harness.app, path, {}, user.cookie);
    return { status: response.status, body: await response.json() };
  };

  expect(await refusalOf(`/api/positionings/${mailA.id}/archive`)).toEqual({
    status: 409,
    body: { error: 'champion' },
  });
  expect(await refusalOf(`/api/positionings/${mailC.id}/archive`)).toEqual({
    status: 409,
    body: { error: 'in_open_battle' },
  });
  expect(await refusalOf(`/api/positionings/${mailC.id}/delete`)).toEqual({
    status: 409,
    body: { error: 'in_battle' },
  });
  expect(await refusalOf(`/api/gestures/${created}/undo`)).toEqual({
    status: 409,
    body: { error: 'superseded' },
  });

  // Once the Battle is closed, its Challenger may be archived, never deleted; the Champion keeps its title.
  await closeBattle(harness, user, battle.id);
  expect((await refusalOf(`/api/positionings/${mailC.id}/archive`)).status).toBe(200);
  expect(await refusalOf(`/api/positionings/${mailC.id}/delete`)).toEqual({
    status: 409,
    body: { error: 'in_battle' },
  });
  expect(await refusalOf(`/api/positionings/${mailA.id}/archive`)).toEqual({
    status: 409,
    body: { error: 'champion' },
  });
  expect((await refusalOf(`/api/positionings/${mailB.id}/archive`)).status).toBe(200);
});

test('“Undo” of an unarchiving is refused once the Positioning is in an open Battle', async () => {
  const { harness, user, outreach, mailA, mailB } = await stageWithTwo();
  await positioningGesture(harness, user, `/api/positionings/${mailB.id}/archive`);
  const { undoToken } = await positioningGesture(
    harness,
    user,
    `/api/positionings/${mailB.id}/unarchive`,
  );
  await openBattle(harness, user, {
    stageId: outreach,
    championId: mailA.id,
    challengerId: mailB.id,
  });

  const refused = await undo(harness, user, undoToken);

  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ error: 'superseded' });
  expect((await summaryOf(harness, user)).positionings).toContainEqual({
    ...mailB,
    archived: false,
  });
});
