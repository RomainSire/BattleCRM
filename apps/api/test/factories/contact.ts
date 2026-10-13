import { CONTACT_STATUSES } from '@battlecrm/contract';
import { z } from 'zod';

import type { testApp } from '../app.ts';
import { postJson } from '../http.ts';

type Harness = ReturnType<typeof testApp>;

/** A Contact as the working summary carries it. */
export const summaryContact = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  status: z.enum(CONTACT_STATUSES),
  lastInteractionAt: z.iso.datetime(),
  lastInteractionOn: z.iso.date(),
});

/** The rows of the summary a gesture changed. */
export const summaryChanges = z.strictObject({
  contacts: z.array(summaryContact),
  removedContactIds: z.array(z.uuid()),
});

export const gestureAnswer = z.strictObject({ changes: summaryChanges, undoToken: z.uuid() });

/** A Contact in the Pool, added the way a User adds one, and the token that takes the gesture back. */
export async function addContact(harness: Harness, user: { cookie: string }, name = 'Jean Dupont') {
  const response = await postJson(harness.app, '/api/contacts', { name }, user.cookie);
  if (response.status !== 201) throw new Error(`addContact: the API answered ${response.status}`);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  const [contact] = changes.contacts;
  if (!contact) throw new Error('addContact: no Contact in the answer');
  return { contact, undoToken };
}
