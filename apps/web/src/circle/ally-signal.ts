import { allySignal, nextCheckInOn, type AllySignal } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';

import { settingsOf } from '../settings/use-settings.ts';
import type { Summary, SummaryContact } from '../summary.ts';

/**
 * Where an Ally stands on the User's today (CONTEXT.md, Check-in rhythm), read from the summary. Without
 * an Interaction done, its latest Interaction is the change that put it in the Circle: an Ally changes
 * neither Stage nor Status, and anything else it has is done.
 */
export const allySignalOf = (
  contact: SummaryContact,
  summary: Summary,
  today: string,
): AllySignal =>
  allySignal(
    {
      lastDoneOn: contact.lastDoneInteractionOn,
      joinedOn: contact.lastInteractionOn,
      followUp: contact.followUp,
    },
    today,
    settingsOf(summary).checkInRhythmDays,
  );

/**
 * The day of the next Check-in after an Interaction done on a day: a Rhythm later, or the day of a
 * Follow-up kept before it, which comes first (CONTEXT.md, Check-in rhythm); today at the earliest.
 */
export function nextCheckInOf(
  summary: Summary,
  lastDoneOn: string,
  today: string,
  keptFollowUpOn?: string,
): string {
  const byRhythm = nextCheckInOn(lastDoneOn, settingsOf(summary).checkInRhythmDays);
  const next =
    keptFollowUpOn !== undefined && keptFollowUpOn < byRhythm ? keptFollowUpOn : byRhythm;
  return next < today ? today : next;
}

/** The tiers of the Circle (spec UX §5.11), the one that calls for a gesture first. */
export const TIERS = ['time-to-check-in', 'soon', 'none'] as const;
export type Tier = (typeof TIERS)[number];

/** A tier as the User reads it, written next to the gauge: never the colour alone (spec UX §7). */
export const TIER_LABEL: Record<Tier, () => string> = {
  'time-to-check-in': m.circle_tier_time_to_check_in,
  soon: m.circle_tier_soon,
  none: m.circle_tier_up_to_date,
};
