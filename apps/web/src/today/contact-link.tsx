import { Link } from '@tanstack/react-router';

import { ContactName } from '../contacts/contact-name.tsx';
import { ROW_LINK_CLASS } from '../screens/row-link.ts';
import type { SummaryContact } from '../summary.ts';

/**
 * The name of a Contact on Today, stretched over its row: it opens its record beside the list, or as
 * a page on a phone. Closed, the record gives the focus back to it (`data-today-row`, ST-66).
 */
export function TodayContactLink({
  contact,
  isOpen,
  asPage,
}: {
  contact: SummaryContact;
  isOpen: boolean;
  asPage: boolean;
}) {
  return asPage ? (
    <Link to="/contacts/$contactId" params={{ contactId: contact.id }} className={ROW_LINK_CLASS}>
      <ContactName contact={contact} />
    </Link>
  ) : (
    <Link
      to="/today"
      search={{ contact: contact.id, panel: 'record' }}
      aria-current={isOpen ? 'page' : undefined}
      data-today-row={contact.id}
      className={ROW_LINK_CLASS}
    >
      <ContactName contact={contact} />
    </Link>
  );
}
