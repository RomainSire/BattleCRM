import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core';

// oxlint-disable-next-line no-restricted-imports -- a foreign key to the User: tables files reference each other directly, drizzle-kit loads them alone.
import { user } from '../auth/tables.ts';
// oxlint-disable-next-line no-restricted-imports -- a foreign key to the Battle put off.
import { battle } from '../battles/tables.ts';
// oxlint-disable-next-line no-restricted-imports -- a foreign key to the Contact picked.
import { contact } from '../prospecting/tables.ts';

/**
 * What Today picks at random for a day (spec UX §5.1, ST-47): Contacts of the Pool proposed for a
 * Funnel entry, and Contacts with No next step.
 */
const DAILY_PICK_KINDS = ['entry', 'no_next_step'] as const;
export type DailyPickKind = (typeof DAILY_PICK_KINDS)[number];

const kinds = sql.raw(DAILY_PICK_KINDS.map((kind) => `'${kind}'`).join(', '));

/**
 * A Contact Today picked on a local day, the same on every device all day long: written at the first
 * read of the day, then for an entry, once a Contact picked left the Pool, by the one that replaces it.
 * Only the rows of the current day are kept.
 */
export const dailyPick = pgTable(
  'daily_pick',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** The local day it was picked for, in the time zone in effect then. */
    localDate: date('local_date', { mode: 'string' }).notNull(),
    kind: text({ enum: DAILY_PICK_KINDS }).notNull(),
    contactId: uuid('contact_id').notNull(),
    /** Its place among the picks of its kind that day, in the order picked. */
    rank: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.localDate, table.kind, table.contactId] }),
    foreignKey({
      name: 'daily_pick_contact_fk',
      columns: [table.userId, table.contactId],
      foreignColumns: [contact.userId, contact.id],
    }).onDelete('cascade'),
    check('daily_pick_kind_check', sql`${table.kind} in (${kinds})`),
    check('daily_pick_rank_check', sql`${table.rank} >= 0`),
  ],
);

/**
 * A conclusive Battle put off on a local day, “Later” on Today: hidden until the next day, on every
 * device (spec UX §5.1). Only the rows of the current day matter.
 */
export const battlePostponement = pgTable(
  'battle_postponement',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    battleId: uuid('battle_id').notNull(),
    /** The local day it is hidden on, in the time zone in effect then. */
    localDate: date('local_date', { mode: 'string' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.battleId, table.localDate] }),
    foreignKey({
      name: 'battle_postponement_battle_fk',
      columns: [table.userId, table.battleId],
      foreignColumns: [battle.userId, battle.id],
    }).onDelete('cascade'),
  ],
);
