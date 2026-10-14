import type { ContactStatus } from '@battlecrm/contract';
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
