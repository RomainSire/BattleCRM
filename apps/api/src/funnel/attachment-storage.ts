import { and, eq, inArray } from 'drizzle-orm';

import type { Transaction } from '../db/index.ts';
import { attachmentBlob } from './tables.ts';

/**
 * Where the bytes of the attachments live (spec stack §6): the database today, in the transaction of
 * the gesture; another store, such as S3, could take its place behind the same three calls.
 */
export type AttachmentStorage = {
  /** Keeps the bytes, and returns the key that reads them back. */
  put(tx: Transaction, userId: string, data: Uint8Array): Promise<string>;
  /** The bytes under a key of the User, `undefined` for any other key. */
  get(tx: Transaction, userId: string, key: string): Promise<Uint8Array | undefined>;
  delete(tx: Transaction, userId: string, keys: string[]): Promise<void>;
};

/** The bytes in `attachment_blob`, under row level security like any business row. */
export const databaseStorage: AttachmentStorage = {
  async put(tx, userId, data) {
    const [kept] = await tx
      .insert(attachmentBlob)
      .values({ userId, data })
      .returning({ id: attachmentBlob.id });
    if (!kept) throw new Error('An attachment was not stored');
    return kept.id;
  },
  async get(tx, userId, key) {
    const [found] = await tx
      .select({ data: attachmentBlob.data })
      .from(attachmentBlob)
      .where(and(eq(attachmentBlob.userId, userId), eq(attachmentBlob.id, key)));
    return found?.data;
  },
  async delete(tx, userId, keys) {
    if (keys.length === 0) return;
    await tx
      .delete(attachmentBlob)
      .where(and(eq(attachmentBlob.userId, userId), inArray(attachmentBlob.id, keys)));
  },
};
