import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

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
