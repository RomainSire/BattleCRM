import { sql } from 'drizzle-orm';
import { check, date, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

// oxlint-disable-next-line no-restricted-imports -- a foreign key to the User: tables files reference each other directly, drizzle-kit loads them alone.
import { user } from '../auth/tables.ts';

const userId = () =>
  uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' });

/** The preferences of a User that keep no history. */
export const userSettings = pgTable(
  'user_settings',
  {
    userId: userId().primaryKey(),
    locale: text({ enum: ['fr', 'en'] }).notNull(),
  },
  (table) => [check('user_settings_locale_check', sql`${table.locale} in ('fr', 'en')`)],
);

/** The time zone in effect from a local day on (ADR 0003): a change never moves the past. */
export const effectiveTimeZone = pgTable(
  'effective_time_zone',
  {
    userId: userId(),
    effectiveFrom: date('effective_from').notNull(),
    value: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.effectiveFrom] })],
);
