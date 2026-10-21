// The signal of a Trial in progress, never stored (spec stack §5.3): read from local days.

import { addDays } from './days.ts';

/** What the Response window of a Trial in progress is read from. */
export type TrialWindow = {
  /** The scheduled Follow-up of the Contact, if any: while one is, a silence calls it. */
  followUp: { rank: number | null } | null;
  /** The local day of its last Interaction done, outbound or inbound. */
  lastDoneOn: string;
  /** The Response window of the Positioning of the Trial. */
  responseWindowDays: number;
};

/**
 * The local day a Trial in progress is signaled Window elapsed (CONTEXT.md, Response window): its
 * Response window after the last Interaction done, outbound or inbound, once the Cadence is over or
 * stopped. None while a Follow-up is scheduled, of the Cadence or added by hand: it comes first.
 */
export const responseWindowEndsOn = ({
  followUp,
  lastDoneOn,
  responseWindowDays,
}: TrialWindow): string | undefined =>
  followUp === null ? addDays(lastDoneOn, responseWindowDays) : undefined;

/** Whether a Trial in progress is Window elapsed on a local day: from the last day of its window, as a Follow-up is due on its day. */
export function isWindowElapsed(window: TrialWindow, today: string): boolean {
  const endsOn = responseWindowEndsOn(window);
  return endsOn !== undefined && endsOn <= today;
}
