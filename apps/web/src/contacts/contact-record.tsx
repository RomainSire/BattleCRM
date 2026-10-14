import { m } from '@battlecrm/i18n';
import { targetOf } from '@battlecrm/domain';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { InferResponseType } from 'hono/client';
import { X } from 'lucide-react';
import { useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { useLocale } from '../i18n.ts';
import { useApi, type ApiClient } from '../session.ts';
import { contactRecordKey, summaryQuery, type Summary, type SummaryContact } from '../summary.ts';
import { ContactName } from './contact-name.tsx';
import { EditCoordinates } from './edit-coordinates.tsx';
import { formatLocalDay } from './format.ts';
import { targetText } from './organization-field.tsx';
import { prospectingStageOf, STATUS_LABEL } from './status.ts';

/** What the record of a Contact reads beyond the summary: its note and its thread. */
type ContactRecord = InferResponseType<ApiClient['contacts'][':id']['record']['$get'], 200>;
type ThreadEntry = ContactRecord['thread'][number];

/** Read on demand, when a record opens (spec stack §3); never kept on the device. */
export const contactRecordQuery = (api: ApiClient, contactId: string) =>
  queryOptions({
    queryKey: contactRecordKey(contactId),
    queryFn: async (): Promise<ContactRecord> => {
      const response = await api.contacts[':id'].record.$get({ param: { id: contactId } });
      if (!response.ok) throw new Error('GET /api/contacts/:id/record failed');
      return response.json();
    },
    retry: false,
  });

/** The Contact of the summary, and its Organization; `contact` stays undefined while the summary is not read. */
function useSummaryContact(contactId: string) {
  const api = useApi();
  const { data: summary, isError } = useQuery(summaryQuery(api));
  const contact = summary?.contacts.find(({ id }) => id === contactId);
  return { summary, contact, isError };
}

const organizationOf = (contact: SummaryContact, summary: Summary) =>
  summary.organizations.find(({ id }) => id === contact.organizationId);

/** The Target of a Contact as the User reads it. */
const targetLabel = (contact: SummaryContact, summary: Summary) =>
  targetText(targetOf(organizationOf(contact, summary)));

/** The Stage of a Contact Prospecting, with its aim. */
function stageLabel(contact: SummaryContact, summary: Summary) {
  const stage = summary.stages.find(({ id }) => id === contact.stageId);
  if (contact.status !== 'prospecting' || !stage) return undefined;
  return stage.aim === null ? stage.name : `${stage.name} · ${stage.aim}`;
}

/** What an entry of the thread says: for now, the additions and the changes of Status, discreetly. */
function threadEntryLabel({ statusChange }: ThreadEntry, summary: Summary) {
  if (!statusChange) return undefined;
  const { fromStatus, toStatus, stageId, reason } = statusChange;
  let label;
  if (fromStatus === null && toStatus === 'pool') label = m.thread_added_pool();
  else if (fromStatus === null && toStatus === 'ally') label = m.thread_added_ally();
  else if (fromStatus === null && toStatus === 'prospecting') {
    const stage = summary.stages.find(({ id }) => id === stageId);
    label = m.thread_added_prospecting({ stage: stage?.name ?? '' });
  } else {
    label = m.thread_status_changed({
      from: fromStatus === null ? '' : STATUS_LABEL[fromStatus](),
      to: STATUS_LABEL[toStatus](),
    });
  }
  return reason === null ? label : `${label} · ${reason}`;
}

const Pill = ({ children }: { children: ReactNode }) => (
  <span className="rounded-control border px-1.5 py-0.5 text-xs text-neutral-text">{children}</span>
);

/** The head of a record: name, Organization and Target, Stage and Status, LinkedIn (spec UX §5.3). */
function RecordHeader({
  contact,
  summary,
  level,
  headingId,
  headingRef,
}: {
  contact: SummaryContact;
  summary: Summary;
  level: 1 | 2;
  headingId?: string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  const organization = organizationOf(contact, summary);
  const stage = stageLabel(contact, summary);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Heading
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className={`${level === 1 ? 'text-lg' : 'text-base'} font-semibold outline-none`}
      >
        <ContactName contact={contact} />
      </Heading>
      <p className="text-muted-foreground">
        {organization
          ? `${organization.name} · ${targetLabel(contact, summary)}`
          : m.no_organization()}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {stage && <Pill>{stage}</Pill>}
        <Pill>{STATUS_LABEL[contact.status]()}</Pill>
        {contact.linkedinUrl && (
          <a
            href={contact.linkedinUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-control text-xs text-accent-text underline-offset-4 focus-ring hover:underline"
          >
            {m.contact_linkedin()}
          </a>
        )}
      </div>
    </div>
  );
}

/** The thread, read on demand: from the latest Interaction to the earliest (spec UX §5.3). */
function Thread({ contactId, summary }: { contactId: string; summary: Summary }) {
  const locale = useLocale();
  const api = useApi();
  const { data: record, isError } = useQuery(contactRecordQuery(api, contactId));
  if (isError) return <ErrorMessage>{m.contact_thread_load_error()}</ErrorMessage>;
  if (!record) return null;
  return (
    <ol aria-label={m.contact_thread()} className="flex flex-col gap-2">
      {record.thread.map((entry) => (
        <li key={entry.id} className="flex justify-between gap-3 text-xs text-muted-foreground">
          <span>{threadEntryLabel(entry, summary)}</span>
          <time dateTime={entry.localDate} className="shrink-0">
            {formatLocalDay(entry.localDate, locale)}
          </time>
        </li>
      ))}
    </ol>
  );
}

/**
 * The Coordinates of a Contact (spec UX §5.3), edited in place by “Edit” (§6.12), which gets the focus
 * back once the edit is saved or cancelled; the note comes with the thread.
 */
function Coordinates({
  contact,
  summary,
  level,
  className,
}: {
  contact: SummaryContact;
  summary: Summary;
  level: 2 | 3;
  className?: string;
}) {
  const api = useApi();
  const { data: record } = useQuery(contactRecordQuery(api, contact.id));
  const headingId = useId();
  const [isEditing, setIsEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const Heading = level === 2 ? 'h2' : 'h3';
  const link = 'rounded-control text-accent-text underline-offset-4 focus-ring hover:underline';
  const rows: { label: string; value: ReactNode }[] = [
    { label: m.contact_job_title(), value: contact.jobTitle },
    {
      label: m.contact_organization(),
      value: organizationOf(contact, summary)?.name ?? m.no_organization(),
    },
    { label: m.contact_target(), value: targetLabel(contact, summary) },
    {
      label: m.contact_email(),
      value: contact.email && (
        <a href={`mailto:${contact.email}`} className={link}>
          {contact.email}
        </a>
      ),
    },
    {
      label: m.contact_phone(),
      value: contact.phone && (
        <a href={`tel:${contact.phone}`} className={link}>
          {contact.phone}
        </a>
      ),
    },
    {
      label: m.contact_linkedin(),
      value: contact.linkedinUrl && (
        <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className={link}>
          {contact.linkedinUrl.replace(/^https:\/\//u, '')}
        </a>
      ),
    },
    {
      label: m.contact_note(),
      value: record?.note && <span className="whitespace-pre-line">{record.note}</span>,
    },
    { label: m.contact_stage(), value: prospectingStageOf(contact, summary.stages) },
    { label: m.contact_status(), value: STATUS_LABEL[contact.status]() },
  ];
  return (
    <section aria-labelledby={headingId} className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Heading id={headingId} className="text-xs font-semibold text-muted-foreground uppercase">
          {m.contact_coordinates()}
        </Heading>
        {!isEditing && (
          <Button
            ref={editButton}
            variant="ghost"
            size="xs"
            className="max-md:min-h-11"
            // The note, with the record, is edited too: it must be read first.
            isDisabled={!record}
            onPress={() => setIsEditing(true)}
          >
            {m.edit()}
          </Button>
        )}
      </div>
      {isEditing && record ? (
        <EditCoordinates
          contact={contact}
          note={record.note}
          summary={summary}
          onDone={() => {
            setIsEditing(false);
            // Once the button is back.
            requestAnimationFrame(() => editButton.current?.focus());
          }}
        />
      ) : (
        <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
          {rows
            .filter(({ value }) => value)
            .map(({ label, value }) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
        </dl>
      )}
    </section>
  );
}

/** While the summary is read: nothing, or why it cannot be. */
const SummaryMissing = ({ isError }: { isError: boolean }) => (
  <ErrorMessage>{isError && m.contacts_load_error()}</ErrorMessage>
);

const tabClass =
  'cursor-default rounded-control px-2 py-1 text-muted-foreground focus-ring data-hovered:text-foreground data-selected:bg-surface data-selected:font-medium data-selected:text-foreground';

/**
 * The record in a panel, anchored next to the list of Contacts (spec UX §5.3, §5.10): no modal, a
 * region of the layout (ST-66). Its heading takes the focus when a row opens it; `Escape` closes it.
 */
export function ContactPanel({
  contactId,
  headingRef,
  onClose,
}: {
  contactId: string;
  headingRef: Ref<HTMLHeadingElement>;
  onClose: () => void;
}) {
  useLocale();
  const { summary, contact, isError } = useSummaryContact(contactId);
  const headingId = useId();
  const close = (
    <Button variant="ghost" size="icon-sm" aria-label={m.close()} onPress={onClose}>
      <X />
    </Button>
  );
  if (!summary) return <SummaryMissing isError={isError} />;
  if (!contact) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-card border p-4">
        <p className="text-muted-foreground">{m.contact_unknown()}</p>
        {close}
      </div>
    );
  }
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape from any control inside the panel, while the focus is there.
    <section
      aria-labelledby={headingId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      className="flex flex-col gap-3 rounded-card border p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <RecordHeader
          contact={contact}
          summary={summary}
          level={2}
          headingId={headingId}
          headingRef={headingRef}
        />
        {close}
      </div>
      <Tabs>
        <TabList aria-label={contact.name} className="flex gap-1 border-b pb-2">
          <Tab id="thread" className={tabClass}>
            {m.contact_thread()}
          </Tab>
          <Tab id="details" className={tabClass}>
            {m.contact_details()}
          </Tab>
        </TabList>
        <TabPanel id="thread" className="rounded-control pt-3 focus-ring">
          <Thread contactId={contactId} summary={summary} />
        </TabPanel>
        <TabPanel id="details" className="rounded-control pt-3 focus-ring">
          <Coordinates contact={contact} summary={summary} level={3} />
        </TabPanel>
      </Tabs>
      <Link
        to="/contacts/$contactId"
        params={{ contactId }}
        className="self-start rounded-control text-accent-text underline-offset-4 focus-ring hover:underline"
      >
        {m.open_as_page()}
      </Link>
    </section>
  );
}

/** The record as a page of its own, under Contacts (spec UX §3.1, §5.3); stacked on mobile. */
export function ContactPage({ contactId }: { contactId: string }) {
  useLocale();
  const { summary, contact, isError } = useSummaryContact(contactId);
  const threadHeadingId = useId();
  const backToContacts = (
    <Link to="/contacts" className="rounded-control underline-offset-4 focus-ring hover:underline">
      {m.contacts()}
    </Link>
  );
  return (
    <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
      <title>{`${contact?.name ?? m.contacts()} · BattleCRM`}</title>
      {!summary ? (
        <SummaryMissing isError={isError} />
      ) : !contact ? (
        <>
          <p className="text-muted-foreground">{m.contact_unknown()}</p>
          <p>{backToContacts}</p>
        </>
      ) : (
        <>
          <nav aria-label={m.breadcrumb()}>
            <ol className="flex gap-1.5 text-xs text-muted-foreground">
              <li>{backToContacts}</li>
              <li aria-hidden="true">›</li>
              <li aria-current="page" className="truncate">
                {contact.name}
              </li>
            </ol>
          </nav>
          <RecordHeader contact={contact} summary={summary} level={1} />
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
            {/* Stacked on mobile, the Coordinates come first (spec UX §5.3). */}
            <Coordinates
              contact={contact}
              summary={summary}
              level={2}
              className="self-start rounded-card border p-4 md:col-start-2 md:row-start-1"
            />
            <section aria-labelledby={threadHeadingId} className="md:col-start-1 md:row-start-1">
              <h2
                id={threadHeadingId}
                className="mb-2 text-xs font-semibold text-muted-foreground uppercase"
              >
                {m.contact_thread()}
              </h2>
              <Thread contactId={contactId} summary={summary} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
