import { isInFunnel, stageMove } from '@battlecrm/domain';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import type { Transaction } from '../db/index.ts';
import { stageOrder } from '../funnel/index.ts';
import { refusal } from '../refusals.ts';
import type { ContactPlace } from './contact-subject.ts';
import { recordInteractionNow, removeInteraction } from './interactions.ts';
import { contact, stageChange } from './tables.ts';
import { droppedAssignment, dropAssignment, hasAssignment, restoreAssignment } from './trials.ts';

/** What a change of Stage retains: the Interaction that recorded it, the Stage left, the Assignment that fell. */
export const stageChanged = z.object({
  interactionId: z.uuid(),
  fromStageId: z.uuid(),
  droppedAssignment: droppedAssignment.optional(),
});

/**
 * Moves a locked Contact Prospecting to another Stage of the Funnel (spec UX §6.6), dated now (ST-33):
 * an Interaction neither outbound nor inbound, which keeps the positions of both Stages in the Funnel
 * of the moment (ADR 0003). The Assignment falls with the Stage left (ADR 0002). What the inverse
 * needs to take it back.
 */
export async function writeStageChange(
  tx: Transaction,
  userId: string,
  contactId: string,
  before: ContactPlace,
  toStageId: string,
  now: Date,
) {
  // Only a Contact Prospecting changes Stage (CONTEXT.md, Status).
  if (before.status !== 'prospecting' || before.stageId === null) return refusal('not_prospecting');
  if (before.stageId === toStageId) return refusal('same_stage');
  const move = stageMove(await stageOrder(tx, userId), before.stageId, toStageId);
  if (move === undefined) return refusal('unknown_stage');
  await tx
    .update(contact)
    .set({ stageId: toStageId })
    .where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
  const dropped = await dropAssignment(tx, userId, contactId);
  const interactionId = await recordInteractionNow(
    tx,
    { userId, contactId, kind: 'stage_changed' },
    now,
  );
  await tx.insert(stageChange).values({
    userId,
    contactId,
    interactionId,
    fromStageId: before.stageId,
    toStageId,
    fromPosition: move.fromPosition,
    toPosition: move.toPosition,
  });
  return {
    interactionId,
    fromStageId: before.stageId,
    droppedAssignment: dropped,
  } satisfies z.infer<typeof stageChanged>;
}

/**
 * Whether a change of Stage can be taken back: never to a Stage archived since, nor once an
 * Assignment was revealed at the Stage it moved to, which survives “Undo” (ADR 0011).
 */
export async function canRestoreStage(
  tx: Transaction,
  userId: string,
  contactId: string,
  { fromStageId }: z.infer<typeof stageChanged>,
) {
  if (await hasAssignment(tx, userId, contactId)) return false;
  return isInFunnel(await stageOrder(tx, userId), fromStageId);
}

/** Takes a change of Stage back: the Contact at the Stage it left, with its Assignment, never drawn again. */
export async function takeBackStageChange(
  tx: Transaction,
  userId: string,
  contactId: string,
  { interactionId, fromStageId, droppedAssignment: dropped }: z.infer<typeof stageChanged>,
) {
  await tx
    .delete(stageChange)
    .where(and(eq(stageChange.userId, userId), eq(stageChange.interactionId, interactionId)));
  await removeInteraction(tx, userId, interactionId);
  await tx
    .update(contact)
    .set({ stageId: fromStageId })
    .where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
  if (dropped) await restoreAssignment(tx, { userId, contactId, stageId: fromStageId }, dropped);
}
