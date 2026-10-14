import {
  ADDABLE_CONTACT_STATUSES,
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_JOB_TITLE_MAX_LENGTH,
  CONTACT_LINKEDIN_URL_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_NOTE_MAX_LENGTH,
  CONTACT_PHONE_MAX_LENGTH,
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_TYPES,
} from '@battlecrm/contract';
import { normalizeLinkedInUrl } from '@battlecrm/domain';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { RequireUser } from '../auth/index.ts';
import type { Clock } from '../clock.ts';
import { withUser, type Transaction } from '../db/index.ts';
import { stageOrder } from '../funnel/index.ts';
import { recordGesture, type ChangesOf, type Inverse, type Inverses } from '../gestures/index.ts';
import { jsonBody } from '../json-body.ts';
import {
  createOrganization,
  deleteOrganization,
  isOrganizationOf,
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
 * In the Pool by default; a Stage is chosen for Prospecting only. At most one Organization: one of
 * the User's, or a new one with its type (spec UX §6.8).
 */
const addContactRequest = z
  .object({
    name: z.string().trim().min(1).max(CONTACT_NAME_MAX_LENGTH),
    status: z.enum(ADDABLE_CONTACT_STATUSES).default('pool'),
    stageId: z.uuid().optional(),
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
  })
  .refine(({ status, stageId }) => stageId === undefined || status === 'prospecting', {
    path: ['stageId'],
  })
  .refine((body) => body.organizationId === undefined || body.newOrganization === undefined, {
    path: ['newOrganization'],
  });

/**
 * A gesture the data refuses, possibly after it wrote: thrown so that its transaction rolls back,
 * then answered.
 */
class Refusal extends Error {
  readonly status: 400 | 409;
  readonly body:
    | { error: 'unknown_stage' | 'unknown_organization' | 'organization_taken' }
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
  const removedOrganizationIds: string[] = [];
  if (createdOrganizationId !== undefined) {
    const [member] = await tx
      .select({ id: contact.id })
      .from(contact)
      .where(and(eq(contact.userId, userId), eq(contact.organizationId, createdOrganizationId)))
      .limit(1);
    if (!member) {
      await deleteOrganization(tx, userId, createdOrganizationId);
      removedOrganizationIds.push(createdOrganizationId);
    }
  }
  return {
    contactIds: [],
    removedContactIds: [contactId],
    organizationIds: [],
    removedOrganizationIds,
  };
};

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
        if (organizationId !== undefined && !(await isOrganizationOf(tx, userId, organizationId))) {
          throw new Refusal(400, { error: 'unknown_organization' });
        }
        const createdOrganizationId =
          newOrganization && (await createOrganization(tx, userId, newOrganization));
        if (createdOrganizationId === null) {
          throw new Refusal(409, { error: 'organization_taken' });
        }
        // The unique index decides (ST-64): another addition may have taken the profile meanwhile.
        const [added] = await tx
          .insert(contact)
          .values({
            userId,
            ...fields,
            status,
            stageId: enteredStageId,
            organizationId: organizationId ?? createdOrganizationId,
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
    });

  const inverses = { contact_added: removeAddedContact } satisfies Partial<Inverses>;
  return { routes, inverses };
}
