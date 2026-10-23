// Where an Ally stands against the Check-in rhythm, never stored (spec stack §5.3): read from local days.

import { addDays, daysBetween } from './days.ts';

/** What the signal of an Ally is read from. */
export type AllyContact = {
  /** The local day of its latest Interaction done, outbound or inbound, if any. */
  lastDoneOn: string | null;
  /** The local day it joined the Circle: what its Days since contact count from without an Interaction done. */
  joinedOn: string;
  /** Its scheduled Follow-up, if any: it comes before the Rhythm (CONTEXT.md, Check-in rhythm). */
  followUp: { dueOn: string } | null;
};

/** The days of the Rhythm that are “soon” before it ends (CONTEXT.md, Check-in rhythm). */
export const CHECK_IN_SOON_DAYS = 7;

export type AllySignal = {
  /** No signal, Check in soon, Time to check in. */
  signal: 'none' | 'soon' | 'time-to-check-in';
  /** Days since its latest Interaction done, or since it joined the Circle (CONTEXT.md, Days since contact). */
  daysSinceContact: number;
  /** The day it calls for a gesture: its scheduled Follow-up's, or the last day of the Rhythm. */
  dueOn: string;
  /** Its scheduled Follow-up, which the signal then comes from: due (today or overdue) or upcoming. */
  followUp: 'due' | 'upcoming' | null;
};

/** The day a Check-in is due after an Interaction done (or joining the Circle): a Rhythm later. */
export const nextCheckInOn = (since: string, rhythmDays: number): string =>
  addDays(since, rhythmDays);

/**
 * The signal of an Ally on a local day (CONTEXT.md, Check-in rhythm): none within the Rhythm, soon in
 * its last 7 days, time to check in once it is over. A scheduled Follow-up comes first: the Ally is
 * called for on its day, and stays up to date until then.
 */
export function allySignal(ally: AllyContact, today: string, rhythmDays: number): AllySignal {
  const since = ally.lastDoneOn ?? ally.joinedOn;
  const daysSinceContact = daysBetween(since, today);
  if (ally.followUp !== null) {
    const { dueOn } = ally.followUp;
    const isDue = dueOn <= today;
    return {
      signal: isDue ? 'time-to-check-in' : 'none',
      daysSinceContact,
      dueOn,
      followUp: isDue ? 'due' : 'upcoming',
    };
  }
  let signal: AllySignal['signal'] = 'none';
  if (daysSinceContact >= rhythmDays) signal = 'time-to-check-in';
  else if (daysSinceContact >= rhythmDays - CHECK_IN_SOON_DAYS) signal = 'soon';
  return { signal, daysSinceContact, dueOn: nextCheckInOn(since, rhythmDays), followUp: null };
}
