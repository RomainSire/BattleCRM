import {
  ADDABLE_CONTACT_STATUSES,
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_JOB_TITLE_MAX_LENGTH,
  CONTACT_LINKEDIN_URL_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_NOTE_MAX_LENGTH,
  CONTACT_PHONE_MAX_LENGTH,
  CONTACT_STATUSES,
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_TYPES,
  STATUS_REASON_MAX_LENGTH,
} from '@battlecrm/contract';
import { normalizeLinkedInUrl } from '@battlecrm/domain';
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
import { contact, interaction, statusChange } from './tables.ts';

// Read by `views`, which never writes them.
export { contact, interaction, statusChange } from './tables.ts';

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
          | 'organization_taken';
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
});

/**
 * Takes a change of Status back: the Contact gets its Status and its Stage back, and the change leaves
 * no trace, no Funnel entry either (ST-39). Refused when it would put the Contact back Prospecting at
 * a Stage archived since: only a Contact of another Status may keep one.
 */
const restoreStatus: Inverse = async (tx, { userId, contactId, payload }) => {
  const { interactionId, before } = statusChanged.parse(payload);
  if (
    before.status === 'prospecting' &&
    !(await stageOrder(tx, userId)).some(({ id }) => id === before.stageId)
  ) {
    return 'superseded';
  }
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
  return {
    contactIds: [contactId],
    removedContactIds: [],
    organizationIds: [],
    removedOrganizationIds: [],
  };
};

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
      const { status, stageId, reason } = c.req.valid('json');
      const now = clock.now();
      const answer = await withUser(userId, async (tx) => {
        await lockContact(tx, contactId);
        const [before] = await tx
          .select({ status: contact.status, stageId: contact.stageId })
          .from(contact)
          .where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
        if (!before) throw new Refusal(404, { error: 'not_found' });
        if (before.status === status) throw new Refusal(409, { error: 'same_status' });
        // Out of Prospecting, the Contact keeps the last Stage it reached: where it left the Funnel.
        let stageAfter = before.stageId;
        if (status === 'prospecting') {
          // The last Stage reached unless one is chosen; never an archived one.
          const wanted = stageId ?? before.stageId;
          const entered = (await stageOrder(tx, userId)).find((stage) => stage.id === wanted);
          if (!entered) {
            throw new Refusal(400, {
              error: stageId === undefined ? 'stage_required' : 'unknown_stage',
            });
          }
          stageAfter = entered.id;
        }
        await tx
          .update(contact)
          .set({ status, stageId: stageAfter })
          .where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
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
        const undoToken = await recordGesture(tx, {
          userId,
          kind: 'status_changed',
          contactId,
          payload: { interactionId: recorded.id, before } satisfies z.infer<typeof statusChanged>,
          now,
        });
        const changes = await changesOf(tx, userId, {
          contactIds: [contactId],
          removedContactIds: [],
          organizationIds: [],
          removedOrganizationIds: [],
        });
        return { changes, undoToken };
      }).catch((error: unknown) => {
        if (error instanceof Refusal) return error;
        throw error;
      });
      if (answer instanceof Refusal) return c.json(answer.body, answer.status);
      return c.json(answer, 200);
    });

  const inverses = {
    contact_added: removeAddedContact,
    contact_edited: restoreEditedContact,
    status_changed: restoreStatus,
  } satisfies Inverses;
  return { routes, inverses };
}
