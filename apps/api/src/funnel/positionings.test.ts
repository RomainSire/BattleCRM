import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { summaryChanges, summaryPositioning } from '../../test/factories/contact.ts';
import {
  createPositioning,
  SHORT_EMAIL,
  positioningGesture,
  stageIdsOf,
} from '../../test/factories/positioning.ts';
import { archiveStage } from '../../test/factories/stage.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const positioningsOf = async (harness: Harness, user: User) => {
  const response = await harness.app.request('/api/summary', { headers: { Cookie: user.cookie } });
  return z.object({ positionings: z.array(summaryPositioning) }).parse(await response.json())
    .positionings;
};

const undo = async (harness: Harness, user: User, undoToken: string) => {
  const response = await postJson(harness.app, `/api/gestures/${undoToken}/undo`, {}, user.cookie);
  return { status: response.status, body: await response.json() };
};

const undone = z.object({ changes: summaryChanges });

/** A User, the first Stage of its Funnel and the second. */
async function workshop() {
  const harness = testApp();
  const user = await makeUser(harness);
  const [outreach = '', screening = ''] = await stageIdsOf(harness, user);
  return { harness, user, outreach, screening };
}

test('a new Positioning: its Stage, label, Channel, content and cadence, a message on some ranks; “Undo” leaves no trace', async () => {
  const { harness, user, outreach } = await workshop();

  const { positioning, undoToken } = await createPositioning(harness, user, outreach, {
    content: '  Bonjour {prénom}  ',
    followUps: [
      { days: 3, message: ' Petit up ' },
      { days: 7, message: '  ' },
    ],
  });

  expect(positioning).toEqual({
    id: positioning.id,
    stageId: outreach,
    label: 'Mail court',
    channel: 'email',
    content: 'Bonjour {prénom}',
    followUps: [
      { days: 3, message: 'Petit up' },
      { days: 7, message: null },
    ],
    responseWindowDays: 14,
    derivedFromId: null,
    archived: false,
    attachments: [],
    used: false,
    trialCount: 0,
  });
  expect(await positioningsOf(harness, user)).toEqual([positioning]);

  const taken = await undo(harness, user, undoToken);
  expect(taken.status).toBe(200);
  expect(undone.parse(taken.body).changes.removedPositioningIds).toEqual([positioning.id]);
  expect(await positioningsOf(harness, user)).toEqual([]);
});

test('a Positioning may have no Follow-up, and no content', async () => {
  const { harness, user, outreach } = await workshop();

  const { positioning } = await createPositioning(harness, user, outreach, {
    channel: 'phone',
    content: '',
    followUps: [],
  });

  expect(positioning).toMatchObject({ channel: 'phone', content: null, followUps: [] });
});

test('a modified copy names its original and stays at its Stage', async () => {
  const { harness, user, outreach, screening } = await workshop();
  const { positioning: original } = await createPositioning(harness, user, outreach);

  const { positioning: copy } = await createPositioning(harness, user, outreach, {
    label: 'Mail chiffré',
    derivedFromId: original.id,
  });
  const elsewhere = await postJson(
    harness.app,
    '/api/positionings',
    { ...SHORT_EMAIL, stageId: screening, derivedFromId: original.id },
    user.cookie,
  );

  expect(copy).toMatchObject({ label: 'Mail chiffré', derivedFromId: original.id });
  expect(elsewhere.status).toBe(400);
  expect(await elsewhere.json()).toEqual({ error: 'unknown_positioning' });
});

test('“Undo” of a creation is refused once a copy was made of it', async () => {
  const { harness, user, outreach } = await workshop();
  const { positioning, undoToken } = await createPositioning(harness, user, outreach);
  await createPositioning(harness, user, outreach, { derivedFromId: positioning.id });

  const refused = await undo(harness, user, undoToken);

  expect(refused).toEqual({ status: 409, body: { error: 'superseded' } });
  expect(await positioningsOf(harness, user)).toHaveLength(2);
});

test('a Stage archived, another User’s or unknown is refused', async () => {
  const { harness, user, outreach } = await workshop();
  const other = await makeUser(harness);
  const [othersStage] = await stageIdsOf(harness, other);
  await archiveStage(user, outreach, harness.clock.now());

  for (const stageId of [outreach, othersStage, '00000000-0000-7000-8000-000000000000']) {
    const response = await postJson(
      harness.app,
      '/api/positionings',
      { ...SHORT_EMAIL, stageId },
      user.cookie,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'unknown_stage' });
  }
});

test.each([
  { label: ' ' },
  { channel: 'fax' },
  { followUps: [{ days: 0 }] },
  { followUps: Array.from({ length: 11 }, () => ({ days: 3 })) },
  { responseWindowDays: 0 },
])('a Positioning that is none is refused: %j', async (fields) => {
  const { harness, user, outreach } = await workshop();

  const response = await postJson(
    harness.app,
    '/api/positionings',
    { ...SHORT_EMAIL, ...fields, stageId: outreach },
    user.cookie,
  );

  expect(response.status).toBe(400);
});

test('Edit replaces everything but its Stage and its Channel; “Undo” brings it back as it was', async () => {
  const { harness, user, outreach } = await workshop();
  const { positioning: before } = await createPositioning(harness, user, outreach);

  // Another Channel is another Positioning: a Channel sent along is not read.
  const { changes, undoToken } = await positioningGesture(
    harness,
    user,
    `/api/positionings/${before.id}/edit`,
    {
      label: 'Message LinkedIn',
      channel: 'linkedin',
      content: 'Salut {prénom}',
      followUps: [{ days: 2 }],
      responseWindowDays: 10,
    },
  );

  expect(changes.positionings).toEqual([
    {
      ...before,
      label: 'Message LinkedIn',
      content: 'Salut {prénom}',
      followUps: [{ days: 2, message: null }],
      responseWindowDays: 10,
    },
  ]);
  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect(await positioningsOf(harness, user)).toEqual([before]);
});

test('“Undo” is refused once a later gesture touched the same Positioning', async () => {
  const { harness, user, outreach } = await workshop();
  const { positioning, undoToken } = await createPositioning(harness, user, outreach);
  harness.clock.advance('PT1M');
  await positioningGesture(harness, user, `/api/positionings/${positioning.id}/relabel`, {
    label: 'Mail court v2',
  });

  expect(await undo(harness, user, undoToken)).toEqual({
    status: 409,
    body: { error: 'superseded' },
  });
});

test('Fix the label changes the label alone; “Undo” brings the old one back', async () => {
  const { harness, user, outreach } = await workshop();
  const { positioning } = await createPositioning(harness, user, outreach, { label: 'Mial court' });

  const { changes, undoToken } = await positioningGesture(
    harness,
    user,
    `/api/positionings/${positioning.id}/relabel`,
    { label: ' Mail court ' },
  );

  expect(changes.positionings).toEqual([{ ...positioning, label: 'Mail court' }]);
  await undo(harness, user, undoToken);
  expect(await positioningsOf(harness, user)).toEqual([positioning]);
});

test('Archive, then Unarchive, each once, each with “Undo”', async () => {
  const { harness, user, outreach } = await workshop();
  const { positioning } = await createPositioning(harness, user, outreach);
  const archive = `/api/positionings/${positioning.id}/archive`;
  const unarchive = `/api/positionings/${positioning.id}/unarchive`;

  const notArchived = await postJson(harness.app, unarchive, {}, user.cookie);
  const archived = await positioningGesture(harness, user, archive);
  const again = await postJson(harness.app, archive, {}, user.cookie);

  expect(await notArchived.json()).toEqual({ error: 'not_archived' });
  expect(notArchived.status).toBe(409);
  expect(archived.changes.positionings).toEqual([{ ...positioning, archived: true }]);
  expect(again.status).toBe(409);
  expect(await again.json()).toEqual({ error: 'archived' });

  await undo(harness, user, archived.undoToken);
  expect(await positioningsOf(harness, user)).toEqual([positioning]);

  harness.clock.advance('PT1M');
  await positioningGesture(harness, user, archive);
  const unarchived = await positioningGesture(harness, user, unarchive);
  expect(unarchived.changes.positionings).toEqual([positioning]);
  await undo(harness, user, unarchived.undoToken);
  expect(await positioningsOf(harness, user)).toEqual([{ ...positioning, archived: true }]);
});

test('Delete one never used: its copies lose their original; “Undo” brings both back', async () => {
  const { harness, user, outreach } = await workshop();
  const { positioning: original } = await createPositioning(harness, user, outreach);
  const { positioning: copy } = await createPositioning(harness, user, outreach, {
    label: 'Mail chiffré',
    derivedFromId: original.id,
  });
  harness.clock.advance('PT1M');

  const { changes, undoToken } = await positioningGesture(
    harness,
    user,
    `/api/positionings/${original.id}/delete`,
  );

  expect(changes.removedPositioningIds).toEqual([original.id]);
  expect(changes.positionings).toEqual([{ ...copy, derivedFromId: null }]);
  expect(await positioningsOf(harness, user)).toEqual([{ ...copy, derivedFromId: null }]);

  const taken = await undo(harness, user, undoToken);
  expect(taken.status).toBe(200);
  expect(undone.parse(taken.body).changes.positionings).toEqual([original, copy]);
  expect(await positioningsOf(harness, user)).toEqual([original, copy]);
});

test('“Undo” of a deletion is refused once its own original was deleted too', async () => {
  const { harness, user, outreach } = await workshop();
  const { positioning: original } = await createPositioning(harness, user, outreach);
  const { positioning: copy } = await createPositioning(harness, user, outreach, {
    derivedFromId: original.id,
  });
  const { undoToken } = await positioningGesture(
    harness,
    user,
    `/api/positionings/${copy.id}/delete`,
  );
  await positioningGesture(harness, user, `/api/positionings/${original.id}/delete`);

  expect(await undo(harness, user, undoToken)).toEqual({
    status: 409,
    body: { error: 'superseded' },
  });
});

test.each(['edit', 'relabel', 'archive', 'unarchive', 'delete'])(
  'an unknown Positioning answers 404 on %s',
  async (gesture) => {
    const { harness, user } = await workshop();

    for (const id of ['00000000-0000-7000-8000-000000000000', 'not-an-id']) {
      const response = await postJson(
        harness.app,
        `/api/positionings/${id}/${gesture}`,
        SHORT_EMAIL,
        user.cookie,
      );

      expect(response.status).toBe(404);
    }
  },
);
