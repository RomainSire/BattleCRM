import type { Locale } from '@battlecrm/i18n/runtime';
import { asc, eq } from 'drizzle-orm';

import { withUser } from '../db/index.ts';
import { effectiveTimeZone, userSettings } from './tables.ts';
import { localDate } from './time-zone.ts';

/**
 * The language of a User and the time zone in effect at an instant: what an e-mail is written in
 * (spec stack §8). A time zone takes effect on its local day, read in the zone in effect until then.
 */
export async function languageAndTimeZoneOf(
  userId: string,
  at: Date,
): Promise<{ locale: Locale; timeZone: string }> {
  return withUser(userId, async (tx) => {
    const [settings] = await tx
      .select({ locale: userSettings.locale })
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    const [first, ...changes] = await tx
      .select({ effectiveFrom: effectiveTimeZone.effectiveFrom, value: effectiveTimeZone.value })
      .from(effectiveTimeZone)
      .where(eq(effectiveTimeZone.userId, userId))
      .orderBy(asc(effectiveTimeZone.effectiveFrom));
    if (!settings || !first) throw new Error('A User has no settings');
    let timeZone = first.value;
    for (const change of changes) {
      if (change.effectiveFrom > localDate(timeZone, at)) break;
      timeZone = change.value;
    }
    return { locale: settings.locale, timeZone };
  });
}
