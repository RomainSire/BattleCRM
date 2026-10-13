import type { ContactStatus } from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';
import { useQuery } from '@tanstack/react-query';

import { ErrorMessage } from '../components/ui/error-message.tsx';
import { useLocale, type Locale } from '../i18n.ts';
import { Screen } from '../screens/screen.tsx';
import { useApi } from '../session.ts';
import { summaryQuery, type SummaryContact } from '../summary.ts';

const STATUS_LABEL: Record<ContactStatus, () => string> = {
  pool: m.status_pool,
  prospecting: m.status_prospecting,
  ally: m.status_ally,
  archived: m.status_archived,
};

/** A local day (`YYYY-MM-DD`) as the User reads it: already a day of its own time zone, never shifted by the device's. */
const formatLocalDay = (day: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  );

/** The first letter of a name, whole even when it is made of several code points. */
const initialOf = (name: string) =>
  new Intl.Segmenter().segment(name)[Symbol.iterator]().next().value?.segment;

/** The latest Interaction first (spec UX §5.10). */
const byLatestInteraction = (a: SummaryContact, b: SummaryContact) =>
  b.lastInteractionAt.localeCompare(a.lastInteractionAt) || b.id.localeCompare(a.id);

/** Contacts (spec UX §5.10), in its first form: the list, read from the working summary. */
export function ContactsScreen() {
  const locale = useLocale();
  const api = useApi();
  const { data: summary, isError } = useQuery(summaryQuery(api));
  const contacts = summary?.contacts.toSorted(byLatestInteraction);
  return (
    <Screen title={m.contacts()}>
      {/* Kept on the device, the summary still reads when the API does not answer (ADR 0004). */}
      {contacts === undefined ? (
        <ErrorMessage>{isError && m.contacts_load_error()}</ErrorMessage>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col gap-1 py-8 text-center">
          <p className="font-medium">{m.contacts_empty_title()}</p>
          <p className="text-muted-foreground">{m.contacts_empty_body()}</p>
        </div>
      ) : (
        <ul
          aria-label={m.contacts()}
          className="flex max-w-2xl flex-col divide-y rounded-card border"
        >
          {contacts.map((contact) => (
            <li key={contact.id} className="flex min-h-11 items-center gap-3 px-3 py-2">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-medium uppercase"
              >
                {initialOf(contact.name)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span data-slot="contact-name" className="truncate font-medium">
                  {contact.name}
                </span>
                <span className="text-xs text-neutral-text">{STATUS_LABEL[contact.status]()}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                <span className="sr-only">{m.last_interaction()} </span>
                <time dateTime={contact.lastInteractionOn}>
                  {formatLocalDay(contact.lastInteractionOn, locale)}
                </time>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
