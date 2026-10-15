import {
  ADDABLE_CONTACT_STATUSES,
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_JOB_TITLE_MAX_LENGTH,
  CONTACT_LINKEDIN_URL_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_NOTE_MAX_LENGTH,
  CONTACT_PHONE_MAX_LENGTH,
  CHANNELS,
  CONTACT_STATUSES,
  FOLLOW_UP_NOTE_MAX_LENGTH,
  INTERACTION_NOTE_MAX_LENGTH,
  NOTED_INTERACTION_KINDS,
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_TYPES,
  STATUS_REASON_MAX_LENGTH,
} from '@battlecrm/contract';
import {
  canNoteInteraction,
  daysBetween,
  hasFollowUps,
  isInFunnel,
  isPoolOrArchived,
  normalizeLinkedInUrl,
  stageToEnter,
  statusChangeCancelsFollowUp,
} from '@battlecrm/domain';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { RequireUser } from '../auth/index.ts';
import type { Clock } from '../clock.ts';
import { violates, withUser, type Transaction } from '../db/index.ts';
import { stageOrder } from '../funnel/index.ts';
import {
  lockContact,
  recordGesture,
  type ChangesOf,
  type Inverse,
  type Inverses,
} from '../gestures/index.ts';
import { jsonBody } from '../json-body.ts';
import {
  createOrganization,
  deleteOrganization,
  isOrganizationOf,
  type OrganizationMembers,
} from '../organizations/index.ts';
import { localDateOf } from '../settings/index.ts';
import { contact, followUp, interaction, statusChange } from './tables.ts';

// Read by `views`, which never writes them.
export {
  contact,
  followUp,
  interaction,
  PROSPECTING_ACTION_KINDS,
  statusChange,
} from './tables.ts';

/** An optional field of the Contact, trimmed: blank, it has no value. */
const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((text) => text || undefined)
    .optional();

/** Kept as `packages/domain` normalizes it, which the unique index compares (ST-30). */
const linkedinUrl = z
  .string()
  .trim()
  .max(CONTACT_LINKEDIN_URL_MAX_LENGTH)
  .transform((url, context) => {
    if (url === '') return undefined;
    const normalized = normalizeLinkedInUrl(url);
    if (normalized === null) {
      context.addIssue({ code: 'custom', message: 'not a LinkedIn address' });
      return z.NEVER;
    }
    return normalized;
  })
  .optional();

/**
 * The Coordinates of a Contact, as the quick add and the edit take them (spec UX §6.8, §6.12): only
 * the name is required. At most one Organization: one of the User's, or a new one with its type.
 */
const coordinates = z.object({
  name: z.string().trim().min(1).max(CONTACT_NAME_MAX_LENGTH),
  organizationId: z.uuid().optional(),
  newOrganization: z
    .object({
      name: z.string().trim().min(1).max(ORGANIZATION_NAME_MAX_LENGTH),
      type: z.enum(ORGANIZATION_TYPES),
    })
    .optional(),
  linkedinUrl,
  jobTitle: optionalText(CONTACT_JOB_TITLE_MAX_LENGTH),
  email: optionalText(CONTACT_EMAIL_MAX_LENGTH),
  phone: optionalText(CONTACT_PHONE_MAX_LENGTH),
  note: optionalText(CONTACT_NOTE_MAX_LENGTH),
});

const oneOrganization = (body: z.infer<typeof coordinates>) =>
  body.organizationId === undefined || body.newOrganization === undefined;

/** In the Pool by default; a Stage is chosen for Prospecting only (spec UX §6.8). */
const addContactRequest = coordinates
  .extend({
    status: z.enum(ADDABLE_CONTACT_STATUSES).default('pool'),
    stageId: z.uuid().optional(),
  })
  .refine(({ status, stageId }) => stageId === undefined || status === 'prospecting', {
    path: ['stageId'],
  })
  .refine(oneOrganization, { path: ['newOrganization'] });

/**
 * Every Coordinate at once (spec UX §6.12): one left out or blank is emptied. Neither the Stage nor the
 * Status, which change by their own gestures; anything else sent is ignored.
 */
const editContactRequest = coordinates.refine(oneOrganization, { path: ['newOrganization'] });

/**
 * A change of Status (spec UX §6.11): to Prospecting, at the Stage chosen or else the last one reached;
 * to any other Status, the Contact keeps its last Stage, and none is chosen. The reason is optional.
 */
const changeStatusRequest = z
  .object({
    status: z.enum(CONTACT_STATUSES),
    stageId: z.uuid().optional(),
    reason: optionalText(STATUS_REASON_MAX_LENGTH),
  })
  .refine(({ status, stageId }) => stageId === undefined || status === 'prospecting', {
    path: ['stageId'],
  });

/** The note of a Follow-up, or of the Interaction it becomes: blank, there is none. */
const followUpNote = optionalText(FOLLOW_UP_NOTE_MAX_LENGTH);

/**
 * Schedule a follow-up, or Edit the follow-up when there is one (spec UX §6.5): its local day, today
 * or later, and its note; a note left out is emptied.
 */
const scheduleFollowUpRequest = z.object({ dueOn: z.iso.date(), note: followUpNote });

/** Follow up… (spec UX §6.3): the local day it was done on, today or earlier (ST-36), and its note. */
const followUpRequest = z.object({ occurredOn: z.iso.date(), note: followUpNote });

/** The note of an Interaction the User writes down: blank, there is none. */
const interactionNote = optionalText(INTERACTION_NOTE_MAX_LENGTH);

/** Note an Interaction (spec UX §6.4): its kind, the local day it happened, today or earlier (ST-36), its note. */
const noteInteractionRequest = z.object({
  kind: z.enum(NOTED_INTERACTION_KINDS),
  occurredOn: z.iso.date(),
  note: interactionNote,
});

/**
 * Replied… (spec UX §6.2): the local day of the reply, today or earlier, its Channel and note, never a
 * nature; then the scheduled Follow-up canceled if asked, and, spontaneous from the Pool or Archived,
 * the Contact brought in (at a Stage, as a change of Status takes it) or added to the Circle.
 */
const recordReplyRequest = z
  .object({
    occurredOn: z.iso.date(),
    channel: z.enum(CHANNELS),
    note: interactionNote,
    cancelFollowUp: z.boolean().optional(),
    status: z.enum(['prospecting', 'ally']).optional(),
    stageId: z.uuid().optional(),
  })
  .refine(({ status, stageId }) => stageId === undefined || status === 'prospecting', {
    path: ['stageId'],
  });

/**
 * A gesture the data refuses, possibly after it wrote: thrown so that its transaction rolls back,
 * then answered.
 */
class Refusal extends Error {
  readonly status: 400 | 404 | 409;
  readonly body:
    | {
        error:
          | 'not_found'
          | 'unknown_stage'
          | 'stage_required'
          | 'same_status'
          | 'unknown_organization'
          | 'organization_taken'
          | 'no_follow_up_in_status'
          | 'no_follow_up'
          | 'past_day'
          | 'future_day'
          | 'check_in_instead'
          | 'no_status_choice';
      }
    | { error: 'linkedin_url_taken'; contactId: string };

  constructor(status: Refusal['status'], body: Refusal['body']) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}

/** What the inverse of an addition needs: the Interaction the gesture wrote, and the Organization it created. */
const contactAdded = z.object({
  interactionId: z.uuid(),
  // Absent from the gestures recorded before Organizations.
  createdOrganizationId: z.uuid().optional(),
});

/**
 * Takes an addition back: the Contact and the Interaction that recorded it leave no trace, nor the
 * Organization it created, unless another Contact joined it since (ADR 0011).
 */
const removeAddedContact: Inverse = async (tx, { userId, contactId, payload }) => {
  const { interactionId, createdOrganizationId } = contactAdded.parse(payload);
  // Added Prospecting, it leaves no Funnel entry (ST-39).
  await tx
    .delete(statusChange)
    .where(and(eq(statusChange.userId, userId), eq(statusChange.interactionId, interactionId)));
  await tx
    .delete(interaction)
    .where(and(eq(interaction.userId, userId), eq(interaction.id, interactionId)));
  await tx.delete(contact).where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
  const removedOrganizationIds =
    createdOrganizationId !== undefined &&
    (await removeCreatedOrganization(tx, userId, createdOrganizationId))
      ? [createdOrganizationId]
      : [];
  return {
    contactIds: [],
    removedContactIds: [contactId],
    organizationIds: [],
    removedOrganizationIds,
  };
};

/** The columns an edit writes, read before it for the inverse. */
const coordinateColumns = {
  name: contact.name,
  organizationId: contact.organizationId,
  jobTitle: contact.jobTitle,
  email: contact.email,
  phone: contact.phone,
  linkedinUrl: contact.linkedinUrl,
  note: contact.note,
};

/** What an edit writes over, as the inverse restores it. */
const editedCoordinates = z.object({
  name: z.string(),
  organizationId: z.uuid().nullable(),
  jobTitle: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  note: z.string().nullable(),
});

/** What the inverse of an edit needs: the Coordinates before it, and the Organization it created. */
const contactEdited = z.object({
  before: editedCoordinates,
  createdOrganizationId: z.uuid().optional(),
});

/** What the inverse of a change of Status needs: the Interaction that recorded it, and what it changed. */
const statusChanged = z.object({
  interactionId: z.uuid(),
  before: z.object({ status: z.enum(CONTACT_STATUSES), stageId: z.uuid().nullable() }),
  // Absent from the gestures recorded before Follow-ups, and when there was none to cancel.
  canceledFollowUpId: z.uuid().optional(),
});

/**
 * Takes a change of Status back: the Contact gets its Status and its Stage back, and the change leaves
 * no trace, no Funnel entry either (ST-39). Refused when it would put the Contact back Prospecting at
 * a Stage archived since: only a Contact of another Status may keep one.
 */
const restoreStatus: Inverse = async (tx, { userId, contactId, payload }) => {
  const changed = statusChanged.parse(payload);
  if (!(await canRestoreStatus(tx, userId, changed))) return 'superseded';
  await takeBackStatusChange(tx, userId, contactId, changed);
  return touchedContact(contactId);
};

/** Whether a change of Status can be taken back: never to Prospecting at a Stage archived since. */
const canRestoreStatus = async (
  tx: Transaction,
  userId: string,
  { before }: z.infer<typeof statusChanged>,
) => before.status !== 'prospecting' || isInFunnel(await stageOrder(tx, userId), before.stageId);

/** Takes a change of Status back, with the Follow-up it canceled. */
async function takeBackStatusChange(
  tx: Transaction,
  userId: string,
  contactId: string,
  { interactionId, before, canceledFollowUpId }: z.infer<typeof statusChanged>,
) {
  await tx
    .delete(statusChange)
    .where(and(eq(statusChange.userId, userId), eq(statusChange.interactionId, interactionId)));
  await tx
    .delete(interaction)
    .where(and(eq(interaction.userId, userId), eq(interaction.id, interactionId)));
  await tx
    .update(contact)
    .set(before)
    .where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
  if (canceledFollowUpId !== undefined) {
    await setFollowUpStatus(tx, userId, canceledFollowUpId, 'scheduled');
  }
}

/** The summary row of one Contact changed. */
const touchedContact = (contactId: string) => ({
  contactIds: [contactId],
  removedContactIds: [],
  organizationIds: [],
  removedOrganizationIds: [],
});

/** The scheduled Follow-up of a Contact, if it has one. */
async function scheduledFollowUp(tx: Transaction, userId: string, contactId: string) {
  const [scheduled] = await tx
    .select({ id: followUp.id, dueOn: followUp.dueOn, note: followUp.note })
    .from(followUp)
    .where(
      and(
        eq(followUp.userId, userId),
        eq(followUp.contactId, contactId),
        eq(followUp.status, 'scheduled'),
      ),
    );
  return scheduled;
}

/** Cancels a Follow-up, or schedules it again, as it was. */
const setFollowUpStatus = (
  tx: Transaction,
  userId: string,
  followUpId: string,
  status: 'scheduled' | 'canceled',
) =>
  tx
    .update(followUp)
    .set({ status })
    .where(and(eq(followUp.userId, userId), eq(followUp.id, followUpId)));

/** What the inverse of “Schedule a follow-up” needs: the Follow-up, and what it was before, if it was. */
const followUpScheduled = z.object({
  followUpId: z.uuid(),
  before: z.object({ dueOn: z.iso.date(), note: z.string().nullable() }).nullable(),
});

/** Takes a scheduling back: a new Follow-up leaves no trace, a modified one gets its day and note back. */
const restoreScheduledFollowUp: Inverse = async (tx, { userId, contactId, payload }) => {
  const { followUpId, before } = followUpScheduled.parse(payload);
  const where = and(eq(followUp.userId, userId), eq(followUp.id, followUpId));
  if (before === null) await tx.delete(followUp).where(where);
  else await tx.update(followUp).set(before).where(where);
  return touchedContact(contactId);
};

/** What the inverse of a cancellation needs: the Follow-up canceled. */
const followUpCanceled = z.object({ followUpId: z.uuid() });

const restoreCanceledFollowUp: Inverse = async (tx, { userId, contactId, payload }) => {
  const { followUpId } = followUpCanceled.parse(payload);
  await setFollowUpStatus(tx, userId, followUpId, 'scheduled');
  return touchedContact(contactId);
};

/** What the inverse of “Follow up…” needs: the Follow-up done, and the Interaction it became. */
const followedUp = z.object({ followUpId: z.uuid(), interactionId: z.uuid() });

/** Takes “Follow up…” back: the Interaction leaves no trace, and the Follow-up is scheduled again. */
const restoreFollowedUp: Inverse = async (tx, { userId, contactId, payload }) => {
  const { followUpId, interactionId } = followedUp.parse(payload);
  await tx
    .update(followUp)
    .set({ status: 'scheduled', interactionId: null })
    .where(and(eq(followUp.userId, userId), eq(followUp.id, followUpId)));
  await removeInteraction(tx, userId, interactionId);
  return touchedContact(contactId);
};

/** Where a Contact is: its Status, and its Stage (or the last one it reached). */
type ContactPlace = { status: (typeof CONTACT_STATUSES)[number]; stageId: string | null };

/**
 * Changes the Status of a locked Contact (spec UX §6.11), dated now and never earlier (ST-39): what
 * the inverse needs to take it back.
 */
async function changeStatus(
  tx: Transaction,
  userId: string,
  contactId: string,
  before: ContactPlace,
  { status, stageId, reason }: z.infer<typeof changeStatusRequest>,
  now: Date,
): Promise<z.infer<typeof statusChanged>> {
  if (before.status === status) throw new Refusal(409, { error: 'same_status' });
  // Out of Prospecting, the Contact keeps the last Stage it reached: where it left the Funnel.
  let stageAfter = before.stageId;
  if (status === 'prospecting') {
    // The last Stage reached unless one is chosen; never an archived one.
    const entered = stageToEnter(await stageOrder(tx, userId), {
      chosen: stageId,
      last: before.stageId,
    });
    if (entered === undefined) {
      throw new Refusal(400, {
        error: stageId === undefined ? 'stage_required' : 'unknown_stage',
      });
    }
    stageAfter = entered;
  }
  await tx
    .update(contact)
    .set({ status, stageId: stageAfter })
    .where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
  const canceled = statusChangeCancelsFollowUp(status)
    ? await scheduledFollowUp(tx, userId, contactId)
    : undefined;
  if (canceled) await setFollowUpStatus(tx, userId, canceled.id, 'canceled');
  // An Interaction neither outbound nor inbound; to Prospecting, a Funnel entry dated today.
  const [recorded] = await tx
    .insert(interaction)
    .values({
      userId,
      contactId,
      kind: 'status_changed',
      direction: 'none',
      occurredAt: now,
      localDate: await localDateOf(tx, userId, now),
      recordedAt: now,
    })
    .returning({ id: interaction.id });
  if (!recorded) throw new Error('An Interaction was not recorded');
  await tx.insert(statusChange).values({
    userId,
    contactId,
    interactionId: recorded.id,
    fromStatus: before.status,
    toStatus: status,
    stageId: stageAfter,
    reason,
  });
  return { interactionId: recorded.id, before, canceledFollowUpId: canceled?.id };
}

/**
 * When an Interaction the User dated happened (ST-36): its local day is the one entered, today or
 * earlier; its instant, which only orders the thread, as many days before now.
 */
async function dayEntered(tx: Transaction, userId: string, occurredOn: string, now: Date) {
  const today = await localDateOf(tx, userId, now);
  if (occurredOn > today) throw new Refusal(400, { error: 'future_day' });
  return {
    occurredAt: new Date(now.getTime() - daysBetween(occurredOn, today) * 86_400_000),
    localDate: occurredOn,
    recordedAt: now,
  };
}

/** Takes back a gesture that recorded one Interaction alone. */
const removeInteraction = (tx: Transaction, userId: string, interactionId: string) =>
  tx
    .delete(interaction)
    .where(and(eq(interaction.userId, userId), eq(interaction.id, interactionId)));

/** What the inverse of “Note an Interaction” needs: the Interaction it recorded. */
const interactionNoted = z.object({ interactionId: z.uuid() });

const removeNotedInteraction: Inverse = async (tx, { userId, contactId, payload }) => {
  await removeInteraction(tx, userId, interactionNoted.parse(payload).interactionId);
  return touchedContact(contactId);
};

/** What the inverse of “Replied…” needs: the reply, the Follow-up it canceled, the change of Status it made. */
const replyRecorded = z.object({
  interactionId: z.uuid(),
  canceledFollowUpId: z.uuid().optional(),
  statusChanged: statusChanged.optional(),
});

/** Takes “Replied…” back: the reply leaves no trace, the Follow-up comes back, the Status too. */
const removeReply: Inverse = async (tx, { userId, contactId, payload }) => {
  const recorded = replyRecorded.parse(payload);
  if (recorded.statusChanged && !(await canRestoreStatus(tx, userId, recorded.statusChanged))) {
    return 'superseded';
  }
  if (recorded.statusChanged) {
    await takeBackStatusChange(tx, userId, contactId, recorded.statusChanged);
  }
  await removeInteraction(tx, userId, recorded.interactionId);
  if (recorded.canceledFollowUpId !== undefined) {
    await setFollowUpStatus(tx, userId, recorded.canceledFollowUpId, 'scheduled');
  }
  return touchedContact(contactId);
};

/**
 * A gesture on one Contact, in its own transaction, the Contact locked first: what `act` answers, or
 * the refusal it threw. `act` gets the Status and the Stage of the Contact; an unknown Contact is refused.
 */
async function onContact<Answer>(
  userId: string,
  contactId: string,
  act: (tx: Transaction, before: ContactPlace) => Promise<Answer>,
): Promise<Answer | Refusal> {
  return withUser(userId, async (tx) => {
    await lockContact(tx, contactId);
    const [found] = await tx
      .select({ status: contact.status, stageId: contact.stageId })
      .from(contact)
      .where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
    if (!found) throw new Refusal(404, { error: 'not_found' });
    return act(tx, found);
  }).catch((error: unknown) => {
    if (error instanceof Refusal) return error;
    throw error;
  });
}

/** The Contacts of an Organization, as its own gestures read and move them (spec stack §5.2). */
export const organizationMembers: OrganizationMembers = {
  async any(tx, userId, organizationId) {
    const [member] = await tx
      .select({ id: contact.id })
      .from(contact)
      .where(and(eq(contact.userId, userId), eq(contact.organizationId, organizationId)))
      .limit(1);
    return member !== undefined;
  },
  async move(tx, userId, fromId, toId) {
    const moved = await tx
      .update(contact)
      .set({ organizationId: toId })
      .where(and(eq(contact.userId, userId), eq(contact.organizationId, fromId)))
      .returning({ id: contact.id });
    return moved.map(({ id }) => id);
  },
};

/**
 * Deletes the Organization a gesture created, unless a Contact belongs to it: one joined it since.
 * Whether it went.
 */
async function removeCreatedOrganization(tx: Transaction, userId: string, organizationId: string) {
  if (await organizationMembers.any(tx, userId, organizationId)) return false;
  await deleteOrganization(tx, userId, organizationId);
  return true;
}

/**
 * Takes an edit back: the Coordinates are restored, and the Organization it created goes unless
 * another Contact joined it (ADR 0011). Refused when a gesture on another Contact took the way back:
 * the Organization restored is gone, or the LinkedIn profile restored is another Contact's now.
 */
const restoreEditedContact: Inverse = async (tx, { userId, contactId, payload }) => {
  const { before, createdOrganizationId } = contactEdited.parse(payload);
  if (
    before.organizationId !== null &&
    !(await isOrganizationOf(tx, userId, before.organizationId))
  ) {
    return 'superseded';
  }
  const owner = before.linkedinUrl && (await contactWithProfile(tx, userId, before.linkedinUrl));
  if (owner && owner !== contactId) return 'superseded';
  await tx
    .update(contact)
    .set(before)
    .where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
  const removedOrganizationIds =
    createdOrganizationId !== undefined &&
    (await removeCreatedOrganization(tx, userId, createdOrganizationId))
      ? [createdOrganizationId]
      : [];
  return {
    contactIds: [contactId],
    removedContactIds: [],
    organizationIds: [],
    removedOrganizationIds,
  };
};

/**
 * The Organization the Contact belongs to after a gesture: one of the User's, a new one, or none; and
 * the one the gesture created, if it did.
 */
async function chosenOrganization(
  tx: Transaction,
  userId: string,
  {
    organizationId,
    newOrganization,
  }: Pick<z.infer<typeof coordinates>, 'organizationId' | 'newOrganization'>,
) {
  if (organizationId !== undefined) {
    if (!(await isOrganizationOf(tx, userId, organizationId))) {
      throw new Refusal(400, { error: 'unknown_organization' });
    }
    return { organizationId, createdOrganizationId: undefined };
  }
  if (newOrganization === undefined)
    return { organizationId: null, createdOrganizationId: undefined };
  const created = await createOrganization(tx, userId, newOrganization);
  if (created === null) throw new Refusal(409, { error: 'organization_taken' });
  return { organizationId: created, createdOrganizationId: created };
}

/** The Contact of the User with this LinkedIn profile, if there is one. */
async function contactWithProfile(tx: Transaction, userId: string, url: string) {
  const [found] = await tx
    .select({ id: contact.id })
    .from(contact)
    .where(and(eq(contact.userId, userId), eq(contact.linkedinUrl, url)));
  return found?.id;
}

/**
 * The gestures of the Contact (spec stack §5.2, §5.4): one endpoint each, in one transaction, which
 * answers with the rows of the summary it changed and the token that undoes it.
 */
export function createProspecting<Changes>({
  clock,
  requireUser,
  changesOf,
}: {
  clock: Clock;
  requireUser: RequireUser;
  changesOf: ChangesOf<Changes>;
}) {
  const routes = new Hono<AppEnv>()
    // A new Contact joins the Pool, enters the Funnel or joins the Circle; only its name is asked (spec UX §6.8).
    .post('/contacts', requireUser, jsonBody(addContactRequest), async (c) => {
      const { userId } = c.var;
      const { status, stageId, organizationId, newOrganization, ...fields } = c.req.valid('json');
      const now = clock.now();
      const answer = await withUser(userId, async (tx) => {
        let enteredStageId: string | null = null;
        if (status === 'prospecting') {
          // The first Stage not archived unless one is chosen; the ones before it are not skipped.
          const stages = await stageOrder(tx, userId);
          const entered =
            stageId === undefined ? stages[0] : stages.find(({ id }) => id === stageId);
          if (!entered) throw new Refusal(400, { error: 'unknown_stage' });
          enteredStageId = entered.id;
        }
        const { organizationId: joinedOrganizationId, createdOrganizationId } =
          await chosenOrganization(tx, userId, { organizationId, newOrganization });
        // The unique index decides (ST-64): another addition may have taken the profile meanwhile.
        const [added] = await tx
          .insert(contact)
          .values({
            userId,
            ...fields,
            status,
            stageId: enteredStageId,
            organizationId: joinedOrganizationId,
            createdAt: now,
          })
          .onConflictDoNothing({ target: [contact.userId, contact.linkedinUrl] })
          .returning({ id: contact.id });
        if (!added) {
          const owner =
            fields.linkedinUrl && (await contactWithProfile(tx, userId, fields.linkedinUrl));
          if (!owner) throw new Error('A Contact was not added');
          throw new Refusal(409, { error: 'linkedin_url_taken', contactId: owner });
        }
        // The addition opens the history of the Contact: an Interaction neither outbound nor inbound.
        const [recorded] = await tx
          .insert(interaction)
          .values({
            userId,
            contactId: added.id,
            kind: 'contact_added',
            direction: 'none',
            occurredAt: now,
            localDate: await localDateOf(tx, userId, now),
            recordedAt: now,
          })
          .returning({ id: interaction.id });
        if (!recorded) throw new Error('An Interaction was not recorded');
        // Its first Status, a change from none: added Prospecting, a Funnel entry dated today.
        await tx.insert(statusChange).values({
          userId,
          contactId: added.id,
          interactionId: recorded.id,
          fromStatus: null,
          toStatus: status,
          stageId: enteredStageId,
        });
        const undoToken = await recordGesture(tx, {
          userId,
          kind: 'contact_added',
          contactId: added.id,
          payload: {
            interactionId: recorded.id,
            createdOrganizationId,
          } satisfies z.infer<typeof contactAdded>,
          now,
        });
        const changes = await changesOf(tx, userId, {
          contactIds: [added.id],
          removedContactIds: [],
          organizationIds: createdOrganizationId ? [createdOrganizationId] : [],
          removedOrganizationIds: [],
        });
        return { changes, undoToken };
      }).catch((error: unknown) => {
        if (error instanceof Refusal) return error;
        throw error;
      });
      if (answer instanceof Refusal) return c.json(answer.body, answer.status);
      return c.json(answer, 201);
    })
    // The Coordinates, edited in place (spec UX §6.12): no Interaction, neither Stage nor Status.
    .post('/contacts/:id/edit', requireUser, jsonBody(editContactRequest), async (c) => {
      const { userId } = c.var;
      const id = z.uuid().safeParse(c.req.param('id'));
      // Another User's Contact, an unknown one and an id that is none answer alike.
      if (!id.success) return c.json({ error: 'not_found' as const }, 404);
      const contactId = id.data;
      const { organizationId, newOrganization, ...fields } = c.req.valid('json');
      const now = clock.now();
      const answer = await withUser(userId, async (tx) => {
        await lockContact(tx, contactId);
        const [before] = await tx
          .select(coordinateColumns)
          .from(contact)
          .where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
        if (!before) throw new Refusal(404, { error: 'not_found' });
        const chosen = await chosenOrganization(tx, userId, { organizationId, newOrganization });
        // The unique index decides (ST-64), in a savepoint so that the owner can still be read.
        const profile = fields.linkedinUrl ?? null;
        await tx
          .transaction((savepoint) =>
            savepoint
              .update(contact)
              .set({
                name: fields.name,
                organizationId: chosen.organizationId,
                jobTitle: fields.jobTitle ?? null,
                email: fields.email ?? null,
                phone: fields.phone ?? null,
                linkedinUrl: profile,
                note: fields.note ?? null,
              })
              .where(and(eq(contact.userId, userId), eq(contact.id, contactId))),
          )
          .catch(async (error: unknown) => {
            if (profile === null || !violates(error, 'contact_linkedin_url_unique')) {
              throw error;
            }
            const owner = await contactWithProfile(tx, userId, profile);
            if (!owner) throw error;
            throw new Refusal(409, { error: 'linkedin_url_taken', contactId: owner });
          });
        const undoToken = await recordGesture(tx, {
          userId,
          kind: 'contact_edited',
          contactId,
          payload: {
            before,
            createdOrganizationId: chosen.createdOrganizationId,
          } satisfies z.infer<typeof contactEdited>,
          now,
        });
        const changes = await changesOf(tx, userId, {
          contactIds: [contactId],
          removedContactIds: [],
          organizationIds: chosen.createdOrganizationId ? [chosen.createdOrganizationId] : [],
          removedOrganizationIds: [],
        });
        return { changes, undoToken };
      }).catch((error: unknown) => {
        if (error instanceof Refusal) return error;
        throw error;
      });
      if (answer instanceof Refusal) return c.json(answer.body, answer.status);
      return c.json(answer, 200);
    })
    // Bring in…, Back to Pool…, Add to Circle…, Archive… (spec UX §6.11): any Status to any other,
    // dated when it is written down, never earlier (ST-39).
    .post('/contacts/:id/change-status', requireUser, jsonBody(changeStatusRequest), async (c) => {
      const { userId } = c.var;
      const id = z.uuid().safeParse(c.req.param('id'));
      // Another User's Contact, an unknown one and an id that is none answer alike.
      if (!id.success) return c.json({ error: 'not_found' as const }, 404);
      const contactId = id.data;
      const wanted = c.req.valid('json');
      const now = clock.now();
      const answer = await onContact(userId, contactId, async (tx, before) => {
        const undoToken = await recordGesture(tx, {
          userId,
          kind: 'status_changed',
          contactId,
          payload: await changeStatus(tx, userId, contactId, before, wanted, now),
          now,
        });
        return { changes: await changesOf(tx, userId, touchedContact(contactId)), undoToken };
      });
      if (answer instanceof Refusal) return c.json(answer.body, answer.status);
      return c.json(answer, 200);
    })
    // Schedule a follow-up, or Edit the follow-up (spec UX §6.5): off the Cadence when there was none.
    .post(
      '/contacts/:id/schedule-follow-up',
      requireUser,
      jsonBody(scheduleFollowUpRequest),
      async (c) => {
        const { userId } = c.var;
        const id = z.uuid().safeParse(c.req.param('id'));
        if (!id.success) return c.json({ error: 'not_found' as const }, 404);
        const contactId = id.data;
        const { dueOn, note = null } = c.req.valid('json');
        const now = clock.now();
        const answer = await onContact(userId, contactId, async (tx, { status }) => {
          if (!hasFollowUps(status)) throw new Refusal(409, { error: 'no_follow_up_in_status' });
          if (dueOn < (await localDateOf(tx, userId, now))) {
            throw new Refusal(400, { error: 'past_day' });
          }
          const before = await scheduledFollowUp(tx, userId, contactId);
          let followUpId = before?.id;
          if (followUpId === undefined) {
            const [scheduled] = await tx
              .insert(followUp)
              .values({ userId, contactId, status: 'scheduled', dueOn, note, scheduledAt: now })
              .returning({ id: followUp.id });
            if (!scheduled) throw new Error('A Follow-up was not scheduled');
            followUpId = scheduled.id;
          } else {
            await tx
              .update(followUp)
              .set({ dueOn, note })
              .where(and(eq(followUp.userId, userId), eq(followUp.id, followUpId)));
          }
          const undoToken = await recordGesture(tx, {
            userId,
            kind: 'follow_up_scheduled',
            contactId,
            payload: {
              followUpId,
              before: before ? { dueOn: before.dueOn, note: before.note } : null,
            } satisfies z.infer<typeof followUpScheduled>,
            now,
          });
          return { changes: await changesOf(tx, userId, touchedContact(contactId)), undoToken };
        });
        if (answer instanceof Refusal) return c.json(answer.body, answer.status);
        return c.json(answer, 200);
      },
    )
    // Cancel the scheduled Follow-up (spec UX §5.3): it stays, canceled.
    .post('/contacts/:id/cancel-follow-up', requireUser, async (c) => {
      const { userId } = c.var;
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'not_found' as const }, 404);
      const contactId = id.data;
      const now = clock.now();
      const answer = await onContact(userId, contactId, async (tx) => {
        const scheduled = await scheduledFollowUp(tx, userId, contactId);
        if (!scheduled) throw new Refusal(409, { error: 'no_follow_up' });
        await setFollowUpStatus(tx, userId, scheduled.id, 'canceled');
        const undoToken = await recordGesture(tx, {
          userId,
          kind: 'follow_up_canceled',
          contactId,
          payload: { followUpId: scheduled.id } satisfies z.infer<typeof followUpCanceled>,
          now,
        });
        return { changes: await changesOf(tx, userId, touchedContact(contactId)), undoToken };
      });
      if (answer instanceof Refusal) return c.json(answer.body, answer.status);
      return c.json(answer, 200);
    })
    // Follow up… (spec UX §6.3): the scheduled Follow-up becomes an outbound Interaction, dated the
    // local day entered (ST-36), a Prospecting action.
    .post('/contacts/:id/follow-up', requireUser, jsonBody(followUpRequest), async (c) => {
      const { userId } = c.var;
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'not_found' as const }, 404);
      const contactId = id.data;
      const { occurredOn, note = null } = c.req.valid('json');
      const now = clock.now();
      const answer = await onContact(userId, contactId, async (tx) => {
        const day = await dayEntered(tx, userId, occurredOn, now);
        const scheduled = await scheduledFollowUp(tx, userId, contactId);
        if (!scheduled) throw new Refusal(409, { error: 'no_follow_up' });
        const [recorded] = await tx
          .insert(interaction)
          .values({ userId, contactId, kind: 'follow_up', direction: 'outbound', ...day, note })
          .returning({ id: interaction.id });
        if (!recorded) throw new Error('An Interaction was not recorded');
        await tx
          .update(followUp)
          .set({ status: 'done', interactionId: recorded.id })
          .where(and(eq(followUp.userId, userId), eq(followUp.id, scheduled.id)));
        const undoToken = await recordGesture(tx, {
          userId,
          kind: 'followed_up',
          contactId,
          payload: {
            followUpId: scheduled.id,
            interactionId: recorded.id,
          } satisfies z.infer<typeof followedUp>,
          now,
        });
        return { changes: await changesOf(tx, userId, touchedContact(contactId)), undoToken };
      });
      if (answer instanceof Refusal) return c.json(answer.body, answer.status);
      return c.json(answer, 200);
    })
    // Note an Interaction (spec UX §6.4): outbound, off any Positioning and off the Activity. With an
    // Ally, a free outbound Interaction is a Check-in, which has its own gesture (§6.14).
    .post(
      '/contacts/:id/note-interaction',
      requireUser,
      jsonBody(noteInteractionRequest),
      async (c) => {
        const { userId } = c.var;
        const id = z.uuid().safeParse(c.req.param('id'));
        if (!id.success) return c.json({ error: 'not_found' as const }, 404);
        const contactId = id.data;
        const { kind, occurredOn, note = null } = c.req.valid('json');
        const now = clock.now();
        const answer = await onContact(userId, contactId, async (tx, { status }) => {
          if (!canNoteInteraction(status)) throw new Refusal(409, { error: 'check_in_instead' });
          const day = await dayEntered(tx, userId, occurredOn, now);
          const [recorded] = await tx
            .insert(interaction)
            .values({ userId, contactId, kind, direction: 'outbound', ...day, note })
            .returning({ id: interaction.id });
          if (!recorded) throw new Error('An Interaction was not recorded');
          const undoToken = await recordGesture(tx, {
            userId,
            kind: 'interaction_noted',
            contactId,
            payload: { interactionId: recorded.id } satisfies z.infer<typeof interactionNoted>,
            now,
          });
          return { changes: await changesOf(tx, userId, touchedContact(contactId)), undoToken };
        });
        if (answer instanceof Refusal) return c.json(answer.body, answer.status);
        return c.json(answer, 200);
      },
    )
    // Replied… (spec UX §6.2): an inbound Interaction, with no nature (ADR 0005). Spontaneous, from the
    // Pool or Archived, it may bring the Contact in or add it to the Circle, dated now (ST-39).
    .post('/contacts/:id/record-reply', requireUser, jsonBody(recordReplyRequest), async (c) => {
      const { userId } = c.var;
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'not_found' as const }, 404);
      const contactId = id.data;
      const {
        occurredOn,
        channel,
        note = null,
        cancelFollowUp = false,
        status,
        stageId,
      } = c.req.valid('json');
      const now = clock.now();
      const answer = await onContact(userId, contactId, async (tx, before) => {
        // Only out of the Funnel and of the Circle is there a choice of Status (spec UX §6.2).
        if (status !== undefined && !isPoolOrArchived(before.status)) {
          throw new Refusal(409, { error: 'no_status_choice' });
        }
        const day = await dayEntered(tx, userId, occurredOn, now);
        const scheduled = cancelFollowUp
          ? await scheduledFollowUp(tx, userId, contactId)
          : undefined;
        if (cancelFollowUp && !scheduled) throw new Refusal(409, { error: 'no_follow_up' });
        if (scheduled) await setFollowUpStatus(tx, userId, scheduled.id, 'canceled');
        const [recorded] = await tx
          .insert(interaction)
          .values({ userId, contactId, kind: 'reply', direction: 'inbound', ...day, note, channel })
          .returning({ id: interaction.id });
        if (!recorded) throw new Error('An Interaction was not recorded');
        const changed =
          status === undefined
            ? undefined
            : await changeStatus(tx, userId, contactId, before, { status, stageId }, now);
        const undoToken = await recordGesture(tx, {
          userId,
          kind: 'reply_recorded',
          contactId,
          payload: {
            interactionId: recorded.id,
            canceledFollowUpId: scheduled?.id,
            statusChanged: changed,
          } satisfies z.infer<typeof replyRecorded>,
          now,
        });
        return { changes: await changesOf(tx, userId, touchedContact(contactId)), undoToken };
      });
      if (answer instanceof Refusal) return c.json(answer.body, answer.status);
      return c.json(answer, 200);
    });

  const inverses = {
    contact_added: removeAddedContact,
    contact_edited: restoreEditedContact,
    status_changed: restoreStatus,
    follow_up_scheduled: restoreScheduledFollowUp,
    follow_up_canceled: restoreCanceledFollowUp,
    followed_up: restoreFollowedUp,
    interaction_noted: removeNotedInteraction,
    reply_recorded: removeReply,
  } satisfies Inverses;
  return { routes, inverses };
}
