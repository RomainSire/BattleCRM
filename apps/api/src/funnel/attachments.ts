import { ATTACHMENTS_MAX_BYTES_PER_USER } from '@battlecrm/contract';
import { and, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';

import type { Transaction } from '../db/index.ts';
import { UNDO_WINDOW_MS } from '../gestures/index.ts';
import { databaseStorage } from './attachment-storage.ts';
import { positioningAttachment } from './tables.ts';

const storage = databaseStorage;

/** A file as the User joins it. */
export type JoinedFile = { name: string; contentType: string; data: Uint8Array };

const live = (userId: string) =>
  and(eq(positioningAttachment.userId, userId), isNull(positioningAttachment.removedAt));

/** The bytes of the attachments not removed of the User, or of one of its Positionings. */
async function bytesOf(tx: Transaction, userId: string, positioningId?: string) {
  const [counted] = await tx
    .select({ bytes: sql<number>`coalesce(sum(${positioningAttachment.size}), 0)`.mapWith(Number) })
    .from(positioningAttachment)
    .where(
      and(
        live(userId),
        positioningId === undefined
          ? undefined
          : eq(positioningAttachment.positioningId, positioningId),
      ),
    );
  return counted?.bytes ?? 0;
}

/**
 * Whether `adding` more bytes keeps the User within its room: its attachments not removed count.
 * One count at a time per User, until the transaction ends: two files joined at once to two
 * Positionings never both take the last of the room.
 */
async function hasRoomFor(tx: Transaction, userId: string, adding: number) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`attachments:${userId}`}, 0))`,
  );
  return (await bytesOf(tx, userId)) + adding <= ATTACHMENTS_MAX_BYTES_PER_USER;
}

/** Joins a file to a Positioning, within the room of the User; its id, or `quota_exceeded`. */
export async function attach(
  tx: Transaction,
  {
    userId,
    positioningId,
    file,
    now,
  }: { userId: string; positioningId: string; file: JoinedFile; now: Date },
): Promise<{ attachmentId: string } | 'quota_exceeded'> {
  if (!(await hasRoomFor(tx, userId, file.data.byteLength))) return 'quota_exceeded';
  const blobId = await storage.put(tx, userId, file.data);
  const [joined] = await tx
    .insert(positioningAttachment)
    .values({
      userId,
      positioningId,
      blobId,
      name: file.name,
      contentType: file.contentType,
      size: file.data.byteLength,
      addedAt: now,
    })
    .returning({ id: positioningAttachment.id });
  if (!joined) throw new Error('An attachment was not joined');
  return { attachmentId: joined.id };
}

/**
 * Whether the attachments of a Positioning fit in the room of the User once more: what a modified
 * copy of it would take.
 */
export async function hasRoomForCopyOf(tx: Transaction, userId: string, positioningId: string) {
  return hasRoomFor(tx, userId, await bytesOf(tx, userId, positioningId));
}

/** A modified copy takes the attachments of its original, each a file of its own. */
export async function copyAttachments(
  tx: Transaction,
  { userId, fromId, toId, now }: { userId: string; fromId: string; toId: string; now: Date },
) {
  const originals = await tx
    .select()
    .from(positioningAttachment)
    .where(and(live(userId), eq(positioningAttachment.positioningId, fromId)))
    .orderBy(positioningAttachment.id);
  for (const { blobId, name, contentType, size } of originals) {
    const data = await storage.get(tx, userId, blobId);
    if (!data) throw new Error('An attachment has no bytes');
    const copiedBlobId = await storage.put(tx, userId, data);
    await tx.insert(positioningAttachment).values({
      userId,
      positioningId: toId,
      blobId: copiedBlobId,
      name,
      contentType,
      size,
      addedAt: now,
    });
  }
}

/** The Positioning an attachment not removed is joined to, if the User has it. */
export async function positioningOfAttachment(
  tx: Transaction,
  userId: string,
  attachmentId: string,
): Promise<string | undefined> {
  const [found] = await tx
    .select({ positioningId: positioningAttachment.positioningId })
    .from(positioningAttachment)
    .where(and(live(userId), eq(positioningAttachment.id, attachmentId)));
  return found?.positioningId;
}

/** An attachment not removed, its bytes read from the storage: what a download serves. */
export async function readAttachment(tx: Transaction, userId: string, attachmentId: string) {
  const [found] = await tx
    .select()
    .from(positioningAttachment)
    .where(and(live(userId), eq(positioningAttachment.id, attachmentId)));
  if (!found) return undefined;
  const data = await storage.get(tx, userId, found.blobId);
  if (!data) throw new Error('An attachment has no bytes');
  return { name: found.name, contentType: found.contentType, data };
}

/**
 * Removes attachments not removed yet, the ones named or all those of a Positioning: kept for “Undo”
 * until purged. Returns the ids removed.
 */
export async function removeAttachments(
  tx: Transaction,
  {
    userId,
    now,
    ...which
  }: { userId: string; now: Date } & ({ attachmentIds: string[] } | { positioningId: string }),
): Promise<string[]> {
  const removed = await tx
    .update(positioningAttachment)
    .set({ removedAt: now })
    .where(
      and(
        live(userId),
        'positioningId' in which
          ? eq(positioningAttachment.positioningId, which.positioningId)
          : inArray(positioningAttachment.id, which.attachmentIds),
      ),
    )
    .returning({ id: positioningAttachment.id });
  return removed.map(({ id }) => id);
}

/** Brings removed attachments back, for “Undo”; returns how many came back. */
export async function restoreAttachments(tx: Transaction, userId: string, attachmentIds: string[]) {
  if (attachmentIds.length === 0) return 0;
  const restored = await tx
    .update(positioningAttachment)
    .set({ removedAt: null })
    .where(
      and(
        eq(positioningAttachment.userId, userId),
        inArray(positioningAttachment.id, attachmentIds),
        isNotNull(positioningAttachment.removedAt),
      ),
    )
    .returning({ id: positioningAttachment.id });
  return restored.length;
}

/** Erases attachments for good, bytes included: what “Undo” of their addition does. */
async function erase(tx: Transaction, userId: string, where: ReturnType<typeof and>) {
  const erased = await tx
    .delete(positioningAttachment)
    .where(and(eq(positioningAttachment.userId, userId), where))
    .returning({ blobId: positioningAttachment.blobId });
  await storage.delete(
    tx,
    userId,
    erased.map(({ blobId }) => blobId),
  );
}

export const eraseAttachment = (tx: Transaction, userId: string, attachmentId: string) =>
  erase(tx, userId, eq(positioningAttachment.id, attachmentId));

/** Every attachment of a Positioning, for a creation “Undo” takes back. */
export const eraseAttachmentsOf = (tx: Transaction, userId: string, positioningId: string) =>
  erase(tx, userId, eq(positioningAttachment.positioningId, positioningId));

/**
 * The attachments removed longer ago than “Undo” may reach go for good, on the way of each gesture
 * of the workshop: no job could, under row level security.
 */
export const purgeRemovedAttachments = (tx: Transaction, userId: string, now: Date) =>
  erase(tx, userId, lt(positioningAttachment.removedAt, new Date(now.getTime() - UNDO_WINDOW_MS)));
