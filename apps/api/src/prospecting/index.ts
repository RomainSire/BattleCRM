import { ADDABLE_CONTACT_STATUSES, CONTACT_NAME_MAX_LENGTH } from '@battlecrm/contract';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { RequireUser } from '../auth/index.ts';
import type { Clock } from '../clock.ts';
import { withUser } from '../db/index.ts';
import { stageOrder } from '../funnel/index.ts';
import { recordGesture, type ChangesOf, type Inverse, type Inverses } from '../gestures/index.ts';
import { jsonBody } from '../json-body.ts';
import { localDateOf } from '../settings/index.ts';
import { contact, interaction, statusChange } from './tables.ts';

// Read by `views`, which never writes them.
export { contact, interaction, statusChange } from './tables.ts';

/** In the Pool by default; a Stage is chosen for Prospecting only (spec UX §6.8). */
const addContactRequest = z
  .object({
    name: z.string().trim().min(1).max(CONTACT_NAME_MAX_LENGTH),
    status: z.enum(ADDABLE_CONTACT_STATUSES).default('pool'),
    stageId: z.uuid().optional(),
  })
  .refine(({ status, stageId }) => stageId === undefined || status === 'prospecting', {
    path: ['stageId'],
  });

/** What the inverse of an addition needs: the Interaction the gesture wrote. */
const contactAdded = z.object({ interactionId: z.uuid() });

/** Takes an addition back: the Contact and the Interaction that recorded it leave no trace (ADR 0011). */
const removeAddedContact: Inverse = async (tx, { userId, contactId, payload }) => {
  const { interactionId } = contactAdded.parse(payload);
  // Added Prospecting, it leaves no Funnel entry (ST-39).
  await tx
    .delete(statusChange)
    .where(and(eq(statusChange.userId, userId), eq(statusChange.interactionId, interactionId)));
  await tx
    .delete(interaction)
    .where(and(eq(interaction.userId, userId), eq(interaction.id, interactionId)));
  await tx.delete(contact).where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
  return { contactIds: [], removedContactIds: [contactId] };
};

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
      const { name, status, stageId } = c.req.valid('json');
      const now = clock.now();
      const answer = await withUser(userId, async (tx) => {
        let enteredStageId: string | null = null;
        if (status === 'prospecting') {
          // The first Stage not archived unless one is chosen; the ones before it are not skipped.
          const stages = await stageOrder(tx, userId);
          const entered =
            stageId === undefined ? stages[0] : stages.find(({ id }) => id === stageId);
          if (!entered) return { refused: 'unknown_stage' as const };
          enteredStageId = entered.id;
        }
        const [added] = await tx
          .insert(contact)
          .values({ userId, name, status, stageId: enteredStageId, createdAt: now })
          .returning({ id: contact.id });
        if (!added) throw new Error('A Contact was not added');
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
          payload: { interactionId: recorded.id } satisfies z.infer<typeof contactAdded>,
          now,
        });
        const changes = await changesOf(tx, userId, {
          contactIds: [added.id],
          removedContactIds: [],
        });
        return { changes, undoToken };
      });
      if ('refused' in answer) return c.json({ error: answer.refused }, 400);
      return c.json(answer, 201);
    });

  const inverses = { contact_added: removeAddedContact } satisfies Partial<Inverses>;
  return { routes, inverses };
}
