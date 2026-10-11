/** Whether the runtime knows this IANA time zone. */
export function isTimeZone(value: string): boolean {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone !== '';
  } catch {
    return false;
  }
}

/** The local day (`YYYY-MM-DD`) of an instant in a time zone. */
export function localDate(timeZone: string, instant: Date): string {
  // The Swedish locale writes dates as ISO 8601.
  return new Intl.DateTimeFormat('sv', { timeZone, dateStyle: 'short' }).format(instant);
}
