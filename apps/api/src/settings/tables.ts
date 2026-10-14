import {
  DEFAULT_CELEBRATE_GOAL,
  DEFAULT_CHECK_IN_RHYTHM_DAYS,
  DEFAULT_CIRCLE_SIZE_GOAL,
  DEFAULT_FOLLOW_UP_INTERVALS,
  DEFAULT_RESPONSE_WINDOW_DAYS,
  DEFAULT_SINGLE_KEY_SHORTCUTS,
} from '@battlecrm/contract';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core';

// oxlint-disable-next-line no-restricted-imports -- a foreign key to the User: tables files reference each other directly, drizzle-kit loads them alone.
import { user } from '../auth/tables.ts';

const userId = () =>
  uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' });

/**
 * The preferences of a User that keep no history (spec UX §5.8). Each one has the default a new
 * User starts with, which also fills the rows of the Users who existed before it.
 */
export const userSettings = pgTable(
  'user_settings',
  {
    userId: userId().primaryKey(),
    locale: text({ enum: ['fr', 'en'] }).notNull(),
    /** “Celebrate the goal reached” (ST-53). */
    celebrateGoal: boolean('celebrate_goal').notNull().default(DEFAULT_CELEBRATE_GOAL),
    /** “Single-key shortcuts” (ST-54). */
    singleKeyShortcuts: boolean('single_key_shortcuts')
      .notNull()
      .default(DEFAULT_SINGLE_KEY_SHORTCUTS),
    /** The Check-in rhythm, in days (ST-57). */
    checkInRhythmDays: integer('check_in_rhythm_days')
      .notNull()
      .default(DEFAULT_CHECK_IN_RHYTHM_DAYS),
    /** The Circle size goal; `null` when turned off (ST-58). */
    circleSizeGoal: integer('circle_size_goal').default(DEFAULT_CIRCLE_SIZE_GOAL),
    /** The Default follow-up cadence: intervals in days, then the Response window, no message. */
    followUpIntervals: integer('follow_up_intervals')
      .array()
      .notNull()
      .default(sql.raw(`'{${DEFAULT_FOLLOW_UP_INTERVALS.join(',')}}'`)),
    responseWindowDays: integer('response_window_days')
      .notNull()
      .default(DEFAULT_RESPONSE_WINDOW_DAYS),
  },
  (table) => [
    check('user_settings_locale_check', sql`${table.locale} in ('fr', 'en')`),
    check('user_settings_check_in_rhythm_days_check', sql`${table.checkInRhythmDays} > 0`),
    check('user_settings_circle_size_goal_check', sql`${table.circleSizeGoal} > 0`),
    check(
      'user_settings_follow_up_intervals_check',
      sql`cardinality(${table.followUpIntervals}) > 0 and 0 < all(${table.followUpIntervals})`,
    ),
    check('user_settings_response_window_days_check', sql`${table.responseWindowDays} > 0`),
  ],
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

/**
 * The Activity goal in effect from a local day on (ADR 0003, ST-42); `null` when turned off.
 * Before its first row, the default.
 */
export const effectiveActivityGoal = pgTable(
  'effective_activity_goal',
  {
    userId: userId(),
    effectiveFrom: date('effective_from').notNull(),
    value: integer(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.effectiveFrom] }),
    check('effective_activity_goal_value_check', sql`${table.value} > 0`),
  ],
);

/**
 * The Entry goal in effect from a Monday on (ADR 0003, ST-49); `null` when turned off.
 * Before its first row, the default.
 */
export const effectiveEntryGoal = pgTable(
  'effective_entry_goal',
  {
    userId: userId(),
    effectiveFrom: date('effective_from').notNull(),
    value: integer(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.effectiveFrom] }),
    check('effective_entry_goal_value_check', sql`${table.value} > 0`),
    check(
      'effective_entry_goal_effective_from_check',
      sql`extract(isodow from ${table.effectiveFrom}) = 1`,
    ),
  ],
);
