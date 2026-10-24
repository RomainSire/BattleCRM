import type { Celebration } from '@battlecrm/contract';
import { activityGoalReached } from '@battlecrm/domain';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';

import type { Transaction } from '../db/index.ts';
import { interaction, PROSPECTING_ACTION_KINDS } from '../prospecting/index.ts';
import { activityGoalOn, settingsOf } from '../settings/index.ts';
import { celebration } from './tables.ts';

/** The latest local day the Activity goal reached was celebrated, `null` before the first (ST-44). */
export async function celebratedOnOf(tx: Transaction, userId: string): Promise<string | null> {
  const [row] = await tx
    .select({ localDate: celebration.localDate })
    .from(celebration)
    .where(eq(celebration.userId, userId));
  return row?.localDate ?? null;
}

/**
 * Records the celebration of the Activity goal reached on a local day, once (ST-44): `celebrate` only
 * for the first device that asks that day, and only when the Activity of the day reaches the goal in
 * effect then, with the celebration turned on. The rule is checked here, never taken from the device.
 */
export async function recordCelebration(
  tx: Transaction,
  userId: string,
  day: string,
  now: Date,
): Promise<Celebration> {
  const { celebrateGoal } = await settingsOf(tx, userId, now);
  const [actions] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(interaction)
    .where(
      and(
        eq(interaction.userId, userId),
        eq(interaction.localDate, day),
        inArray(interaction.kind, [...PROSPECTING_ACTION_KINDS]),
      ),
    );
  const reached = activityGoalReached(actions?.count ?? 0, await activityGoalOn(tx, userId, day));
  if (!celebrateGoal || !reached) {
    return { celebrate: false, celebratedOn: await celebratedOnOf(tx, userId) };
  }
  // Moved on only to a later day: two devices asking at once celebrate once.
  const recorded = await tx
    .insert(celebration)
    .values({ userId, localDate: day })
    .onConflictDoUpdate({
      target: celebration.userId,
      set: { localDate: day },
      setWhere: lt(celebration.localDate, day),
    })
    .returning({ localDate: celebration.localDate });
  return recorded.length > 0
    ? { celebrate: true, celebratedOn: day }
    : { celebrate: false, celebratedOn: await celebratedOnOf(tx, userId) };
}
