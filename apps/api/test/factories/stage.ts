import type { SummaryStage } from '@battlecrm/contract';
import { eq } from 'drizzle-orm';

import { withUser } from '../../src/db/index.ts';
import { stage } from '../../src/funnel/index.ts';
import type { testApp } from '../app.ts';
import { postJson } from '../http.ts';
import { gestureAnswer } from './contact.ts';

type Harness = ReturnType<typeof testApp>;

/**
 * An archived Stage, written straight into the table of `funnel`: a state a User reaches by the
 * gesture (`/api/stages/:id/archive`), here without its preconditions.
 */
export const archiveStage = (user: { userId: string }, stageId: string, now: Date) =>
  withUser(user.userId, (tx) =>
    tx.update(stage).set({ archivedAt: now }).where(eq(stage.id, stageId)),
  );

/** A gesture of Settings on the Funnel (spec UX §5.8), made the way a User makes it: its answer and its token. */
export async function stageGesture(
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

/** The Funnel as a gesture answered it: every Stage, in its order. */
export function stagesIn({ stages }: { stages: SummaryStage[] | null }) {
  if (stages === null) throw new Error('stagesIn: the answer carries no Stage');
  return stages;
}

/** “+ Add a Stage”: at the end of the Funnel, or right after a Stage (`null`: first). */
export async function createStage(
  harness: Harness,
  user: { cookie: string },
  fields: { name?: string; aim?: string; afterId?: string | null } = {},
) {
  const { changes, undoToken } = await stageGesture(
    harness,
    user,
    '/api/stages',
    { name: 'Relance client', ...fields },
    201,
  );
  return { stages: stagesIn(changes), undoToken };
}
