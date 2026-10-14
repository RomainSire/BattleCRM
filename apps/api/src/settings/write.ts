import { DEFAULT_ACTIVITY_GOAL, DEFAULT_ENTRY_GOAL } from '@battlecrm/contract';
import { addDays, nextMondayAfter } from '@battlecrm/domain';
import { and, desc, eq, gte, lte } from 'drizzle-orm';

import type { Transaction } from '../db/index.ts';
import { goalOn, localDateOf, type GoalTable } from './read.ts';
import { effectiveActivityGoal, effectiveEntryGoal, effectiveTimeZone } from './tables.ts';

// The values in effect change from a day to come on, never in the past (ADR 0003). A change
// replaces any other still to come, and a value equal to the one before leaves no row: changing it
// back, as “Undo” does, leaves no trace.

async function changeGoalFrom(
  tx: Transaction,
  table: GoalTable,
  userId: string,
  from: string,
  value: number | null,
  fallback: number,
): Promise<void> {
  await tx.delete(table).where(and(eq(table.userId, userId), gte(table.effectiveFrom, from)));
  if ((await goalOn(tx, table, userId, addDays(from, -1), fallback)) === value) return;
  await tx.insert(table).values({ userId, effectiveFrom: from, value });
}

/** The Activity goal, from the next local day on (CONTEXT.md, Activity goal). */
export async function changeActivityGoal(
  tx: Transaction,
  userId: string,
  goal: number | null,
  now: Date,
): Promise<void> {
  const tomorrow = addDays(await localDateOf(tx, userId, now), 1);
  await changeGoalFrom(tx, effectiveActivityGoal, userId, tomorrow, goal, DEFAULT_ACTIVITY_GOAL);
}

/** The Entry goal, from the next Monday on: the week under way keeps its own (CONTEXT.md, Entry goal). */
export async function changeEntryGoal(
  tx: Transaction,
  userId: string,
  goal: number | null,
  now: Date,
): Promise<void> {
  const nextMonday = nextMondayAfter(await localDateOf(tx, userId, now));
  await changeGoalFrom(tx, effectiveEntryGoal, userId, nextMonday, goal, DEFAULT_ENTRY_GOAL);
}

/** The time zone, from the next local day of the one in effect on (ST-40). */
export async function changeTimeZone(
  tx: Transaction,
  userId: string,
  timeZone: string,
  now: Date,
): Promise<void> {
  const tomorrow = addDays(await localDateOf(tx, userId, now), 1);
  await tx
    .delete(effectiveTimeZone)
    .where(
      and(eq(effectiveTimeZone.userId, userId), gte(effectiveTimeZone.effectiveFrom, tomorrow)),
    );
  const [before] = await tx
    .select({ value: effectiveTimeZone.value })
    .from(effectiveTimeZone)
    .where(
      and(eq(effectiveTimeZone.userId, userId), lte(effectiveTimeZone.effectiveFrom, tomorrow)),
    )
    .orderBy(desc(effectiveTimeZone.effectiveFrom))
    .limit(1);
  if (before?.value === timeZone) return;
  await tx.insert(effectiveTimeZone).values({ userId, effectiveFrom: tomorrow, value: timeZone });
}
