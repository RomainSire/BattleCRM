import {
  CONTACT_STATUSES,
  ORGANIZATION_TYPES,
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

/** A Contact as the working summary carries it. */
export const summaryContact = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  status: z.enum(CONTACT_STATUSES),
  /** The Stage it is at, Prospecting; otherwise the last one it reached, if any. */
  stageId: z.uuid().nullable(),
  organizationId: z.uuid().nullable(),
  /** What the search and the duplicate checks read; the note stays out of the summary. */
  jobTitle: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  lastInteractionAt: z.iso.datetime(),
  lastInteractionOn: z.iso.date(),
  /** The local day of its latest Interaction done, outbound or inbound, if it has one. */
  lastDoneInteractionOn: z.iso.date().nullable(),
  /** The local days of its Funnel entries, the earliest first. */
  funnelEntryDays: z.array(z.iso.date()),
  /** The reason of the change that put it in its Status, if the User gave one. */
  statusReason: z.string().nullable(),
  /** Its scheduled Follow-up, if it has one. */
  followUp: z.strictObject({ dueOn: z.iso.date(), note: z.string().nullable() }).nullable(),
  /** The local days of its Prospecting actions, the earliest first: what the Activity is counted from. */
  prospectingActionDays: z.array(z.iso.date()),
});

/** A Stage as the working summary carries it, in the order of the Funnel. */
export const summaryStage = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  aim: z.string().nullable(),
  archived: z.boolean(),
});

/** An Organization as the working summary carries it. */
export const summaryOrganization = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  type: z.enum(ORGANIZATION_TYPES),
});

/** The rows of the summary a gesture changed. */
export const summaryChanges = z.strictObject({
  contacts: z.array(summaryContact),
  removedContactIds: z.array(z.uuid()),
  organizations: z.array(summaryOrganization),
  removedOrganizationIds: z.array(z.uuid()),
});

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

/** A value in effect now, and as the User chose it last. */
const dated = <Value extends z.ZodType>(value: Value) =>
  z.strictObject({ inEffect: value, chosen: value });

/** Settings, as the summary carries them (spec UX §5.8). */
const summarySettings = z.strictObject({
  locale: z.enum(['fr', 'en']),
  timeZone: dated(z.string()),
  activityGoal: dated(z.int().nullable()),
  entryGoal: dated(z.int().nullable()),
  celebrateGoal: z.boolean(),
  singleKeyShortcuts: z.boolean(),
  checkInRhythmDays: z.int(),
  circleSizeGoal: z.int().nullable(),
  defaultCadence: z.strictObject({ intervals: z.array(z.int()), responseWindowDays: z.int() }),
});

/** The whole working summary, as `GET /api/summary` answers it. */
export const summary = z.strictObject({
  /** The time zone of the User in effect now: what its today is read in. */
  timeZone: z.string(),
  settings: summarySettings,
  contacts: z.array(summaryContact),
  stages: z.array(summaryStage),
  organizations: z.array(summaryOrganization),
});

export async function summaryOf(harness: Harness, user: { cookie: string }) {
  const response = await harness.app.request('/api/summary', { headers: { Cookie: user.cookie } });
  if (response.status !== 200) throw new Error(`summaryOf: the API answered ${response.status}`);
  return summary.parse(await response.json());
}
