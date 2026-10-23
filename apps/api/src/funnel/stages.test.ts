import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { openBattle } from '../../test/factories/battle.ts';
import { addContact, changeStage, changeStatus, summaryOf } from '../../test/factories/contact.ts';
import { undo, undone } from '../../test/factories/gesture.ts';
import { createPositioning, positioningGesture } from '../../test/factories/positioning.ts';
import { createStage, stageGesture, stagesIn } from '../../test/factories/stage.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

/** The names of the Stages of the User, in the order of the Funnel, archived ones marked. */
const funnelOf = async (harness: Harness, user: User) =>
  (await summaryOf(harness, user)).stages.map(({ name, archived }) =>
    archived ? `(${name})` : name,
  );

/** A User and its Funnel, the Standard stages. */
async function settings() {
  const harness = testApp();
  const user = await makeUser(harness);
  const stages = (await summaryOf(harness, user)).stages;
  const [outreach = '', agency = '', client = '', closing = ''] = stages.map(({ id }) => id);
  return { harness, user, outreach, agency, client, closing };
}

test('a Stage added at the end of the Funnel, with its Aim; “Undo” leaves no trace', async () => {
  const { harness, user } = await settings();

  const { stages, undoToken } = await createStage(harness, user, {
    name: '  Relance client ',
    aim: ' rappel ',
  });

  expect(stages.at(-1)).toEqual({
    id: stages.at(-1)?.id,
    name: 'Relance client',
    aim: 'rappel',
    archived: false,
    served: false,
  });
  expect(await funnelOf(harness, user)).toEqual([
    'Approche',
    'Qualif ESN',
    'Qualif Client',
    'Closing',
    'Relance client',
  ]);

  const taken = await undo(harness, user, undoToken);
  expect(taken.status).toBe(200);
  expect(stagesIn(undone.parse(await taken.json()).changes)).toHaveLength(4);
  expect(await funnelOf(harness, user)).toEqual([
    'Approche',
    'Qualif ESN',
    'Qualif Client',
    'Closing',
  ]);
});

test('a Stage inserted first, or right after another one', async () => {
  const { harness, user, agency } = await settings();

  await createStage(harness, user, { name: 'Veille', afterId: null });
  await createStage(harness, user, { name: 'Test technique', afterId: agency });

  expect(await funnelOf(harness, user)).toEqual([
    'Veille',
    'Approche',
    'Qualif ESN',
    'Test technique',
    'Qualif Client',
    'Closing',
  ]);
});

/** A gesture refused: its status and its code. */
async function refusedWith(harness: Harness, user: User, path: string, body: object = {}) {
  const response = await postJson(harness.app, path, body, user.cookie);
  return { status: response.status, body: await response.json() };
}

test('its name and its Aim, one at a time; “Undo” puts them back', async () => {
  const { harness, user, outreach } = await settings();

  const renamed = await stageGesture(harness, user, `/api/stages/${outreach}/edit`, {
    name: ' Premier contact ',
  });
  const aimed = await stageGesture(harness, user, `/api/stages/${outreach}/edit`, { aim: '  ' });

  expect(stagesIn(renamed.changes)[0]).toMatchObject({
    name: 'Premier contact',
    aim: 'CV à envoyer',
  });
  expect(stagesIn(aimed.changes)[0]).toMatchObject({ name: 'Premier contact', aim: null });
  expect((await undo(harness, user, aimed.undoToken)).status).toBe(200);
  expect((await summaryOf(harness, user)).stages[0]).toMatchObject({ aim: 'CV à envoyer' });
  expect(await refusedWith(harness, user, `/api/stages/${outreach}/edit`, {})).toEqual({
    status: 400,
    body: { error: 'invalid' },
  });
  expect(await refusedWith(harness, user, `/api/stages/${outreach}/edit`, { name: ' ' })).toEqual({
    status: 400,
    body: { error: 'invalid' },
  });
});

test('reordered, no Contact moves and the history keeps the order of then; “Undo” puts it back', async () => {
  const { harness, user, outreach, agency, client } = await settings();
  const { contact } = await addContact(harness, user, 'Paul', {
    status: 'prospecting',
    stageId: outreach,
  });
  await changeStage(harness, user, contact.id, { stageId: agency });

  const { undoToken } = await stageGesture(harness, user, `/api/stages/${outreach}/move`, {
    afterId: client,
  });

  expect(await funnelOf(harness, user)).toEqual([
    'Qualif ESN',
    'Qualif Client',
    'Approche',
    'Closing',
  ]);
  const record = await harness.app.request(`/api/contacts/${contact.id}/record`, {
    headers: { Cookie: user.cookie },
  });
  const [change] = z
    .object({ thread: z.array(z.object({ stageChange: z.unknown() })) })
    .parse(await record.json()).thread;
  expect(change?.stageChange).toEqual({ fromStageId: outreach, toStageId: agency, forward: true });
  expect((await summaryOf(harness, user)).contacts[0]?.stageId).toBe(agency);

  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect(await funnelOf(harness, user)).toEqual([
    'Approche',
    'Qualif ESN',
    'Qualif Client',
    'Closing',
  ]);
});

test('moved first, or after itself or a Stage out of the Funnel: refused', async () => {
  const { harness, user, outreach, closing } = await settings();

  await stageGesture(harness, user, `/api/stages/${closing}/move`, { afterId: null });

  expect(await funnelOf(harness, user)).toEqual([
    'Closing',
    'Approche',
    'Qualif ESN',
    'Qualif Client',
  ]);
  expect(
    await refusedWith(harness, user, `/api/stages/${outreach}/move`, { afterId: outreach }),
  ).toEqual({ status: 400, body: { error: 'unknown_stage' } });
});

test('archived once it served: out of the Funnel, its Positionings stay; “Undo” brings it back at its place', async () => {
  const { harness, user, agency } = await settings();
  await createPositioning(harness, user, agency);

  const { changes, undoToken } = await stageGesture(harness, user, `/api/stages/${agency}/archive`);

  expect(stagesIn(changes).find(({ id }) => id === agency)).toMatchObject({
    archived: true,
    served: true,
  });
  expect(await funnelOf(harness, user)).toEqual([
    'Approche',
    '(Qualif ESN)',
    'Qualif Client',
    'Closing',
  ]);
  expect((await summaryOf(harness, user)).positionings).toHaveLength(1);
  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect(await funnelOf(harness, user)).toEqual([
    'Approche',
    'Qualif ESN',
    'Qualif Client',
    'Closing',
  ]);
});

test('archiving is refused while a Contact Prospecting is at the Stage, or its Battle is open, or it is the last one', async () => {
  const { harness, user, outreach, agency, client, closing } = await settings();
  const { contact } = await addContact(harness, user, 'Paul', {
    status: 'prospecting',
    stageId: outreach,
  });
  const { positioning: mail } = await createPositioning(harness, user, agency);
  const { positioning: call } = await createPositioning(harness, user, agency, {
    label: 'Appel',
    channel: 'phone',
  });
  await openBattle(harness, user, { stageId: agency, championId: mail.id, challengerId: call.id });

  expect(await refusedWith(harness, user, `/api/stages/${outreach}/archive`)).toEqual({
    status: 409,
    body: { error: 'has_contacts' },
  });
  expect(await refusedWith(harness, user, `/api/stages/${agency}/archive`)).toEqual({
    status: 409,
    body: { error: 'battle_open' },
  });

  // Out of Prospecting, the Contact keeps it as the last Stage it reached.
  await changeStatus(harness, user, contact.id, { status: 'pool' });
  await stageGesture(harness, user, `/api/stages/${outreach}/archive`);
  await stageGesture(harness, user, `/api/stages/${client}/archive`);
  await stageGesture(harness, user, `/api/stages/${closing}/delete`);
  expect((await summaryOf(harness, user)).contacts[0]?.stageId).toBe(outreach);
  expect(await funnelOf(harness, user)).toEqual(['(Approche)', 'Qualif ESN', '(Qualif Client)']);
});

test('the last Stage of the Funnel is neither archived nor deleted', async () => {
  const { harness, user, outreach, agency, client, closing } = await settings();
  for (const stageId of [outreach, agency, client]) {
    await stageGesture(harness, user, `/api/stages/${stageId}/delete`);
  }

  expect(await refusedWith(harness, user, `/api/stages/${closing}/archive`)).toEqual({
    status: 409,
    body: { error: 'last_stage' },
  });
  expect(await refusedWith(harness, user, `/api/stages/${closing}/delete`)).toEqual({
    status: 409,
    body: { error: 'last_stage' },
  });
});

test('restored right after the Stage that preceded it, or at the end once that one left; “Undo” archives it again', async () => {
  const { harness, user, agency, client } = await settings();
  await createPositioning(harness, user, agency);
  await createPositioning(harness, user, client);
  await stageGesture(harness, user, `/api/stages/${client}/archive`);
  await stageGesture(harness, user, `/api/stages/${agency}/archive`);

  // Qualif Client followed Qualif ESN, archived: at the end. Qualif ESN followed Approche, still there.
  const { undoToken } = await stageGesture(harness, user, `/api/stages/${client}/restore`);
  await stageGesture(harness, user, `/api/stages/${agency}/restore`);

  const names = (await summaryOf(harness, user)).stages
    .filter(({ archived }) => !archived)
    .map(({ name }) => name);
  expect(names).toEqual(['Approche', 'Qualif ESN', 'Closing', 'Qualif Client']);
  expect(await refusedWith(harness, user, `/api/stages/${agency}/restore`)).toEqual({
    status: 409,
    body: { error: 'not_archived' },
  });
  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect((await summaryOf(harness, user)).stages.find(({ id }) => id === client)?.archived).toBe(
    true,
  );
});

test('deleted when it never served, without a trace; “Undo” brings it back at its place', async () => {
  const { harness, user, agency } = await settings();

  const { changes, undoToken } = await stageGesture(harness, user, `/api/stages/${agency}/delete`);

  expect(stagesIn(changes).map(({ name }) => name)).toEqual([
    'Approche',
    'Qualif Client',
    'Closing',
  ]);
  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect(await funnelOf(harness, user)).toEqual([
    'Approche',
    'Qualif ESN',
    'Qualif Client',
    'Closing',
  ]);
});

test('a Stage that served is never deleted: a Contact passed there, or it bears a Positioning', async () => {
  const { harness, user, outreach, agency, client } = await settings();
  const { contact } = await addContact(harness, user, 'Paul', {
    status: 'prospecting',
    stageId: outreach,
  });
  await changeStage(harness, user, contact.id, { stageId: agency });
  await changeStage(harness, user, contact.id, { stageId: client });
  await createPositioning(harness, user, client);
  const { stages } = await summaryOf(harness, user);

  expect(stages.map(({ served }) => served)).toEqual([true, true, true, false]);
  for (const stageId of [outreach, agency]) {
    expect(await refusedWith(harness, user, `/api/stages/${stageId}/delete`)).toEqual({
      status: 409,
      body: { error: 'served' },
    });
  }
});

test('“Undo” of an added Stage is refused once a Contact entered it', async () => {
  const { harness, user } = await settings();
  const { stages, undoToken } = await createStage(harness, user);
  await addContact(harness, user, 'Paul', {
    status: 'prospecting',
    stageId: stages.at(-1)?.id ?? '',
  });

  expect(await (await undo(harness, user, undoToken)).json()).toEqual({
    error: 'superseded',
  });
});

test('another User’s Stage, or an unknown one, is not found', async () => {
  const { harness, user } = await settings();
  const other = await settings();

  expect(await refusedWith(harness, user, `/api/stages/${other.outreach}/archive`)).toEqual({
    status: 404,
    body: { error: 'not_found' },
  });
});

test('“Undo” of a deleted Positioning is refused once its Stage, which it alone made serve, was deleted', async () => {
  const { harness, user } = await settings();
  const { stages } = await createStage(harness, user);
  const stageId = stages.at(-1)?.id ?? '';
  const { positioning } = await createPositioning(harness, user, stageId);
  const { undoToken } = await positioningGesture(
    harness,
    user,
    `/api/positionings/${positioning.id}/delete`,
  );

  await stageGesture(harness, user, `/api/stages/${stageId}/delete`);

  expect(await (await undo(harness, user, undoToken)).json()).toEqual({
    error: 'superseded',
  });
});
