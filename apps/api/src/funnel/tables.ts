import { CHANNELS } from '@battlecrm/contract';
import { sql } from 'drizzle-orm';
import {
  check,
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
