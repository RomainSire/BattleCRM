import type { Locale } from '@battlecrm/i18n/runtime';
import { asc, eq } from 'drizzle-orm';

import { withUser, type Transaction } from '../db/index.ts';
import { effectiveTimeZone, userSettings } from './tables.ts';
import { localDate } from './time-zone.ts';

/** The time zone in effect at an instant. A time zone takes effect on its local day, read in the zone in effect until then. */
async function timeZoneAt(tx: Transaction, userId: string, at: Date): Promise<string> {
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
