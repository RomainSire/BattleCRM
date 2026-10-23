import { CONTACT_STATUSES, type ContactStatus } from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';

import type { Summary, SummaryContact } from '../summary.ts';

/** The Status of a Contact as the User reads it. */
export const STATUS_LABEL: Record<ContactStatus, () => string> = {
  pool: m.status_pool,
  prospecting: m.status_prospecting,
  ally: m.status_ally,
  archived: m.status_archived,
};

/** The name of the Stage a Contact is at, Prospecting; none in any other Status, or while the summary does not know it. */
export function prospectingStageOf(
  contact: SummaryContact,
  stages: Summary['stages'],
): string | undefined {
  if (contact.status !== 'prospecting') return undefined;
  return stages.find(({ id }) => id === contact.stageId)?.name;
}

/** A change of Status the User opens: one target, or the choice of it first (spec UX §6.11). */
export const STATUS_GESTURES = ['choose', ...CONTACT_STATUSES] as const;
export type StatusGesture = (typeof STATUS_GESTURES)[number];

/** The verb that leads to each Status (spec UX §6.11), as a button opens it… */
export const STATUS_VERB: Record<ContactStatus, () => string> = {
  prospecting: m.verb_bring_in,
  ally: m.verb_add_to_circle,
  pool: m.verb_back_to_pool,
  archived: m.verb_archive,
};

/** …and as the panel validates it. */
export const STATUS_ACTION: Record<ContactStatus, () => string> = {
  prospecting: m.action_bring_in,
  ally: m.action_add_to_circle,
  pool: m.action_back_to_pool,
  archived: m.action_archive,
};

/** The Statuses a Contact can go to: every other one, in this order (spec UX §5.3). */
export const otherStatuses = (current: ContactStatus): ContactStatus[] =>
  (['prospecting', 'ally', 'pool', 'archived'] as const).filter((status) => status !== current);

/**
 * A gesture on the Follow-up the User opens: Schedule or Edit it, Follow up… (spec UX §6.3, §6.5), or
 * Follow up anyway once the Response window of the Trial elapsed (§5.1).
 */
export const FOLLOW_UP_GESTURES = ['schedule', 'do', 'anyway'] as const;
export type FollowUpGesture = (typeof FOLLOW_UP_GESTURES)[number];

/**
 * Use a Positioning, as the User opens it (spec UX §6.1): its panel, or the creation of a Positioning
 * for the Stage that has none, which leads back to it.
 */
export const SEND_GESTURES = ['positioning', 'new-positioning'] as const;
export type SendGesture = (typeof SEND_GESTURES)[number];

/**
 * A gesture that records an Interaction the User opens: Note an Interaction, Replied…, or Check in…
 * with an Ally (spec UX §6.2, §6.4, §6.14).
 */
export const INTERACTION_GESTURES = ['note', 'reply', 'check-in'] as const;
export type InteractionGesture = (typeof INTERACTION_GESTURES)[number];

/** A gesture on the Trial in progress the User opens: No result… (spec UX §6.7). */
export const TRIAL_GESTURES = ['no-result'] as const;
export type TrialGesture = (typeof TRIAL_GESTURES)[number];

/**
 * A change of Stage the User opens (spec UX §6.6): to a Stage already chosen, by its id, or the choice
 * of it first.
 */
export type StageGesture = 'choose' | (string & {});
