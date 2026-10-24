// What a Contact Prospecting has next, never stored (spec stack §5.3): read from local days.

import { followUpSignal } from './follow-up.ts';
import { isWindowElapsed, responseWindowEndsOn } from './trial.ts';

/** What the next action of a Contact Prospecting is read from. */
export type AgendaContact = {
  /** Its scheduled Follow-up, if any. */
  followUp: { dueOn: string } | null;
  /** Its Trial in progress, if any: what its Response window is read from (CONTEXT.md, Response window). */
  trialWindow: { lastDoneOn: string; responseWindowDays: number } | null;
  /** Whether its Stage has a Positioning not archived. */
  stageHasPositioning: boolean;
};

/**
 * Where a Contact Prospecting stands (CONTEXT.md): Needs action, else Waiting, else No next step;
 * with why, and the day that orders it (spec UX §5.2): the day its Follow-up is due, or the last day
 * of the Response window of its Trial.
 */
export type ContactAgenda =
  | {
      row: 'needs-action';
      reason: 'follow-up-overdue' | 'follow-up-today' | 'window-elapsed';
      on: string;
    }
  | { row: 'waiting'; reason: 'follow-up-upcoming' | 'trial'; on: string }
  | { row: 'waiting'; reason: 'no-positioning' }
  | { row: 'no-next-step' };

export type AgendaRow = ContactAgenda['row'];

/** The next action of a Contact Prospecting on a local day: a scheduled Follow-up comes first. */
export function contactAgenda(contact: AgendaContact, today: string): ContactAgenda {
  const { followUp, trialWindow } = contact;
  if (followUp !== null) {
    const on = followUp.dueOn;
    switch (followUpSignal(on, today)) {
      case 'overdue':
        return { row: 'needs-action', reason: 'follow-up-overdue', on };
      case 'today':
        return { row: 'needs-action', reason: 'follow-up-today', on };
      default:
        return { row: 'waiting', reason: 'follow-up-upcoming', on };
    }
  }
  if (trialWindow !== null) {
    const window = { followUp: null, ...trialWindow };
    // No Follow-up scheduled: the window has an end.
    const on = responseWindowEndsOn(window) ?? today;
    return isWindowElapsed(window, today)
      ? { row: 'needs-action', reason: 'window-elapsed', on }
      : { row: 'waiting', reason: 'trial', on };
  }
  return contact.stageHasPositioning
    ? { row: 'no-next-step' }
    : { row: 'waiting', reason: 'no-positioning' };
}

/** What tells a Contact Prospecting with No next step, as the API selects them without the details. */
export type NextStepFacts = {
  hasFollowUp: boolean;
  hasTrialInProgress: boolean;
  stageHasPositioning: boolean;
};

/**
 * Whether a Contact Prospecting has No next step (CONTEXT.md): neither a Follow-up scheduled nor a
 * Trial in progress, at a Stage that has a Positioning; the same as `contactAgenda` reads.
 */
export const hasNoNextStep = (facts: NextStepFacts): boolean =>
  !facts.hasFollowUp && !facts.hasTrialInProgress && facts.stageHasPositioning;

/** The rank of each kind of next action, the most urgent first (spec UX §5.2). */
const URGENCY = [
  'follow-up-overdue',
  'follow-up-today',
  'window-elapsed',
  'no-next-step',
  'follow-up-upcoming',
  'trial',
  'no-positioning',
] as const;

const rankOf = (agenda: ContactAgenda) =>
  URGENCY.indexOf(agenda.row === 'no-next-step' ? agenda.row : agenda.reason);

/** The day that orders a next action within its kind; none sorts last. */
const dayOf = (agenda: ContactAgenda) => ('on' in agenda ? agenda.on : '￿');

/**
 * By urgency (spec UX §5.2): the oldest overdue Follow-up first, then today's, Window elapsed, No next
 * step, then Waiting: by date of Follow-up, then the Trials by the end of their window, then the
 * Stages without a Positioning.
 */
export const byUrgency = (a: ContactAgenda, b: ContactAgenda): number =>
  rankOf(a) - rankOf(b) || dayOf(a).localeCompare(dayOf(b));

/** Whether what calls for action is a Follow-up due, today or overdue, rather than a Trial past its window. */
export const isFollowUpDueIn = (agenda: ContactAgenda): boolean =>
  agenda.row === 'needs-action' && agenda.reason !== 'window-elapsed';
