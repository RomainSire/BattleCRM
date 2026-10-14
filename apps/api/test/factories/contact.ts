import { CONTACT_STATUSES, type AddableContactStatus } from '@battlecrm/contract';
import { z } from 'zod';

import type { testApp } from '../app.ts';
import { postJson } from '../http.ts';

type Harness = ReturnType<typeof testApp>;

/** A Contact as the working summary carries it. */
export const summaryContact = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  status: z.enum(CONTACT_STATUSES),
  /** The Stage it is at, Prospecting; otherwise the last one it reached, if any. */
  stageId: z.uuid().nullable(),
  lastInteractionAt: z.iso.datetime(),
  lastInteractionOn: z.iso.date(),
});

/** A Stage as the working summary carries it, in the order of the Funnel. */
export const summaryStage = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  aim: z.string().nullable(),
  archived: z.boolean(),
});

/** The rows of the summary a gesture changed. */
export const summaryChanges = z.strictObject({
  contacts: z.array(summaryContact),
  removedContactIds: z.array(z.uuid()),
});

export const gestureAnswer = z.strictObject({ changes: summaryChanges, undoToken: z.uuid() });

/**
 * A Contact added the way a User adds one, in the Pool unless said otherwise, and the token that
 * takes the gesture back.
 */
export async function addContact(
  harness: Harness,
  user: { cookie: string },
  name = 'Jean Dupont',
  { status, stageId }: { status?: AddableContactStatus; stageId?: string } = {},
) {
  const response = await postJson(
    harness.app,
    '/api/contacts',
    { name, status, stageId },
    user.cookie,
  );
  if (response.status !== 201) throw new Error(`addContact: the API answered ${response.status}`);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  const [contact] = changes.contacts;
  if (!contact) throw new Error('addContact: no Contact in the answer');
  return { contact, undoToken };
}
