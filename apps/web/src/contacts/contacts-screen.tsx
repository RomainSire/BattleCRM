import type { ContactStatus } from '@battlecrm/contract';
import { contactsMatching } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { useDeferredValue, useRef, useState } from 'react';
import { SearchField } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { Input } from '../components/ui/input.tsx';
import {
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '../components/ui/segmented-control.tsx';
import { useLocale } from '../i18n.ts';
import { Screen } from '../screens/screen.tsx';
import { useApi } from '../session.ts';
import { Kbd } from '../shell/kbd.tsx';
import { summaryQuery, type Summary, type SummaryContact } from '../summary.ts';
import { useIsNarrow } from '../use-narrow.ts';
import { useAddContact } from './add-contact-context.ts';
import { ContactName } from './contact-name.tsx';
import { ContactPanel } from './contact-record.tsx';
import { formatLocalDay, initialOf } from './format.ts';
import { prospectingStageOf, STATUS_LABEL } from './status.ts';

/** The latest Interaction first (spec UX §5.10). */
const byLatestInteraction = (a: SummaryContact, b: SummaryContact) =>
  b.lastInteractionAt.localeCompare(a.lastInteractionAt) || b.id.localeCompare(a.id);

/** The chips of the list: All leaves the Archived out (spec UX §5.10). */
type Filter = 'all' | ContactStatus;
const FILTERS: { id: Filter; label: () => string }[] = [
  { id: 'all', label: m.contacts_filter_all },
  { id: 'pool', label: m.contacts_filter_pool },
  { id: 'prospecting', label: m.contacts_filter_prospecting },
  { id: 'ally', label: m.contacts_filter_allies },
  { id: 'archived', label: m.contacts_filter_archived },
];
const isShown = (filter: Filter, { status }: SummaryContact) =>
  filter === 'all' ? status !== 'archived' : status === filter;

/** The id of the row of a Contact, which the focus goes back to when its panel closes. */
const rowId = (contactId: string) => `contact-row-${contactId}`;

/** The second line of a row, by Status (spec UX §5.10). */
function rowDetails(contact: SummaryContact, summary: Summary) {
  const organization =
    summary.organizations.find(({ id }) => id === contact.organizationId)?.name ??
    m.no_organization();
  const stage = prospectingStageOf(contact, summary.stages);
  return `${organization} · ${stage ?? STATUS_LABEL[contact.status]()}`;
}

function ContactRow({
  contact,
  summary,
  asPage,
  onOpen,
}: {
  contact: SummaryContact;
  summary: Summary;
  /** On mobile, a row opens the record as a page. */
  asPage: boolean;
  onOpen: () => void;
}) {
  const locale = useLocale();
  const archived = contact.status === 'archived';
  const body = (
    <>
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-medium uppercase"
      >
        {initialOf(contact.name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          data-slot="contact-name"
          className={cn('truncate', archived ? 'text-neutral-text' : 'font-medium')}
        >
          <ContactName contact={contact} />
        </span>
        <span className="truncate text-xs text-neutral-text">{rowDetails(contact, summary)}</span>
        {/* No Follow-up nor Trial yet: their signal comes with their tickets (21, 28). */}
        {contact.status === 'prospecting' && (
          <span className="text-xs text-neutral-text">{m.no_next_action()}</span>
        )}
        {/* Archived, greyed with its reason (spec UX §5.10). */}
        {archived && contact.statusReason && (
          <span className="truncate text-xs text-neutral-text">{contact.statusReason}</span>
        )}
      </span>
      <span className="shrink-0 self-start text-xs text-muted-foreground tabular-nums">
        <span className="sr-only">{m.last_interaction()} </span>
        <time dateTime={contact.lastInteractionOn}>
          {formatLocalDay(contact.lastInteractionOn, locale)}
        </time>
      </span>
    </>
  );
  // The row whose record is open is the link to the current address: TanStack Router marks it `aria-current="page"`.
  const className =
    'flex min-h-11 items-center gap-3 px-3 py-2 focus-ring -outline-offset-2 hover:bg-surface aria-[current=page]:bg-surface aria-[current=page]:shadow-[inset_3px_0_0_var(--accent-text)]';
  return (
    <li>
      {asPage ? (
        <Link
          id={rowId(contact.id)}
          to="/contacts/$contactId"
          params={{ contactId: contact.id }}
          className={className}
        >
          {body}
        </Link>
      ) : (
        <Link
          id={rowId(contact.id)}
          to="/contacts"
          search={{ contact: contact.id }}
          onClick={onOpen}
          className={className}
        >
          {body}
        </Link>
      )}
    </li>
  );
}

/**
 * Contacts (spec UX §5.10): find one person, then read their record in a panel anchored to the
 * right, kept in the address (ST-70). The search reads the summary as it is typed, without a round
 * trip (ST-63).
 */
export function ContactsScreen() {
  useLocale();
  const api = useApi();
  const navigate = useNavigate();
  const addContact = useAddContact();
  const isNarrow = useIsNarrow();
  const { data: summary, isError } = useQuery(summaryQuery(api));
  const { contact: openedId } = useSearch({ from: '/app/contacts' });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const typed = useDeferredValue(query);
  // A row opened by the User moves the focus into the panel (ST-66); an address alone does not.
  // The panel is mounted again for each Contact, so its heading comes back here each time.
  const panelHeading = useRef<HTMLHeadingElement | null>(null);
  const focusPanel = useRef(false);
  const onPanelHeading = (heading: HTMLHeadingElement | null) => {
    panelHeading.current = heading;
    if (!heading || !focusPanel.current) return;
    focusPanel.current = false;
    heading.focus();
  };

  // On mobile, the record opens as a page: so does a panel asked for by its address.
  if (isNarrow && openedId) {
    return <Navigate to="/contacts/$contactId" params={{ contactId: openedId }} replace />;
  }

  const closePanel = () => {
    const closed = openedId;
    void navigate({ to: '/contacts', search: {} }).then(() => {
      if (closed) document.getElementById(rowId(closed))?.focus();
    });
  };

  let content;
  if (summary === undefined) {
    // Kept on the device, the summary still reads when the API does not answer (ADR 0004).
    content = <ErrorMessage>{isError && m.contacts_load_error()}</ErrorMessage>;
  } else if (summary.contacts.length === 0) {
    content = (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <p className="font-medium">{m.contacts_empty_title()}</p>
        <p className="text-muted-foreground">{m.contacts_empty_body()}</p>
        <Button className="mt-2" aria-keyshortcuts="N" onPress={addContact}>
          {m.add_contact()}
          <Kbd>N</Kbd>
        </Button>
      </div>
    );
  } else {
    const found = contactsMatching(typed, summary.contacts, summary.organizations);
    const contacts = found
      .filter((contact) => isShown(filter, contact))
      .toSorted(byLatestInteraction);
    const archivedHidden =
      filter === 'all' ? found.filter(({ status }) => status === 'archived').length : 0;
    content = (
      <div
        className={cn(
          'grid items-start gap-4',
          openedId && 'md:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]',
        )}
      >
        <div className="flex max-w-2xl min-w-0 flex-col gap-3">
          <SearchField aria-label={m.contacts_search()} value={query} onChange={setQuery}>
            <Input placeholder={m.contacts_search()} className="max-md:h-11" />
          </SearchField>
          <SegmentedControl
            aria-label={m.contacts_filter()}
            value={filter}
            onChange={(value) => {
              const chosen = FILTERS.find(({ id }) => id === value);
              if (chosen) setFilter(chosen.id);
            }}
          >
            <SegmentedControlItems className="flex-wrap">
              {FILTERS.map(({ id, label }) => (
                <SegmentedControlItem key={id} value={id} className="px-2.5">
                  {label()}
                </SegmentedControlItem>
              ))}
            </SegmentedControlItems>
          </SegmentedControl>
          {archivedHidden > 0 && (
            <p className="text-xs text-muted-foreground">
              {m.contacts_archived_hidden({ count: archivedHidden })} ·{' '}
              <Button
                variant="link"
                className="h-auto p-0 text-xs"
                onPress={() => setFilter('archived')}
              >
                {m.contacts_show_archived()}
              </Button>
            </p>
          )}
          {contacts.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">{m.contacts_no_match()}</p>
          ) : (
            <ul aria-label={m.contacts()} className="flex flex-col divide-y rounded-card border">
              {contacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  summary={summary}
                  asPage={isNarrow}
                  onOpen={() => {
                    if (contact.id === openedId) panelHeading.current?.focus();
                    else focusPanel.current = true;
                  }}
                />
              ))}
            </ul>
          )}
        </div>
        {openedId && (
          <div className="sticky top-4 max-md:hidden">
            <ContactPanel
              key={openedId}
              contactId={openedId}
              headingRef={onPanelHeading}
              onClose={closePanel}
            />
          </div>
        )}
      </div>
    );
  }
  return <Screen title={m.contacts()}>{content}</Screen>;
}
