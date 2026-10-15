import type { Channel } from '@battlecrm/contract';
import { z } from 'zod';

import type { testApp } from '../app.ts';
import { postJson } from '../http.ts';
import { gestureAnswer } from './contact.ts';

type Harness = ReturnType<typeof testApp>;

/** What the workshop sends for a Positioning (spec UX §6.10). */
export type PositioningFields = {
  label: string;
  channel: Channel;
  content?: string;
  followUps: { days: number; message?: string }[];
  responseWindowDays: number;
};

/** A short e-mail, followed up on the Default follow-up cadence, the first rank with a message. */
export const SHORT_EMAIL: PositioningFields = {
  label: 'Mail court',
  channel: 'email',
  content: 'Bonjour {prénom}, freelance Node/React, dispo en novembre. 15 min cette semaine ?',
  followUps: [{ days: 3, message: 'Petit up sur mon message.' }, { days: 7 }, { days: 14 }],
  responseWindowDays: 14,
};

/** A gesture of the workshop, made the way a User makes it, its answer and the token that takes it back. */
export async function positioningGesture(
  harness: Harness,
  user: { cookie: string },
  path: string,
  body: object = {},
  status = 200,
) {
  const response = await postJson(harness.app, path, body, user.cookie);
  if (response.status !== status) throw new Error(`${path}: the API answered ${response.status}`);
  return gestureAnswer.parse(await response.json());
}

/** A Positioning created at a Stage, or a modified copy of one, and the token that takes it back. */
export async function createPositioning(
  harness: Harness,
  user: { cookie: string },
  stageId: string,
  fields: Partial<PositioningFields> & { derivedFromId?: string } = {},
) {
  const { changes, undoToken } = await positioningGesture(
    harness,
    user,
    '/api/positionings',
    { ...SHORT_EMAIL, ...fields, stageId },
    201,
  );
  const [positioning] = changes.positionings;
  if (!positioning) throw new Error('createPositioning: no Positioning in the answer');
  return { positioning, undoToken };
}

/** The Stages of the User, in the order of the Funnel, as the summary carries them. */
export async function stageIdsOf(harness: Harness, user: { cookie: string }) {
  const response = await harness.app.request('/api/summary', { headers: { Cookie: user.cookie } });
  return z
    .object({ stages: z.array(z.object({ id: z.uuid() })) })
    .parse(await response.json())
    .stages.map(({ id }) => id);
}

/** A Positioning created at the first Stage of the User. */
export async function positioningOf(harness: Harness, user: { cookie: string }) {
  const [stageId] = await stageIdsOf(harness, user);
  if (stageId === undefined) throw new Error('positioningOf: the User has no Stage');
  return createPositioning(harness, user, stageId);
}
