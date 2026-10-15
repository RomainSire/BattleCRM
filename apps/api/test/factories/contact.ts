import {
  summary,
  summaryChanges,
  type AddableContactStatus,
  type Channel,
  type ContactStatus,
  type NotedInteractionKind,
  type OrganizationType,
} from '@battlecrm/contract';
import { z } from 'zod';

import type { testApp } from '../app.ts';
import { postJson } from '../http.ts';

type Harness = ReturnType<typeof testApp>;

/** What an undoable gesture answers: the rows of the summary it changed, and its token. */
export const gestureAnswer = z.strictObject({ changes: summaryChanges, undoToken: z.uuid() });

/**
 * A Contact added the way a User adds one, in the Pool unless said otherwise, and the token that
 * takes the gesture back; with the Organization it created, if it did.
 */
export async function addContact(
  harness: Harness,
  user: { cookie: string },
  name = 'Jean Dupont',
  fields: Partial<{
    status: AddableContactStatus;
    stageId: string;
    organizationId: string;
    newOrganization: { name: string; type: OrganizationType };
    linkedinUrl: string;
    jobTitle: string;
    email: string;
    phone: string;
    note: string;
  }> = {},
) {
  const response = await postJson(harness.app, '/api/contacts', { name, ...fields }, user.cookie);
  if (response.status !== 201) throw new Error(`addContact: the API answered ${response.status}`);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  const [contact] = changes.contacts;
  if (!contact) throw new Error('addContact: no Contact in the answer');
  return { contact, organization: changes.organizations[0], undoToken };
}

/**
 * The Coordinates of a Contact edited the way a User edits them, and the token that takes the gesture
 * back; with the Organization it created, if it did.
 */
export async function editContact(
  harness: Harness,
  user: { cookie: string },
  contactId: string,
  fields: Record<string, unknown>,
) {
  const response = await postJson(
    harness.app,
    `/api/contacts/${contactId}/edit`,
    fields,
    user.cookie,
  );
  if (response.status !== 200) throw new Error(`editContact: the API answered ${response.status}`);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  const [contact] = changes.contacts;
  if (!contact) throw new Error('editContact: no Contact in the answer');
  return { contact, organization: changes.organizations[0], undoToken };
}

/**
 * The Status of a Contact changed the way a User changes it, and the token that takes the gesture
 * back.
 */
export async function changeStatus(
  harness: Harness,
  user: { cookie: string },
  contactId: string,
  body: { status: ContactStatus; stageId?: string; reason?: string },
) {
  const response = await postJson(
    harness.app,
    `/api/contacts/${contactId}/change-status`,
    body,
    user.cookie,
  );
  if (response.status !== 200) throw new Error(`changeStatus: the API answered ${response.status}`);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  const [contact] = changes.contacts;
  if (!contact) throw new Error('changeStatus: no Contact in the answer');
  return { contact, undoToken };
}

/** A gesture on one Contact, made the way a User makes it, and the token that takes it back. */
async function contactGesture(
  harness: Harness,
  user: { cookie: string },
  path: string,
  body: object,
) {
  const response = await postJson(harness.app, path, body, user.cookie);
  if (response.status !== 200) throw new Error(`${path}: the API answered ${response.status}`);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  const [contact] = changes.contacts;
  if (!contact) throw new Error(`${path}: no Contact in the answer`);
  return { contact, undoToken };
}

/** A Follow-up scheduled, or modified, for a local day. */
export const scheduleFollowUp = (
  harness: Harness,
  user: { cookie: string },
  contactId: string,
  body: { dueOn: string; note?: string },
) => contactGesture(harness, user, `/api/contacts/${contactId}/schedule-follow-up`, body);

/** The scheduled Follow-up of a Contact, canceled. */
export const cancelFollowUp = (harness: Harness, user: { cookie: string }, contactId: string) =>
  contactGesture(harness, user, `/api/contacts/${contactId}/cancel-follow-up`, {});

/** “Follow up…”: the scheduled Follow-up of a Contact, done on a local day. */
export const followUp = (
  harness: Harness,
  user: { cookie: string },
  contactId: string,
  body: { occurredOn: string; note?: string },
) => contactGesture(harness, user, `/api/contacts/${contactId}/follow-up`, body);

/** “Note an Interaction”: an outbound Interaction off any Positioning, on a local day. */
export const noteInteraction = (
  harness: Harness,
  user: { cookie: string },
  contactId: string,
  body: { kind: NotedInteractionKind; occurredOn: string; note?: string },
) => contactGesture(harness, user, `/api/contacts/${contactId}/note-interaction`, body);

/** “Replied…”: a reply of the Contact, on a local day, and what comes next. */
export const recordReply = (
  harness: Harness,
  user: { cookie: string },
  contactId: string,
  body: {
    occurredOn: string;
    channel: Channel;
    note?: string;
    cancelFollowUp?: boolean;
    status?: 'prospecting' | 'ally';
    stageId?: string;
  },
) => contactGesture(harness, user, `/api/contacts/${contactId}/record-reply`, body);

/** The whole working summary of a User, checked against the contract. */
export async function summaryOf(harness: Harness, user: { cookie: string }) {
  const response = await harness.app.request('/api/summary', { headers: { Cookie: user.cookie } });
  if (response.status !== 200) throw new Error(`summaryOf: the API answered ${response.status}`);
  return summary.parse(await response.json());
}
