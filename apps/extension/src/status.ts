import type { ContactStatus } from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';

/** The Status of a Contact as the User reads it, in the page and in the sidebar. */
export const STATUS_LABEL: Record<ContactStatus, () => string> = {
  pool: m.status_pool,
  prospecting: m.status_prospecting,
  ally: m.status_ally,
  archived: m.status_archived,
};
