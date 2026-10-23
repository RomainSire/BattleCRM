import { funnelOf, isFollowUpDue, targetOf } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { cn } from 'cn';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { MenuItem, MoreActions } from '../components/ui/menu.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table.tsx';
import { useLocale } from '../i18n.ts';
import {
  organizationOf,
  positioningsOf,
  stageEnteredOnOf,
  trialOf,
  type Summary,
} from '../summary.ts';
import { ContactName } from '../contacts/contact-name.tsx';
import { formatLocalDay } from '../contacts/format.ts';
import { targetText } from '../contacts/organization-field.tsx';
import { followUpText, trialText, type Card, type OpenGesture } from './next-action.tsx';

type ColumnId =
  'contact' | 'organization' | 'target' | 'stage' | 'trial' | 'follow-up' | 'stage-entered';

/** The columns of the table (spec UX §5.2), each sorted by what it shows. */
const COLUMNS: { id: ColumnId; label: () => string }[] = [
  { id: 'contact', label: m.funnel_column_contact },
  { id: 'organization', label: m.contact_organization },
  { id: 'target', label: m.funnel_filter_target },
  { id: 'stage', label: m.contact_stage },
  { id: 'trial', label: m.funnel_column_trial },
  { id: 'follow-up', label: m.funnel_column_follow_up },
  { id: 'stage-entered', label: m.funnel_column_stage_entered },
];

type SortValue = string | number | undefined;

/** What each column sorts a Contact by; `undefined`, nothing to show, always last. */
const SORT_VALUE: Record<ColumnId, (card: Card, summary: Summary) => SortValue> = {
  contact: ({ contact }) => contact.name,
  organization: (card, summary) => organizationOf(card.contact, summary)?.name,
  target: (card, summary) => targetText(targetOf(organizationOf(card.contact, summary))),
  // In the order of the Funnel.
  stage: ({ contact }, summary) =>
    funnelOf(summary.stages).findIndex(({ id }) => id === contact.stageId),
  trial: ({ contact }, summary) => {
    const trial = trialOf(contact);
    return positioningsOf(summary).find(({ id }) => id === trial?.positioningId)?.label;
  },
  'follow-up': ({ contact }) => contact.followUp?.dueOn,
  'stage-entered': ({ contact }) => stageEnteredOnOf(contact) ?? undefined,
};

/** Sorted by a column, the order of urgency kept between equals; without a sort, by urgency. */
function sorted(cards: Card[], sort: SortDescriptor | undefined, summary: Summary): Card[] {
  const column = COLUMNS.find(({ id }) => id === sort?.column)?.id;
  if (!sort || !column) return cards;
  const sign = sort.direction === 'descending' ? -1 : 1;
  return cards.toSorted((a, b) => {
    const x = SORT_VALUE[column](a, summary);
    const y = SORT_VALUE[column](b, summary);
    if (x === undefined || y === undefined)
      return (x === undefined ? 1 : 0) - (y === undefined ? 1 : 0);
    const order =
      typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return sign * order;
  });
}

/** What a cell says when there is nothing: a dash, and in words to a screen reader. */
function Nothing({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden="true" className="text-muted-foreground">
        —
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
}

/**
 * The Funnel as a table (spec UX §5.2): the Contacts Prospecting by urgency, or by a column; the Stage
 * changes in the row, through the window of consequences; the name opens the record.
 */
export function FunnelTable({
  cards,
  summary,
  today,
  onOpen,
}: {
  cards: Card[];
  summary: Summary;
  today: string;
  onOpen: OpenGesture;
}) {
  const locale = useLocale();
  const [sort, setSort] = useState<SortDescriptor>();
  const stages = funnelOf(summary.stages);
  const rows = sorted(cards, sort, summary);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {sort && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onPress={() => setSort(undefined)}
        >
          {m.funnel_sort_by_urgency()}
        </Button>
      )}
      <Table
        aria-label={m.funnel_table()}
        {...(sort && { sortDescriptor: sort })}
        onSortChange={setSort}
        className="rounded-card border"
      >
        <TableHeader>
          {COLUMNS.map(({ id, label }) => (
            <TableHead key={id} id={id} isRowHeader={id === 'contact'} allowsSorting>
              {({ sortDirection }) => (
                <span className="inline-flex items-center gap-1">
                  {label()}
                  {sortDirection === 'ascending' && (
                    <ArrowUp aria-hidden="true" className="size-3.5" />
                  )}
                  {sortDirection === 'descending' && (
                    <ArrowDown aria-hidden="true" className="size-3.5" />
                  )}
                </span>
              )}
            </TableHead>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map((card) => {
            const { contact } = card;
            const organization = organizationOf(card.contact, summary);
            const stage = stages.find(({ id }) => id === contact.stageId);
            const trial = trialText(card, summary, locale);
            const enteredOn = stageEnteredOnOf(contact);
            return (
              <TableRow key={contact.id} id={contact.id}>
                <TableCell>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto px-0 font-medium text-foreground"
                    onPress={() => onOpen(contact.id, { panel: 'record' })}
                  >
                    <ContactName contact={contact} />
                  </Button>
                </TableCell>
                <TableCell>{organization?.name ?? m.no_organization()}</TableCell>
                <TableCell>{targetText(targetOf(organization))}</TableCell>
                <TableCell>
                  <MoreActions
                    trigger={{
                      text: stage?.name ?? '',
                      label: m.funnel_stage_of({ name: contact.name, stage: stage?.name ?? '' }),
                    }}
                    onAction={(stageId) => onOpen(contact.id, { stageTo: String(stageId) })}
                  >
                    {stages
                      .filter(({ id }) => id !== contact.stageId)
                      .map(({ id, name }) => (
                        <MenuItem key={id} id={id}>
                          {name}
                        </MenuItem>
                      ))}
                  </MoreActions>
                </TableCell>
                <TableCell className="text-neutral-text">
                  {trial ?? <Nothing label={m.funnel_no_trial()} />}
                </TableCell>
                <TableCell
                  className={cn(
                    contact.followUp && isFollowUpDue(contact.followUp.dueOn, today)
                      ? 'font-medium text-overdue'
                      : 'text-neutral-text',
                  )}
                >
                  {contact.followUp ? (
                    followUpText(contact.followUp, today, locale)
                  ) : (
                    <Nothing label={m.funnel_no_follow_up()} />
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  {enteredOn ? (
                    formatLocalDay(enteredOn, locale)
                  ) : (
                    <Nothing label={m.funnel_stage_entered_unknown()} />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
