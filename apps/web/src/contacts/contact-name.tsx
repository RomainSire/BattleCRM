import { m } from '@battlecrm/i18n';
import { Star } from 'lucide-react';

import type { SummaryContact } from '../summary.ts';

/** The name of a Contact, with the star of an Ally wherever it shows, never its colour alone (spec UX §1). */
export function ContactName({ contact }: { contact: Pick<SummaryContact, 'name' | 'status'> }) {
  return (
    <>
      {contact.name}
      {contact.status === 'ally' && (
        <>
          {' '}
          <Star aria-hidden="true" className="inline size-3 shrink-0 fill-current align-baseline" />
          <span className="sr-only">{m.status_ally()}</span>
        </>
      )}
    </>
  );
}
