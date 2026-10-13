import { CONTACT_NAME_MAX_LENGTH } from '@battlecrm/contract';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { RequireUser } from '../auth/index.ts';
import type { Clock } from '../clock.ts';
import { withUser } from '../db/index.ts';
import { recordGesture, type ChangesOf, type Inverse, type Inverses } from '../gestures/index.ts';
import { jsonBody } from '../json-body.ts';
import { localDateOf } from '../settings/index.ts';
import { contact, interaction } from './tables.ts';

// Read by `views`, which never writes them.
export { contact, interaction } from './tables.ts';

const addContactRequest = z.object({ name: z.string().trim().min(1).max(CONTACT_NAME_MAX_LENGTH) });

/** What the inverse of an addition needs: the Interaction the gesture wrote. */
const contactAdded = z.object({ interactionId: z.uuid() });

/** Takes an addition back: the Contact and the Interaction that recorded it leave no trace (ADR 0011). */
const removeAddedContact: Inverse = async (tx, { userId, contactId, payload }) => {
  const { interactionId } = contactAdded.parse(payload);
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
    // A new Contact joins the Pool; only its name is asked (spec UX §6.8).
    .post('/contacts', requireUser, jsonBody(addContactRequest), async (c) => {
      const { userId } = c.var;
      const { name } = c.req.valid('json');
      const now = clock.now();
      const answer = await withUser(userId, async (tx) => {
        const [added] = await tx
          .insert(contact)
          .values({ userId, name, status: 'pool', createdAt: now })
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
      return c.json(answer, 201);
    });

  const inverses = { contact_added: removeAddedContact } satisfies Partial<Inverses>;
  return { routes, inverses };
}
