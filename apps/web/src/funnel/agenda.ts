import { contactAgenda, type ContactAgenda } from '@battlecrm/domain';

import { trialWindowOf } from '../contacts/trial.tsx';
import { positioningsOf, type Summary, type SummaryContact } from '../summary.ts';

/**
 * What a Contact Prospecting has next on the User's today (CONTEXT.md: Needs action, Waiting, No next
 * step), read from the summary: its Follow-up, the Response window of its Trial in progress, as the
 * record reads it, and whether its Stage has a Positioning.
 */
export function agendaOf(contact: SummaryContact, summary: Summary, today: string): ContactAgenda {
  const window = trialWindowOf(contact, summary);
  return contactAgenda(
    {
      followUp: contact.followUp,
      trialWindow: window
        ? { lastDoneOn: window.lastDoneOn, responseWindowDays: window.responseWindowDays }
        : null,
      stageHasPositioning: positioningsOf(summary).some(
        ({ stageId, archived }) => stageId === contact.stageId && !archived,
      ),
    },
    today,
  );
}
