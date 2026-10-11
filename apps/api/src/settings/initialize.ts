import type { Locale } from '@battlecrm/i18n/runtime';

import type { Transaction } from '../db/index.ts';
import { effectiveTimeZone, userSettings } from './tables.ts';
import { localDate } from './time-zone.ts';

/**
 * The settings every User starts with, written when the account is created (ST-40):
 * the language of the sign-up attempt, and its time zone in effect from that local day on.
 */
export async function initializeSettings(
  tx: Transaction,
  newUser: { userId: string; locale: Locale; timeZone: string; now: Date },
): Promise<void> {
  const { userId, locale, timeZone, now } = newUser;
  await tx.insert(userSettings).values({ userId, locale });
  await tx
    .insert(effectiveTimeZone)
    .values({ userId, effectiveFrom: localDate(timeZone, now), value: timeZone });
}
