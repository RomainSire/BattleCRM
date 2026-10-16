import { shiftedFollowUpOn } from '@battlecrm/domain';

import { positioningsOf, type Summary, type SummaryContact } from '../summary.ts';
import type { ThreadEntry } from './contact-record-query.ts';

/**
 * The last Positioning used on a Contact, read from its thread, and the day it was sent: what the
 * Follow-ups of its Cadence read their interval and their message from (CONTEXT.md, Follow-up cadence).
 */
export function lastUseOf(thread: readonly ThreadEntry[], summary: Summary) {
  // The thread runs from the latest Interaction to the earliest.
  const use = thread.find(({ kind }) => kind === 'positioning_used');
  const positioning = use && positioningsOf(summary).find(({ id }) => id === use.positioningId);
  return positioning && use ? { positioning, sentOn: use.localDate } : undefined;
}

/**
 * The local day of the last outbound Interaction done, once one is done on `day`: what each interval
 * of the Cadence counts from.
 */
export function lastOutboundOn(thread: readonly ThreadEntry[], day: string) {
  return thread
    .filter(({ direction }) => direction === 'outbound')
    .reduce((last, { localDate }) => (localDate > last ? localDate : last), day);
}

/**
 * The day an outbound Interaction done on `day` pushes the Follow-up of the Cadence back to (spec UX
 * §6.4), as the server will; `undefined` when it stays where it is.
 */
export function pushedFollowUpOn(
  followUp: SummaryContact['followUp'],
  thread: readonly ThreadEntry[],
  summary: Summary,
  day: string,
) {
  // Fallback: a summary kept on the device by a version from before ranks carries none.
  const rank = followUp?.rank ?? null;
  const lastUse = lastUseOf(thread, summary);
  if (!followUp || rank === null || !lastUse) return undefined;
  const days = lastUse.positioning.followUps.map((cadenceRank) => cadenceRank.days);
  const dueOn = shiftedFollowUpOn(
    { dueOn: followUp.dueOn, rank },
    lastOutboundOn(thread, day),
    days,
  );
  return dueOn === followUp.dueOn ? undefined : dueOn;
}
