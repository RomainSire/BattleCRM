import { daysBetween } from '@battlecrm/domain';
import { and, eq } from 'drizzle-orm';

import type { Transaction } from '../db/index.ts';
import { refusal } from '../refusals.ts';
import { localDateOf } from '../settings/index.ts';
import { interaction } from './tables.ts';

/** Records an Interaction of a Contact: its id. */
export async function recordInteraction(tx: Transaction, values: typeof interaction.$inferInsert) {
  const [recorded] = await tx.insert(interaction).values(values).returning({ id: interaction.id });
  if (!recorded) throw new Error('An Interaction was not recorded');
  return recorded.id;
}

/** Records an Interaction neither outbound nor inbound, written down now (ST-39): its id. */
export async function recordInteractionNow(
  tx: Transaction,
  {
    userId,
    contactId,
    kind,
  }: { userId: string; contactId: string; kind: 'contact_added' | 'status_changed' },
  now: Date,
) {
  return recordInteraction(tx, {
    userId,
    contactId,
    kind,
    direction: 'none',
    occurredAt: now,
    localDate: await localDateOf(tx, userId, now),
    recordedAt: now,
  });
}

/** Takes back an Interaction a gesture recorded. */
export const removeInteraction = (tx: Transaction, userId: string, interactionId: string) =>
  tx
    .delete(interaction)
    .where(and(eq(interaction.userId, userId), eq(interaction.id, interactionId)));

/**
 * When an Interaction the User dated happened (ST-36): its local day is the one entered, today or
 * earlier; its instant, which only orders the thread, as many days before now.
 */
export async function dayEntered(tx: Transaction, userId: string, occurredOn: string, now: Date) {
  const today = await localDateOf(tx, userId, now);
  if (occurredOn > today) return refusal('future_day');
  return {
    occurredAt: new Date(now.getTime() - daysBetween(occurredOn, today) * 86_400_000),
    localDate: occurredOn,
    recordedAt: now,
  };
}

/** The day an Interaction the User dated happened, once accepted. */
export type EnteredDay = Exclude<Awaited<ReturnType<typeof dayEntered>>, { error: unknown }>;
