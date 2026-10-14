import { localDay } from '@battlecrm/domain';

/** Whether the runtime knows this IANA time zone. */
export function isTimeZone(value: string): boolean {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone !== '';
  } catch {
    return false;
  }
}

/** The local day (`YYYY-MM-DD`) of an instant in a time zone, as the SPA reads it too. */
export const localDate = (timeZone: string, instant: Date): string => localDay(instant, timeZone);
