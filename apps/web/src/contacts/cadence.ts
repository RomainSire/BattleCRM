import { shiftedFollowUpOn } from '@battlecrm/domain';

import { positioningsOf, type Summary, type SummaryContact } from '../summary.ts';
import type { ThreadEntry } from './contact-record-query.ts';

/**
 * The last Positioning used on a Contact and the day it was sent: what the Follow-ups of its Cadence
 * read their interval and their message from (CONTEXT.md, Follow-up cadence). Read from the summary,
 * offline too (ST-03); from the thread when the summary kept does not say.
 */
export function lastUseOf(
  contact: SummaryContact,
  summary: Summary,
  thread: readonly ThreadEntry[] | undefined,
) {
  // Fallback: a summary kept on the device by a version from before this field carries none.
  const kept: SummaryContact['lastPositioningUse'] | undefined = contact.lastPositioningUse;
  // The thread runs from the latest Interaction to the earliest.
  const fromThread = thread?.find(({ kind }) => kind === 'positioning_used');
  const use =
    kept === undefined
      ? fromThread?.positioningId && {
          positioningId: fromThread.positioningId,
          sentOn: fromThread.localDate,
        }
      : kept;
  const positioning = use && positioningsOf(summary).find(({ id }) => id === use.positioningId);
  return positioning && use ? { positioning, sentOn: use.sentOn } : undefined;
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
  contact: SummaryContact,
  thread: readonly ThreadEntry[],
  summary: Summary,
  day: string,
) {
  const { followUp } = contact;
  // Fallback: a summary kept on the device by a version from before ranks carries none.
  const rank = followUp?.rank ?? null;
  const lastUse = lastUseOf(contact, summary, thread);
  if (!followUp || rank === null || !lastUse) return undefined;
  const days = lastUse.positioning.followUps.map((cadenceRank) => cadenceRank.days);
  const dueOn = shiftedFollowUpOn(
    { dueOn: followUp.dueOn, rank },
    lastOutboundOn(thread, day),
    days,
  );
  return dueOn === followUp.dueOn ? undefined : dueOn;
}
