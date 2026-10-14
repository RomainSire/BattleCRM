import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { Hono } from 'hono';

import type { AppEnv } from '../app.ts';
import type { RequireUser } from '../auth/index.ts';
import { withUser, type Transaction } from '../db/index.ts';
import { FUNNEL_ORDER, stage } from '../funnel/index.ts';
import type { Touched } from '../gestures/index.ts';
import { contact, interaction } from '../prospecting/index.ts';

/**
 * The Contacts of the working summary (ADR 0012), the latest Interaction first: all of them, or the
 * ones a gesture touched.
 */
async function summaryContacts(tx: Transaction, userId: string, ids?: string[]) {
  if (ids?.length === 0) return [];
  const latest = tx
    .selectDistinctOn([interaction.contactId], {
      contactId: interaction.contactId,
      occurredAt: interaction.occurredAt,
      localDate: interaction.localDate,
    })
    .from(interaction)
    .where(and(eq(interaction.userId, userId), ids && inArray(interaction.contactId, ids)))
    .orderBy(interaction.contactId, desc(interaction.occurredAt), desc(interaction.id))
    .as('latest');
  const rows = await tx
    .select({
      id: contact.id,
      name: contact.name,
      status: contact.status,
      stageId: contact.stageId,
      lastInteractionAt: latest.occurredAt,
      lastInteractionOn: latest.localDate,
    })
    .from(contact)
    .innerJoin(latest, eq(latest.contactId, contact.id))
    .where(and(eq(contact.userId, userId), ids && inArray(contact.id, ids)))
    .orderBy(desc(latest.occurredAt), desc(contact.id));
  return rows.map((row) => ({ ...row, lastInteractionAt: row.lastInteractionAt.toISOString() }));
}

/** Every Stage of the User, archived ones too: a Contact may keep one as the last it reached. In the order of the Funnel. */
const summaryStages = (tx: Transaction, userId: string) =>
  tx
    .select({
      id: stage.id,
      name: stage.name,
      aim: stage.aim,
      archived: isNotNull(stage.archivedAt).mapWith(Boolean),
    })
    .from(stage)
    .where(eq(stage.userId, userId))
    .orderBy(...FUNNEL_ORDER);

/** What the answer of a gesture carries: the rows of the summary it changed, and the ones it removed. */
export async function summaryChanges(tx: Transaction, userId: string, touched: Touched) {
  return {
    contacts: await summaryContacts(tx, userId, touched.contactIds),
    removedContactIds: touched.removedContactIds,
  };
}

/** The reads, one per view (spec stack §5.2): this module reads the tables of the others and writes none of them. */
export function createViews({ requireUser }: { requireUser: RequireUser }) {
  const routes = new Hono<AppEnv>()
    // The whole working summary, in one read; it grows with each ticket (ADR 0012).
    .get('/summary', requireUser, async (c) => {
      const { userId } = c.var;
      const summary = await withUser(userId, async (tx) => ({
        contacts: await summaryContacts(tx, userId),
        stages: await summaryStages(tx, userId),
      }));
      return c.json(summary, 200);
    });
  return { routes };
}
