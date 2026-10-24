import { addDays, contactAgenda, daysBetween, type AllySignal } from '@battlecrm/domain';

import { allySignalOf } from '../circle/ally-signal.ts';
import { agendaOf } from '../funnel/agenda.ts';
import type { Card } from '../funnel/next-action.tsx';
import type { Summary, SummaryContact } from '../summary.ts';

/**
 * A row of the list of Today (spec UX §5.1): a Follow-up due, today or overdue, of a Contact
 * Prospecting or of an Ally; or an Ally past its Rhythm. `daysLate` is how long overdue it is: since
 * the day of its Follow-up, or since the Rhythm ran out.
 */
export type TodayRow =
  | { kind: 'follow-up'; card: Card; daysLate: number }
  | { kind: 'ally'; contact: SummaryContact; signal: AllySignal; daysLate: number };

/** What Today has for the User (spec UX §5.1), computed from the summary (CONTEXT.md: Needs action, Check-in rhythm). */
export type ToHandle = {
  /** The Follow-ups due and the Allies to check in with, mixed, the longest overdue first. */
  rows: TodayRow[];
  /** The Contacts Prospecting whose Trial is past its Response window, the longest past first. */
  windowElapsed: Card[];
  /** The Contacts with a Follow-up tomorrow: what comes next (spec UX §5.1, “Upcoming”). */
  tomorrow: SummaryContact[];
  /** How many Contacts Prospecting need action. */
  needsAction: number;
  /** How many Allies are to check in with, their Follow-up due included. */
  alliesToCheckIn: number;
};

const byName = (a: SummaryContact, b: SummaryContact) => a.name.localeCompare(b.name);

const contactOf = (row: TodayRow) => (row.kind === 'ally' ? row.contact : row.card.contact);

/** The day a Card is ordered by: its Follow-up's, or the last day of its Trial's window. */
const dayOf = ({ agenda }: Card) => ('on' in agenda ? agenda.on : '');

/** What Today has for the User on `today`, read from the summary. */
export function toHandleOf(summary: Summary, today: string): ToHandle {
  const rows: TodayRow[] = [];
  const windowElapsed: Card[] = [];
  let needsAction = 0;
  let alliesToCheckIn = 0;
  for (const contact of summary.contacts) {
    if (contact.status === 'prospecting') {
      const card = { contact, agenda: agendaOf(contact, summary, today) };
      if (card.agenda.row !== 'needs-action') continue;
      needsAction += 1;
      if (card.agenda.reason === 'window-elapsed') windowElapsed.push(card);
      else rows.push({ kind: 'follow-up', card, daysLate: daysBetween(card.agenda.on, today) });
    } else if (contact.status === 'ally') {
      const signal = allySignalOf(contact, summary, today);
      if (signal.signal !== 'time-to-check-in') continue;
      alliesToCheckIn += 1;
      const daysLate = daysBetween(signal.dueOn, today);
      if (signal.followUp === 'due') {
        // Its Follow-up due comes first: it is followed up as any other (spec UX §5.1).
        const agenda = contactAgenda(
          { followUp: contact.followUp, trialWindow: null, stageHasPositioning: false },
          today,
        );
        rows.push({ kind: 'follow-up', card: { contact, agenda }, daysLate });
      } else {
        rows.push({ kind: 'ally', contact, signal, daysLate });
      }
    }
  }
  const tomorrow = addDays(today, 1);
  return {
    rows: rows.toSorted((a, b) => b.daysLate - a.daysLate || byName(contactOf(a), contactOf(b))),
    windowElapsed: windowElapsed.toSorted(
      (a, b) => dayOf(a).localeCompare(dayOf(b)) || byName(a.contact, b.contact),
    ),
    tomorrow: summary.contacts
      .filter(({ followUp }) => followUp?.dueOn === tomorrow)
      .toSorted(byName),
    needsAction,
    alliesToCheckIn,
  };
}
