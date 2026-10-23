import { CHANNELS } from '@battlecrm/contract';
import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// oxlint-disable-next-line no-restricted-imports -- a foreign key to the User: tables files reference each other directly, drizzle-kit loads them alone.
import { user } from '../auth/tables.ts';

/**
 * A Stage of the Funnel of its User. Its identity does not depend on its name: renaming it applies
 * everywhere, history included. Once it has served, it is archived, never deleted.
 */
export const stage = pgTable(
  'stage',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** What gets a Contact past this Stage: free text, optional. */
    aim: text(),
    /** Its place in the Funnel, the smallest first; an archived Stage keeps the one it had. */
    position: integer().notNull(),
    /** Out of the Funnel since then; restored, it is in again. */
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    /**
     * Archived, the Stage that preceded it in the Funnel, `null` when it was the first: restored, it
     * comes back right after it (CONTEXT.md, Stage). No foreign key: that one may be deleted since.
     */
    precededById: uuid('preceded_by_id'),
  },
  (table) => [
    unique('stage_user_id_id_unique').on(table.userId, table.id),
    check('stage_name_check', sql`${table.name} <> ''`),
    check('stage_aim_check', sql`${table.aim} <> ''`),
  ],
);

/**
 * A Positioning (CONTEXT.md): a way to present oneself at one Stage, by one Channel, and its
 * Follow-up cadence, one optional message per rank. A modified copy names the one it is derived from.
 */
export const positioning = pgTable(
  'positioning',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    stageId: uuid('stage_id').notNull(),
    label: text().notNull(),
    channel: text({ enum: CHANNELS }).notNull(),
    /** What is sent, `{prénom}` standing for the first name of the Contact; optional. */
    content: text(),
    /** The intervals of its Follow-up cadence, in days, each counted from the last outbound Interaction done. */
    followUpDays: integer('follow_up_days').array().notNull(),
    /** The message of each rank, `null` for none: as many as intervals. */
    followUpMessages: text('follow_up_messages').array().notNull().$type<(string | null)[]>(),
    responseWindowDays: integer('response_window_days').notNull(),
    /** The Positioning it is a modified copy of, if any. */
    derivedFromId: uuid('derived_from_id'),
    /** Archived since then, by hand or beaten; unarchived, it is available again. */
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    unique('positioning_user_id_id_unique').on(table.userId, table.id),
    foreignKey({
      name: 'positioning_stage_fk',
      columns: [table.userId, table.stageId],
      foreignColumns: [stage.userId, stage.id],
    }),
    foreignKey({
      name: 'positioning_derived_from_fk',
      columns: [table.userId, table.derivedFromId],
      foreignColumns: [table.userId, table.id],
    }),
    check('positioning_label_check', sql`${table.label} <> ''`),
    check('positioning_content_check', sql`${table.content} <> ''`),
    check(
      'positioning_channel_check',
      sql`${table.channel} in (${sql.raw(CHANNELS.map((channel) => `'${channel}'`).join(', '))})`,
    ),
    check(
      'positioning_follow_ups_check',
      sql`cardinality(${table.followUpDays}) = cardinality(${table.followUpMessages}) and 0 < all(${table.followUpDays}) and '' <> all(${table.followUpMessages})`,
    ),
    check('positioning_response_window_days_check', sql`${table.responseWindowDays} > 0`),
    index('positioning_stage_idx').on(table.userId, table.stageId),
  ],
);

/** Bytes, as Postgres keeps them and `pg` reads them back. */
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  toDriver: (data) => Buffer.from(data.buffer, data.byteOffset, data.byteLength),
});

/** The bytes of a file joined to a Positioning, behind the storage of the module (spec stack §6). */
export const attachmentBlob = pgTable(
  'attachment_blob',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    data: bytea().notNull(),
  },
  (table) => [unique('attachment_blob_user_id_id_unique').on(table.userId, table.id)],
);

/**
 * A file joined to a Positioning (ST-35): its name, its type and its size; its bytes in the storage.
 * Removed, it stays as long as “Undo” may bring it back, then goes, bytes included.
 */
export const positioningAttachment = pgTable(
  'positioning_attachment',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** No foreign key: deleting a Positioning is a gesture “Undo” takes back, its attachments with it. */
    positioningId: uuid('positioning_id').notNull(),
    /** Where the storage keeps its bytes. */
    blobId: uuid('blob_id').notNull(),
    name: text().notNull(),
    contentType: text('content_type').notNull(),
    /** In bytes: what counts against the room of the User. */
    size: integer().notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull(),
    /** Removed since then, by hand or with its Positioning; kept for “Undo” only. */
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (table) => [
    unique('positioning_attachment_user_id_id_unique').on(table.userId, table.id),
    foreignKey({
      name: 'positioning_attachment_blob_fk',
      columns: [table.userId, table.blobId],
      foreignColumns: [attachmentBlob.userId, attachmentBlob.id],
    }),
    check('positioning_attachment_name_check', sql`${table.name} <> ''`),
    check('positioning_attachment_size_check', sql`${table.size} >= 0`),
    index('positioning_attachment_positioning_idx').on(table.userId, table.positioningId),
  ],
);

/** The gestures of Settings on the Funnel (spec UX §5.8) “Undo” can take back (ADR 0011): each touches one Stage. */
export const STAGE_GESTURE_KINDS = [
  'stage_created',
  'stage_edited',
  'stage_moved',
  'stage_archived',
  'stage_restored',
  'stage_deleted',
] as const;

/**
 * The gestures of the Positioning workshop (spec UX §5.6) “Undo” can take back (ADR 0011): each
 * touches one Positioning, no Contact.
 */
export const POSITIONING_GESTURE_KINDS = [
  'positioning_created',
  'positioning_edited',
  'positioning_relabeled',
  'positioning_archived',
  'positioning_unarchived',
  'positioning_deleted',
  'positioning_attachment_added',
  'positioning_attachment_removed',
] as const;
