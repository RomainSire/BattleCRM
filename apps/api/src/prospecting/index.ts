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
  OVERRIDE_REASON_MAX_LENGTH,
  STATUS_REASON_MAX_LENGTH,
} from '@battlecrm/contract';
import {
  canNoteInteraction,
  firstFollowUpOn,
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
import { positioningToUse, stageOrder, type PositioningUses } from '../funnel/index.ts';
import type { BattleAssignments } from '../battles/index.ts';
import {
  createCircuit,
  lockSubject,
  touched,
  type ChangesOf,
  type Creation,
  type Gesture,
  type GestureSubject,
} from '../gestures/index.ts';
import { jsonBody } from '../json-body.ts';
import {
  createOrganization,
  deleteOrganization,
  isOrganizationOf,
  type OrganizationMembers,
} from '../organizations/index.ts';
import type { Random } from '../random.ts';
import { answerRefusal, refusal } from '../refusals.ts';
import { idOf } from '../route-id.ts';
import { localDateOf } from '../settings/index.ts';
import { contactSubject, type ContactPlace } from './contact-subject.ts';
import {
  cancelFollowUp,
  followUpPushed,
  pushFollowUpBack,
  recordFollowUp,
  scheduledFollowUp,
  scheduleFollowUp,
  setFollowUpRank,
  setFollowUpStatus,
  restoreFollowUpDay,
} from './follow-ups.ts';
import {
  dayEntered,
  recordInteraction,
  recordInteractionNow,
  removeInteraction,
} from './interactions.ts';
import { contact, followUp, interaction, statusChange } from './tables.ts';
import {
  anyAssignmentIn,
  anyTrialWith,
  droppedAssignment,
  dropAssignment,
  hasAssignment,
  hasTrialInProgress,
  removeTrial,
  restoreAssignment,
  revealAssignment,
  startTrial,
  trialToStart,
} from './trials.ts';

// Read by `views`, which never writes them.
export {
  assignment,
  contact,
  followUp,
  interaction,
  PROSPECTING_ACTION_KINDS,
  statusChange,
  trial,
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
 * Use a Positioning (spec UX §6.1): which one, the local day it was sent on, today or earlier
 * (ST-36), and the day of its first Follow-up when the User changes it (today or later). From the
 * Pool or Archived, the Contact may be brought in first, at the Stage of the Positioning.
 */
const usePositioningRequest = z.object({
  positioningId: z.uuid(),
  occurredOn: z.iso.date(),
  followUpOn: z.iso.date().optional(),
  bringIn: z.boolean().optional(),
  /** Why the other Positioning was used instead of the one assigned: an Override, traced on the Trial. */
  overrideReason: optionalText(OVERRIDE_REASON_MAX_LENGTH),
});

/** The summary row of one Contact changed. */
const touchedContact = (contactId: string) => touched({ contactIds: [contactId] });

/** Whether a Positioning was ever used: a use is an Interaction that names it (CONTEXT.md, Positioning). */
export const positioningUses: PositioningUses = {
  async any(tx, userId, positioningId) {
    const [use] = await tx
      .select({ id: interaction.id })
      .from(interaction)
      .where(and(eq(interaction.userId, userId), eq(interaction.positioningId, positioningId)))
      .limit(1);
    return use !== undefined;
  },
  inTrial: anyTrialWith,
};

/** Whether a Battle assigned anything, for “Undo” of its opening (ADR 0011). */
export const battleAssignments: BattleAssignments = { any: anyAssignmentIn };

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
 * The summary rows of the Organizations it removed.
 */
async function removeCreatedOrganization(
  tx: Transaction,
  userId: string,
  organizationId: string | undefined,
) {
  if (organizationId === undefined) return [];
  if (await organizationMembers.any(tx, userId, organizationId)) return [];
  await deleteOrganization(tx, userId, organizationId);
  return [organizationId];
}

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
      return refusal('unknown_organization');
    }
    return { organizationId, createdOrganizationId: undefined };
  }
  if (newOrganization === undefined)
    return { organizationId: null, createdOrganizationId: undefined };
  const created = await createOrganization(tx, userId, newOrganization);
  if (created === null) return refusal('organization_taken');
  return { organizationId: created, createdOrganizationId: created };
}

/** The summary rows of a gesture on one Contact, with the Organization it created. */
const touchedWithOrganization = (contactId: string, createdOrganizationId: string | undefined) =>
  touched({
    contactIds: [contactId],
    organizationIds: createdOrganizationId === undefined ? [] : [createdOrganizationId],
  });

/** The Contact of the User with this LinkedIn profile, if there is one. */
async function contactWithProfile(tx: Transaction, userId: string, url: string) {
  const [found] = await tx
    .select({ id: contact.id })
    .from(contact)
    .where(and(eq(contact.userId, userId), eq(contact.linkedinUrl, url)));
  return found?.id;
}

/** What “Add a Contact” retains: the Interaction that recorded it, and the Organization it created. */
const contactAdded = z.object({
  interactionId: z.uuid(),
  // Absent from the gestures recorded before Organizations.
  createdOrganizationId: z.uuid().optional(),
});

/** A new Contact joins the Pool, enters the Funnel or joins the Circle; only its name is asked (spec UX §6.8). */
const addContact: Creation<
  'contact_added',
  z.infer<typeof addContactRequest>,
  z.infer<typeof contactAdded>,
  'unknown_stage' | 'unknown_organization' | 'organization_taken' | 'linkedin_url_taken'
> = {
  kind: 'contact_added',
  subject: contactSubject,
  async write({ tx, userId, input, now }) {
    const { status, stageId, organizationId, newOrganization, ...fields } = input;
    let enteredStageId: string | null = null;
    if (status === 'prospecting') {
      // The first Stage not archived unless one is chosen; the ones before it are not skipped.
      const stages = await stageOrder(tx, userId);
      const entered = stageId === undefined ? stages[0] : stages.find(({ id }) => id === stageId);
      if (!entered) return refusal('unknown_stage');
      enteredStageId = entered.id;
    }
    const chosen = await chosenOrganization(tx, userId, { organizationId, newOrganization });
    if ('error' in chosen) return chosen;
    // The unique index decides (ST-64): another addition may have taken the profile meanwhile.
    const [added] = await tx
      .insert(contact)
      .values({
        userId,
        ...fields,
        status,
        stageId: enteredStageId,
        organizationId: chosen.organizationId,
        createdAt: now,
      })
      .onConflictDoNothing({ target: [contact.userId, contact.linkedinUrl] })
      .returning({ id: contact.id });
    if (!added) {
      const owner =
        fields.linkedinUrl && (await contactWithProfile(tx, userId, fields.linkedinUrl));
      if (!owner) throw new Error('A Contact was not added');
      return refusal('linkedin_url_taken', { contactId: owner });
    }
    // The addition opens the history of the Contact.
    const interactionId = await recordInteractionNow(
      tx,
      { userId, contactId: added.id, kind: 'contact_added' },
      now,
    );
    // Its first Status, a change from none: added Prospecting, a Funnel entry dated today.
    await tx.insert(statusChange).values({
      userId,
      contactId: added.id,
      interactionId,
      fromStatus: null,
      toStatus: status,
      stageId: enteredStageId,
    });
    return {
      subjectId: added.id,
      retained: { interactionId, createdOrganizationId: chosen.createdOrganizationId },
      touched: touchedWithOrganization(added.id, chosen.createdOrganizationId),
    };
  },
  retained: contactAdded,
  /**
   * The Contact and the Interaction that recorded it leave no trace, nor the Organization it created,
   * unless another Contact joined it since (ADR 0011).
   */
  async inverse(tx, { userId, subjectId: contactId, retained }) {
    // An Assignment revealed since survives “Undo” (ADR 0011), and the Contact with it.
    if (await hasAssignment(tx, userId, contactId)) return 'superseded';
    // Added Prospecting, it leaves no Funnel entry (ST-39).
    await tx
      .delete(statusChange)
      .where(
        and(
          eq(statusChange.userId, userId),
          eq(statusChange.interactionId, retained.interactionId),
        ),
      );
    await removeInteraction(tx, userId, retained.interactionId);
    await tx.delete(contact).where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
    return touched({
      removedContactIds: [contactId],
      removedOrganizationIds: await removeCreatedOrganization(
        tx,
        userId,
        retained.createdOrganizationId,
      ),
    });
  },
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

/** The Contact an edit acts on, as it reads it once locked: its Coordinates. */
const contactCoordinates: GestureSubject<z.infer<typeof editedCoordinates>> = {
  column: contactSubject.column,
  async load(tx, userId, contactId) {
    const [found] = await tx
      .select(coordinateColumns)
      .from(contact)
      .where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
    return found;
  },
};

/** What “Edit the Contact” retains: the Coordinates before it, and the Organization it created. */
const contactEdited = z.object({
  before: editedCoordinates,
  createdOrganizationId: z.uuid().optional(),
});

/** The Coordinates, edited in place (spec UX §6.12): no Interaction, neither Stage nor Status. */
const editContact: Gesture<
  'contact_edited',
  z.infer<typeof editedCoordinates>,
  z.infer<typeof editContactRequest>,
  z.infer<typeof contactEdited>,
  'unknown_organization' | 'organization_taken' | 'linkedin_url_taken'
> = {
  kind: 'contact_edited',
  subject: contactCoordinates,
  async write({ tx, userId, subjectId: contactId, subject: before, input }) {
    const { organizationId, newOrganization, ...fields } = input;
    const chosen = await chosenOrganization(tx, userId, { organizationId, newOrganization });
    if ('error' in chosen) return chosen;
    // The unique index decides (ST-64), in a savepoint so that the owner can still be read.
    const profile = fields.linkedinUrl ?? null;
    const taken = await tx
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
      .then(
        () => undefined,
        async (error: unknown) => {
          if (profile === null || !violates(error, 'contact_linkedin_url_unique')) throw error;
          const owner = await contactWithProfile(tx, userId, profile);
          if (!owner) throw error;
          return refusal('linkedin_url_taken', { contactId: owner });
        },
      );
    if (taken) return taken;
    return {
      retained: { before, createdOrganizationId: chosen.createdOrganizationId },
      touched: touchedWithOrganization(contactId, chosen.createdOrganizationId),
    };
  },
  retained: contactEdited,
  /**
   * The Coordinates are restored, and the Organization it created goes unless another Contact joined
   * it (ADR 0011). Refused when a gesture on another Contact took the way back: the Organization
   * restored is gone, or the LinkedIn profile restored is another Contact's now.
   */
  async inverse(tx, { userId, subjectId: contactId, retained: { before, createdOrganizationId } }) {
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
    return touched({
      contactIds: [contactId],
      removedOrganizationIds: await removeCreatedOrganization(tx, userId, createdOrganizationId),
    });
  },
};

/** What a change of Status retains: the Interaction that recorded it, and what it changed. */
const statusChanged = z.object({
  interactionId: z.uuid(),
  before: z.object({ status: z.enum(CONTACT_STATUSES), stageId: z.uuid().nullable() }),
  // Absent from the gestures recorded before Follow-ups, and when there was none to cancel.
  canceledFollowUpId: z.uuid().optional(),
  // Leaving Prospecting, the Assignment that fell; absent before Assignments.
  droppedAssignment: droppedAssignment.optional(),
});

/**
 * Changes the Status of a locked Contact (spec UX §6.11), dated now and never earlier (ST-39): what
 * the inverse needs to take it back.
 */
async function writeStatusChange(
  tx: Transaction,
  userId: string,
  contactId: string,
  before: ContactPlace,
  { status, stageId, reason }: z.infer<typeof changeStatusRequest>,
  now: Date,
) {
  if (before.status === status) return refusal('same_status');
  // Leaving Prospecting settles the Trial in progress first (ticket 29); its Assignment falls.
  const leaves = before.status === 'prospecting';
  if (leaves && (await hasTrialInProgress(tx, userId, contactId))) {
    return refusal('trial_in_progress');
  }
  const dropped = leaves ? await dropAssignment(tx, userId, contactId) : undefined;
  // Out of Prospecting, the Contact keeps the last Stage it reached: where it left the Funnel.
  let stageAfter = before.stageId;
  if (status === 'prospecting') {
    // The last Stage reached unless one is chosen; never an archived one.
    const entered = stageToEnter(await stageOrder(tx, userId), {
      chosen: stageId,
      last: before.stageId,
    });
    if (entered === undefined) {
      return refusal(stageId === undefined ? 'stage_required' : 'unknown_stage');
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
  // To Prospecting, a Funnel entry dated today.
  const interactionId = await recordInteractionNow(
    tx,
    { userId, contactId, kind: 'status_changed' },
    now,
  );
  await tx.insert(statusChange).values({
    userId,
    contactId,
    interactionId,
    fromStatus: before.status,
    toStatus: status,
    stageId: stageAfter,
    reason,
  });
  return {
    interactionId,
    before,
    canceledFollowUpId: canceled?.id,
    droppedAssignment: dropped,
  } satisfies z.infer<typeof statusChanged>;
}

/**
 * Whether a change of Status can be taken back: never to Prospecting at a Stage archived since, nor
 * out of Prospecting once an Assignment was revealed there, which survives “Undo” (ADR 0011).
 */
async function canRestoreStatus(
  tx: Transaction,
  userId: string,
  contactId: string,
  { before }: z.infer<typeof statusChanged>,
) {
  if (before.status !== 'prospecting') return !(await hasAssignment(tx, userId, contactId));
  return isInFunnel(await stageOrder(tx, userId), before.stageId);
}

/** Takes a change of Status back, with the Follow-up it canceled. */
async function takeBackStatusChange(
  tx: Transaction,
  userId: string,
  contactId: string,
  {
    interactionId,
    before,
    canceledFollowUpId,
    droppedAssignment: dropped,
  }: z.infer<typeof statusChanged>,
) {
  await tx
    .delete(statusChange)
    .where(and(eq(statusChange.userId, userId), eq(statusChange.interactionId, interactionId)));
  await removeInteraction(tx, userId, interactionId);
  await tx
    .update(contact)
    .set(before)
    .where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
  if (canceledFollowUpId !== undefined) {
    await setFollowUpStatus(tx, userId, canceledFollowUpId, 'scheduled');
  }
  // Back Prospecting at its Stage, it gets its Assignment back, never drawn again.
  if (dropped && before.stageId !== null) {
    await restoreAssignment(tx, { userId, contactId, stageId: before.stageId }, dropped);
  }
}

/**
 * Bring in…, Back to Pool…, Add to Circle…, Archive… (spec UX §6.11): any Status to any other, dated
 * when it is written down, never earlier (ST-39).
 */
const changeContactStatus: Gesture<
  'status_changed',
  ContactPlace,
  z.infer<typeof changeStatusRequest>,
  z.infer<typeof statusChanged>,
  'same_status' | 'stage_required' | 'unknown_stage' | 'trial_in_progress'
> = {
  kind: 'status_changed',
  subject: contactSubject,
  async write({ tx, userId, subjectId: contactId, subject, input, now }) {
    const changed = await writeStatusChange(tx, userId, contactId, subject, input, now);
    if ('error' in changed) return changed;
    return { retained: changed, touched: touchedContact(contactId) };
  },
  retained: statusChanged,
  /**
   * The Contact gets its Status and its Stage back, and the change leaves no trace, no Funnel entry
   * either (ST-39). Refused when it would put the Contact back Prospecting at a Stage archived since:
   * only a Contact of another Status may keep one.
   */
  async inverse(tx, { userId, subjectId: contactId, retained }) {
    if (!(await canRestoreStatus(tx, userId, contactId, retained))) return 'superseded';
    await takeBackStatusChange(tx, userId, contactId, retained);
    return touchedContact(contactId);
  },
};

/** What “Note an Interaction” retains: the Interaction it recorded, the Follow-up it pushed back. */
const interactionNoted = z.object({
  interactionId: z.uuid(),
  // Absent from the gestures recorded before the Cadence.
  pushed: followUpPushed.optional(),
});

/**
 * Note an Interaction (spec UX §6.4): outbound, off any Positioning and off the Activity; it pushes
 * the Follow-up of the Cadence back. With an Ally, a free outbound Interaction is a Check-in, which
 * has its own gesture (§6.14).
 */
const noteInteraction: Gesture<
  'interaction_noted',
  ContactPlace,
  z.infer<typeof noteInteractionRequest>,
  z.infer<typeof interactionNoted>,
  'check_in_instead' | 'future_day'
> = {
  kind: 'interaction_noted',
  subject: contactSubject,
  async refuse({ subject }) {
    return canNoteInteraction(subject.status) ? undefined : refusal('check_in_instead');
  },
  async write({ tx, userId, subjectId: contactId, input: { kind, occurredOn, note = null }, now }) {
    const day = await dayEntered(tx, userId, occurredOn, now);
    if ('error' in day) return day;
    const interactionId = await recordInteraction(tx, {
      userId,
      contactId,
      kind,
      direction: 'outbound',
      ...day,
      note,
    });
    const pushed = await pushFollowUpBack(tx, userId, contactId);
    return { retained: { interactionId, pushed }, touched: touchedContact(contactId) };
  },
  retained: interactionNoted,
  async inverse(tx, { userId, subjectId: contactId, retained: { interactionId, pushed } }) {
    if (pushed) await restoreFollowUpDay(tx, userId, pushed);
    await removeInteraction(tx, userId, interactionId);
    return touchedContact(contactId);
  },
};

/**
 * What “Replied…” retains: the reply, the Follow-up it canceled or took off the Cadence (with its
 * rank), the change of Status it made.
 */
const replyRecorded = z.object({
  interactionId: z.uuid(),
  canceledFollowUpId: z.uuid().optional(),
  // Absent from the gestures recorded before the Cadence.
  unranked: z.object({ followUpId: z.uuid(), rank: z.int() }).optional(),
  statusChanged: statusChanged.optional(),
});

/**
 * Replied… (spec UX §6.2): an inbound Interaction, with no nature (ADR 0005). It stops the Cadence: a
 * Follow-up kept is off it from now on. Spontaneous, from the Pool or Archived, it may bring the
 * Contact in or add it to the Circle, dated now (ST-39).
 */
const recordReply: Gesture<
  'reply_recorded',
  ContactPlace,
  z.infer<typeof recordReplyRequest>,
  z.infer<typeof replyRecorded>,
  | 'no_status_choice'
  | 'future_day'
  | 'no_follow_up'
  | 'same_status'
  | 'stage_required'
  | 'unknown_stage'
  | 'trial_in_progress'
> = {
  kind: 'reply_recorded',
  subject: contactSubject,
  async refuse({ subject, input: { status } }) {
    // Only out of the Funnel and of the Circle is there a choice of Status (spec UX §6.2).
    if (status !== undefined && !isPoolOrArchived(subject.status)) {
      return refusal('no_status_choice');
    }
    return undefined;
  },
  async write({ tx, userId, subjectId: contactId, subject, input, now }) {
    const {
      occurredOn,
      channel,
      note = null,
      cancelFollowUp: cancelsFollowUp = false,
      status,
      stageId,
    } = input;
    const day = await dayEntered(tx, userId, occurredOn, now);
    if ('error' in day) return day;
    const scheduled = await scheduledFollowUp(tx, userId, contactId);
    if (cancelsFollowUp && !scheduled) return refusal('no_follow_up');
    const canceled = cancelsFollowUp ? scheduled : undefined;
    if (canceled) await setFollowUpStatus(tx, userId, canceled.id, 'canceled');
    const unranked =
      !cancelsFollowUp && scheduled?.rank != null
        ? { followUpId: scheduled.id, rank: scheduled.rank }
        : undefined;
    if (unranked) await setFollowUpRank(tx, userId, unranked.followUpId, null);
    const interactionId = await recordInteraction(tx, {
      userId,
      contactId,
      kind: 'reply',
      direction: 'inbound',
      ...day,
      note,
      channel,
    });
    const changed =
      status === undefined
        ? undefined
        : await writeStatusChange(tx, userId, contactId, subject, { status, stageId }, now);
    if (changed && 'error' in changed) return changed;
    return {
      retained: {
        interactionId,
        canceledFollowUpId: canceled?.id,
        unranked,
        statusChanged: changed,
      },
      touched: touchedContact(contactId),
    };
  },
  retained: replyRecorded,
  /** The reply leaves no trace, the Follow-up comes back with its rank, the Status too. */
  async inverse(tx, { userId, subjectId: contactId, retained }) {
    const { interactionId, canceledFollowUpId, unranked, statusChanged: changed } = retained;
    if (changed && !(await canRestoreStatus(tx, userId, contactId, changed))) return 'superseded';
    if (changed) await takeBackStatusChange(tx, userId, contactId, changed);
    await removeInteraction(tx, userId, interactionId);
    if (canceledFollowUpId !== undefined) {
      await setFollowUpStatus(tx, userId, canceledFollowUpId, 'scheduled');
    }
    if (unranked) await setFollowUpRank(tx, userId, unranked.followUpId, unranked.rank);
    return touchedContact(contactId);
  },
};

/**
 * What “Use a Positioning” retains: the Interaction it recorded, the first Follow-up it scheduled and
 * the one it replaced, the change of Status that brought the Contact in.
 */
const positioningUsed = z.object({
  interactionId: z.uuid(),
  positioningId: z.uuid(),
  scheduledFollowUpId: z.uuid().optional(),
  canceledFollowUpId: z.uuid().optional(),
  statusChanged: statusChanged.optional(),
  // The Trial it started, and its Battle.
  trial: z.object({ id: z.uuid(), battleId: z.uuid() }).optional(),
});

/**
 * Use a Positioning (spec UX §6.1): an outbound Interaction that names it, dated the day it was sent
 * (ST-36), a Prospecting action. For a Contact Prospecting, at the Stage of the Positioning, it starts
 * the Cadence: its first Follow-up replaces the one scheduled; and in the open Battle of that Stage,
 * a Trial, with an Override when it is not the Positioning assigned. An Ally keeps its own Follow-up;
 * a Contact of the Pool or Archived, unless brought in first, has none.
 */
const usePositioning: Gesture<
  'positioning_used',
  ContactPlace,
  z.infer<typeof usePositioningRequest>,
  z.infer<typeof positioningUsed>,
  | 'future_day'
  | 'past_day'
  | 'unknown_positioning'
  | 'archived'
  | 'other_stage'
  | 'no_status_choice'
  | 'no_follow_up'
  | 'same_status'
  | 'stage_required'
  | 'unknown_stage'
  | 'trial_in_progress'
  | 'assignment_required'
> = {
  kind: 'positioning_used',
  subject: contactSubject,
  async refuse({ subject, input: { bringIn = false } }) {
    // Only out of the Funnel and of the Circle is there a way in first (spec UX §6.1).
    return bringIn && !isPoolOrArchived(subject.status) ? refusal('no_status_choice') : undefined;
  },
  async write({ tx, userId, subjectId: contactId, subject, input, now }) {
    const { positioningId, occurredOn, followUpOn, bringIn = false, overrideReason } = input;
    const day = await dayEntered(tx, userId, occurredOn, now);
    if ('error' in day) return day;
    const used = await positioningToUse(tx, userId, positioningId);
    if (!used) return refusal('unknown_positioning');
    if (used.archived) return refusal('archived');
    // A Contact Prospecting is sent what its own Stage offers.
    if (subject.status === 'prospecting' && used.stageId !== subject.stageId) {
      return refusal('other_stage');
    }
    // Only a Contact Prospecting has a Follow-up of the Cadence (CONTEXT.md, Status).
    const isProspecting = bringIn || subject.status === 'prospecting';
    const firstOn = isProspecting ? firstFollowUpOn(occurredOn, used.followUpDays) : undefined;
    if (followUpOn !== undefined) {
      if (firstOn === undefined) return refusal('no_follow_up');
      if (followUpOn < (await localDateOf(tx, userId, now))) return refusal('past_day');
    }
    // Only a Contact Prospecting starts a Trial (CONTEXT.md, Trial), at the Stage of the Positioning.
    const toStart = isProspecting
      ? await trialToStart(tx, { userId, contactId, stageId: used.stageId }, positioningId)
      : undefined;
    if (toStart && 'error' in toStart) return toStart;
    const changed = bringIn
      ? await writeStatusChange(
          tx,
          userId,
          contactId,
          subject,
          { status: 'prospecting', stageId: used.stageId },
          now,
        )
      : undefined;
    if (changed && 'error' in changed) return changed;
    const interactionId = await recordInteraction(tx, {
      userId,
      contactId,
      kind: 'positioning_used',
      direction: 'outbound',
      ...day,
      positioningId,
    });
    const trialId =
      toStart &&
      (await startTrial(tx, {
        userId,
        contactId,
        positioningId,
        interactionId,
        ...toStart,
        overrideReason: toStart.overridden ? (overrideReason ?? null) : null,
      }));
    const dueOn = followUpOn ?? firstOn;
    let replaced: Awaited<ReturnType<typeof scheduledFollowUp>>;
    let scheduledFollowUpId: string | undefined;
    if (dueOn !== undefined) {
      replaced = await scheduledFollowUp(tx, userId, contactId);
      if (replaced) await setFollowUpStatus(tx, userId, replaced.id, 'canceled');
      const [scheduled] = await tx
        .insert(followUp)
        .values({ userId, contactId, status: 'scheduled', dueOn, rank: 1, scheduledAt: now })
        .returning({ id: followUp.id });
      if (!scheduled) throw new Error('A Follow-up was not scheduled');
      scheduledFollowUpId = scheduled.id;
    }
    return {
      retained: {
        interactionId,
        positioningId,
        scheduledFollowUpId,
        canceledFollowUpId: replaced?.id,
        statusChanged: changed,
        trial: toStart && trialId ? { id: trialId, battleId: toStart.battleId } : undefined,
      },
      touched: touched({
        contactIds: [contactId],
        positioningIds: [positioningId],
        battleIds: toStart ? [toStart.battleId] : [],
      }),
    };
  },
  retained: positioningUsed,
  /**
   * The use leaves no trace, nor its Follow-up or its Trial; the Follow-up it replaced comes back, the
   * Status too. The Assignment stays (ADR 0011).
   */
  async inverse(tx, { userId, subjectId: contactId, retained }) {
    const { interactionId, positioningId, scheduledFollowUpId, canceledFollowUpId, trial } =
      retained;
    const changed = retained.statusChanged;
    if (changed && !(await canRestoreStatus(tx, userId, contactId, changed))) return 'superseded';
    if (scheduledFollowUpId !== undefined) {
      await tx
        .delete(followUp)
        .where(and(eq(followUp.userId, userId), eq(followUp.id, scheduledFollowUpId)));
    }
    if (canceledFollowUpId !== undefined) {
      await setFollowUpStatus(tx, userId, canceledFollowUpId, 'scheduled');
    }
    if (trial) await removeTrial(tx, userId, trial.id);
    await removeInteraction(tx, userId, interactionId);
    if (changed) await takeBackStatusChange(tx, userId, contactId, changed);
    return touched({
      contactIds: [contactId],
      positioningIds: [positioningId],
      battleIds: trial ? [trial.battleId] : [],
    });
  },
};

/**
 * The gestures of the Contact (spec stack §5.2, §5.4): one endpoint each, through the common circuit,
 * which answers with the rows of the summary it changed and the token that undoes it.
 */
export function createProspecting<Changes>({
  clock,
  random,
  requireUser,
  changesOf,
}: {
  clock: Clock;
  random: Random;
  requireUser: RequireUser;
  changesOf: ChangesOf<Changes>;
}) {
  const { perform, create } = createCircuit({ clock, changesOf });
  const routes = new Hono<AppEnv>()
    .post('/contacts', requireUser, jsonBody(addContactRequest), (c) =>
      create(c, addContact, c.req.valid('json')),
    )
    .post('/contacts/:id/edit', requireUser, jsonBody(editContactRequest), (c) =>
      perform(c, editContact, c.req.valid('json')),
    )
    .post('/contacts/:id/change-status', requireUser, jsonBody(changeStatusRequest), (c) =>
      perform(c, changeContactStatus, c.req.valid('json')),
    )
    // Schedule a follow-up, or Edit the follow-up (spec UX §6.5): off the Cadence when there was none.
    .post(
      '/contacts/:id/schedule-follow-up',
      requireUser,
      jsonBody(scheduleFollowUpRequest),
      (c) => {
        const { dueOn, note = null } = c.req.valid('json');
        return perform(c, scheduleFollowUp, { dueOn, note });
      },
    )
    .post('/contacts/:id/cancel-follow-up', requireUser, (c) =>
      perform(c, cancelFollowUp, undefined),
    )
    .post('/contacts/:id/follow-up', requireUser, jsonBody(followUpRequest), (c) => {
      const { occurredOn, note = null } = c.req.valid('json');
      return perform(c, recordFollowUp, { occurredOn, note });
    })
    .post('/contacts/:id/note-interaction', requireUser, jsonBody(noteInteractionRequest), (c) =>
      perform(c, noteInteraction, c.req.valid('json')),
    )
    .post('/contacts/:id/record-reply', requireUser, jsonBody(recordReplyRequest), (c) =>
      perform(c, recordReply, c.req.valid('json')),
    )
    .post('/contacts/:id/use-positioning', requireUser, jsonBody(usePositioningRequest), (c) =>
      perform(c, usePositioning, c.req.valid('json')),
    )
    // Reveal the Assignment (spec UX §6.1): opening “Send to” at a Stage with an open Battle. Not a
    // gesture: nothing takes it back, it stays reserved (ADR 0002).
    .post('/contacts/:id/reveal-assignment', requireUser, async (c) => {
      const { userId } = c.var;
      const contactId = idOf(c.req.param('id'));
      // Another User's Contact, an unknown one and an id that is none answer alike.
      if (contactId === null) return answerRefusal(c, refusal('not_found'));
      const now = clock.now();
      const outcome = await withUser(userId, async (tx) => {
        // One at a time with the gestures on the Contact: a change of Status is seen, or waits.
        await lockSubject(tx, contactId);
        const place = await contactSubject.load(tx, userId, contactId);
        if (!place) return refusal('not_found');
        if (place.status !== 'prospecting' || place.stageId === null) {
          return refusal('not_in_battle');
        }
        const revealed = await revealAssignment(
          tx,
          { userId, contactId, stageId: place.stageId },
          { now, random },
        );
        if (revealed === 'not_in_battle') return refusal(revealed);
        const { battleId, ...answer } = revealed;
        const changes = await changesOf(
          tx,
          userId,
          touched({ contactIds: [contactId], battleIds: [battleId] }),
        );
        return { changes, ...answer };
      });
      if ('error' in outcome) return answerRefusal(c, outcome);
      return c.json(outcome, 200);
    });

  const gestures = [
    addContact,
    editContact,
    changeContactStatus,
    scheduleFollowUp,
    cancelFollowUp,
    recordFollowUp,
    noteInteraction,
    recordReply,
    usePositioning,
  ] as const;
  return { routes, gestures };
}
