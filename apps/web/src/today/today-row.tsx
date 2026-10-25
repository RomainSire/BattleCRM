import { m } from '@battlecrm/i18n';
import { cn } from 'cn';
import type { ReactNode } from 'react';

import { organizationOf, type Summary, type SummaryContact } from '../summary.ts';
import { TodayContactLink } from './contact-link.tsx';

/**
 * A row of Today (spec UX §5.1): the name of its Contact, which opens its record, marked “Ally” for
 * an Ally; its Organization, and Stage while Prospecting; what calls for a gesture; its actions, above
 * the name stretched over the row.
 */
export function Row({
  contact,
  summary,
  line,
  isLate,
  isOpen,
  asPage,
  as: Element = 'li',
  children,
}: {
  contact: SummaryContact;
  summary: Summary;
  line: string;
  /** The line says how overdue: amber, never the colour alone. */
  isLate: boolean;
  isOpen: boolean;
  /** On a phone, the record is a page. */
  asPage: boolean;
  /** In a list, or alone: the card shown on a phone. */
  as?: 'li' | 'div';
  children: ReactNode;
}) {
  const organization = organizationOf(contact, summary);
  const stage =
    contact.status === 'prospecting'
      ? summary.stages.find(({ id }) => id === contact.stageId)
      : undefined;
  return (
    <Element
      className={cn(
        'group relative grid gap-2 rounded-card border bg-background p-3 hover:bg-surface/50 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4',
        isOpen && 'shadow-[inset_3px_0_0_var(--accent-text)]',
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <TodayContactLink contact={contact} isOpen={isOpen} asPage={asPage} />
          {/* The star of the name already says it to a screen reader. */}
          {contact.status === 'ally' && (
            <span aria-hidden="true" className="text-xs text-muted-foreground">
              {m.status_ally()}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {organization?.name ?? m.no_organization()}
          {stage && ` · ${stage.name}`}
        </span>
        <span className={cn('text-xs', isLate ? 'font-medium text-overdue' : 'text-neutral-text')}>
          {line}
        </span>
      </div>
      <div className="relative flex flex-wrap gap-2 md:justify-end">{children}</div>
    </Element>
  );
}
