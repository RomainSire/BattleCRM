// Local days (`YYYY-MM-DD`), never JavaScript dates (spec stack §6): their arithmetic runs at noon UTC,
// which no change of hour moves to another day.

/** The local day of an instant in a time zone. */
export function localDay(instant: Date, timeZone: string): string {
  // The Swedish locale writes dates as ISO 8601.
  return new Intl.DateTimeFormat('sv', { timeZone, dateStyle: 'short' }).format(instant);
}

const noonOf = (day: string) => new Date(`${day}T12:00:00Z`);

/** The local day `count` days after another one, or before it when `count` is negative. */
export function addDays(day: string, count: number): string {
  const noon = noonOf(day);
  noon.setUTCDate(noon.getUTCDate() + count);
  return noon.toISOString().slice(0, 10);
}

/** Whole days from a local day to another one, negative when it is earlier. */
export const daysBetween = (from: string, to: string): number =>
  Math.round((noonOf(to).getTime() - noonOf(from).getTime()) / 86_400_000);

/** The Monday of the week of a local day: a week runs from Monday to Sunday (CONTEXT.md, Entry goal). */
export function mondayOf(day: string): string {
  // Sunday is 0: six days after the Monday.
  return addDays(day, -((noonOf(day).getUTCDay() + 6) % 7));
}

/** The Monday after the week of a local day: when a change of the Entry goal takes effect (ADR 0003). */
export const nextMondayAfter = (day: string): string => addDays(mondayOf(day), 7);

/** The Funnel entries of the week of `today`: every entry counts, twice the same Contact too (CONTEXT.md). */
export function funnelEntriesInWeek(
  contacts: readonly { funnelEntryDays: readonly string[] }[],
  today: string,
): number {
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  return contacts
    .flatMap(({ funnelEntryDays }) => funnelEntryDays)
    .filter((day) => day >= monday && day <= sunday).length;
}
