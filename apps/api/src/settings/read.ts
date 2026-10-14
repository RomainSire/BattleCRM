import { DEFAULT_ACTIVITY_GOAL, DEFAULT_ENTRY_GOAL } from '@battlecrm/contract';
import { mondayOf } from '@battlecrm/domain';
import type { Locale } from '@battlecrm/i18n/runtime';
import { and, asc, desc, eq, lte } from 'drizzle-orm';

import { withUser, type Transaction } from '../db/index.ts';
import {
  effectiveActivityGoal,
  effectiveEntryGoal,
  effectiveTimeZone,
  userSettings,
} from './tables.ts';
import { localDate } from './time-zone.ts';

/** The time zone in effect at an instant. A time zone takes effect on its local day, read in the zone in effect until then. */
export async function timeZoneAt(tx: Transaction, userId: string, at: Date): Promise<string> {
  const [first, ...changes] = await tx
    .select({ effectiveFrom: effectiveTimeZone.effectiveFrom, value: effectiveTimeZone.value })
    .from(effectiveTimeZone)
    .where(eq(effectiveTimeZone.userId, userId))
    .orderBy(asc(effectiveTimeZone.effectiveFrom));
  if (!first) throw new Error('A User has no settings');
  let timeZone = first.value;
  for (const change of changes) {
    if (change.effectiveFrom > localDate(timeZone, at)) break;
    timeZone = change.value;
  }
  return timeZone;
}

/**
 * The local day (`YYYY-MM-DD`) of an instant for a User, in the time zone in effect then: computed
 * when a row is written and stored with it, never recomputed (spec stack §5.3, §6).
 */
export async function localDateOf(tx: Transaction, userId: string, instant: Date): Promise<string> {
  return localDate(await timeZoneAt(tx, userId, instant), instant);
}

/** The language of a User and the time zone in effect at an instant: what an e-mail is written in (spec stack §8). */
export async function languageAndTimeZoneOf(
  userId: string,
  at: Date,
): Promise<{ locale: Locale; timeZone: string }> {
  return withUser(userId, async (tx) => {
    const [settings] = await tx
      .select({ locale: userSettings.locale })
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    if (!settings) throw new Error('A User has no settings');
    return { locale: settings.locale, timeZone: await timeZoneAt(tx, userId, at) };
  });
}

/** A table of goals in effect from a day on (ADR 0003): `null` for a goal turned off. */
export type GoalTable = typeof effectiveActivityGoal | typeof effectiveEntryGoal;

/** The goal in effect on a local day: the latest row from that day or before, else the default. */
export async function goalOn(
  tx: Transaction,
  table: GoalTable,
  userId: string,
  day: string,
  fallback: number,
): Promise<number | null> {
  const [inEffect] = await tx
    .select({ value: table.value })
    .from(table)
    .where(and(eq(table.userId, userId), lte(table.effectiveFrom, day)))
    .orderBy(desc(table.effectiveFrom))
    .limit(1);
  return inEffect ? inEffect.value : fallback;
}

/** The Activity goal of a local day, `null` if turned off: the day keeps the one it had (ST-42). */
export const activityGoalOn = (tx: Transaction, userId: string, day: string) =>
  goalOn(tx, effectiveActivityGoal, userId, day, DEFAULT_ACTIVITY_GOAL);

/** The Entry goal of the week that starts on a Monday, `null` if turned off (ST-49). */
export const entryGoalForWeek = (tx: Transaction, userId: string, monday: string) =>
  goalOn(tx, effectiveEntryGoal, userId, monday, DEFAULT_ENTRY_GOAL);

/** The time zone the User chose last: the one in effect, or the one that takes over tomorrow. */
async function chosenTimeZone(tx: Transaction, userId: string): Promise<string> {
  const [latest] = await tx
    .select({ value: effectiveTimeZone.value })
    .from(effectiveTimeZone)
    .where(eq(effectiveTimeZone.userId, userId))
    .orderBy(desc(effectiveTimeZone.effectiveFrom))
    .limit(1);
  if (!latest) throw new Error('A User has no settings');
  return latest.value;
}

/** Later than any day a value takes effect on: what is in effect then is what the User chose last. */
const LAST_DAY = '9999-12-31';

/**
 * Settings as the summary carries them (spec UX §5.8): each dated value both in effect now and as
 * the User chose it last, which takes effect tomorrow or next Monday.
 */
export async function settingsOf(tx: Transaction, userId: string, now: Date) {
  const [settings] = await tx.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (!settings) throw new Error('A User has no settings');
  const today = await localDateOf(tx, userId, now);
  return {
    locale: settings.locale,
    timeZone: {
      inEffect: await timeZoneAt(tx, userId, now),
      chosen: await chosenTimeZone(tx, userId),
    },
    activityGoal: {
      inEffect: await activityGoalOn(tx, userId, today),
      chosen: await activityGoalOn(tx, userId, LAST_DAY),
    },
    entryGoal: {
      inEffect: await entryGoalForWeek(tx, userId, mondayOf(today)),
      chosen: await entryGoalForWeek(tx, userId, LAST_DAY),
    },
    celebrateGoal: settings.celebrateGoal,
    singleKeyShortcuts: settings.singleKeyShortcuts,
    checkInRhythmDays: settings.checkInRhythmDays,
    circleSizeGoal: settings.circleSizeGoal,
    defaultCadence: {
      intervals: settings.followUpIntervals,
      responseWindowDays: settings.responseWindowDays,
    },
  };
}
