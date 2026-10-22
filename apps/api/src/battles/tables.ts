import {
  BATTLE_HORIZON_MAX,
  BATTLE_MINIMUM_FINISHED,
  BATTLE_THRESHOLDS,
  TARGETS,
  VERDICTS,
} from '@battlecrm/contract';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// oxlint-disable-next-line no-restricted-imports -- a foreign key to the User: tables files reference each other directly, drizzle-kit loads them alone.
import { user } from '../auth/tables.ts';
// oxlint-disable-next-line no-restricted-imports -- foreign keys to the Stage and to the two Positionings.
import { positioning, stage } from '../funnel/tables.ts';

/**
 * A Battle (CONTEXT.md): the Champion of a Stage against a Challenger of the same Stage, until its
 * Verdict. What it is judged by, its Success criterion, Target, threshold and Horizon, is fixed when
 * it opens (ADR 0001). A Stage has at most one open.
 */
export const battle = pgTable(
  'battle',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    stageId: uuid('stage_id').notNull(),
    championId: uuid('champion_id').notNull(),
    challengerId: uuid('challenger_id').notNull(),
    successCriterion: text('success_criterion').notNull(),
    /** The one Target it is restricted to, `null` for all. */
    target: text({ enum: TARGETS }),
    threshold: doublePrecision().notNull(),
    horizon: integer().notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
    /** The local day it was opened on, in the time zone in effect then. */
    openedOn: date('opened_on', { mode: 'string' }).notNull(),
    /** Closed since then, by the User, who confirms it (ADR 0001). */
    closedAt: timestamp('closed_at', { withTimezone: true }),
    /** The local day it was closed on, in the time zone in effect then. */
    closedOn: date('closed_on', { mode: 'string' }),
    /** What it was closed with (CONTEXT.md, Verdict). */
    verdict: text({ enum: VERDICTS }),
    /** A winner the User declared without the Win rule satisfied (ADR 0001). */
    designated: boolean().notNull().default(false),
    /** What the User takes from it, optional, edited after closing too (CONTEXT.md, Takeaway). */
    takeaway: text(),
  },
  (table) => [
    unique('battle_user_id_id_unique').on(table.userId, table.id),
    foreignKey({
      name: 'battle_stage_fk',
      columns: [table.userId, table.stageId],
      foreignColumns: [stage.userId, stage.id],
    }),
    foreignKey({
      name: 'battle_champion_fk',
      columns: [table.userId, table.championId],
      foreignColumns: [positioning.userId, positioning.id],
    }),
    foreignKey({
      name: 'battle_challenger_fk',
      columns: [table.userId, table.challengerId],
      foreignColumns: [positioning.userId, positioning.id],
    }),
    check('battle_opponents_check', sql`${table.championId} <> ${table.challengerId}`),
    check('battle_success_criterion_check', sql`${table.successCriterion} <> ''`),
    check(
      'battle_target_check',
      sql`${table.target} in (${sql.raw(TARGETS.map((target) => `'${target}'`).join(', '))})`,
    ),
    check(
      'battle_threshold_check',
      sql`${table.threshold} in (${sql.raw(BATTLE_THRESHOLDS.join(', '))})`,
    ),
    // Never below the minimum of finished Trials, which is not settable (ADR 0001).
    check(
      'battle_horizon_check',
      sql`${table.horizon} between ${sql.raw(String(BATTLE_MINIMUM_FINISHED))} and ${sql.raw(String(BATTLE_HORIZON_MAX))}`,
    ),
    check(
      'battle_verdict_check',
      sql`${table.verdict} in (${sql.raw(VERDICTS.map((verdict) => `'${verdict}'`).join(', '))})`,
    ),
    // A Verdict, and its day, exactly once closed; only a winner is designated.
    check(
      'battle_closed_check',
      sql`(${table.closedAt} is null) = (${table.verdict} is null) and (${table.closedAt} is null) = (${table.closedOn} is null) and (not ${table.designated} or ${table.verdict} in ('challenger_wins', 'title_defended'))`,
    ),
    // Only a closed Battle has one (CONTEXT.md, Takeaway).
    check(
      'battle_takeaway_check',
      sql`${table.takeaway} is null or (${table.takeaway} <> '' and ${table.closedAt} is not null)`,
    ),
    // At most one open Battle per Stage (spec stack §6).
    uniqueIndex('battle_open_per_stage_unique')
      .on(table.userId, table.stageId)
      .where(sql`${table.closedAt} is null`),
    index('battle_stage_idx').on(table.userId, table.stageId),
    index('battle_champion_idx').on(table.userId, table.championId),
    index('battle_challenger_idx').on(table.userId, table.challengerId),
  ],
);

/** The gestures on a Battle “Undo” can take back (ADR 0011): each touches one Battle, no Contact. */
export const BATTLE_GESTURE_KINDS = ['battle_opened', 'battle_takeaway_changed'] as const;
