import { funnelEntriesInWeek } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { cn } from 'cn';
import { useId } from 'react';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { useAddContact } from '../contacts/add-contact-context.ts';
import { STATUS_VERB } from '../contacts/status.ts';
import { settingsOf } from '../settings/use-settings.ts';
import { Kbd } from '../shell/kbd.tsx';
import { organizationOf, type Summary, type SummaryContact } from '../summary.ts';
import { TodayContactLink } from './contact-link.tsx';

/**
 * The Funnel entries of the week against the Entry goal in effect (spec UX §5.1): “2/5”, in the
 * success colour once reached, “6/5” past it, without celebration; without a goal, “3 this week”.
 */
function EntriesCount({ summary, today }: { summary: Summary; today: string }) {
  const count = funnelEntriesInWeek(summary.contacts, today);
  const goal = settingsOf(summary).entryGoal.inEffect;
  if (goal === null) {
    return (
      <>
        {m.today_entries()}{' '}
        <span className="tabular-nums">{m.today_entries_count_no_goal({ count })}</span>
      </>
    );
  }
  return (
    <>
      {m.today_entries_week()}{' '}
      <span className={cn('tabular-nums', count >= goal && 'text-success')}>
        <span aria-hidden="true">{m.today_entries_count({ count, goal })}</span>
        <span className="sr-only">{m.today_entries_label({ count, goal })}</span>
      </span>
    </>
  );
}

/**
 * The Entries banner, at the top of Today (spec UX §5.1): the entries of the week, then the Contacts
 * of the Pool picked for the day, each with its Organization, the last Stage it reached or “never
 * entered”, and “Bring in…”; kept once the goal is reached. An empty Pool: “Add a Contact” instead.
 */
export function EntriesBanner({
  summary,
  today,
  picked,
  isError,
  openContactId,
  asPage,
  onBringIn,
}: {
  summary: Summary;
  today: string;
  /** The Contacts of the Pool picked for the day, still in the Pool; `undefined` while read. */
  picked: SummaryContact[] | undefined;
  isError: boolean;
  /** The Contact whose record is open. */
  openContactId: string | undefined;
  asPage: boolean;
  onBringIn: (contactId: string) => void;
}) {
  const headingId = useId();
  const addContact = useAddContact();
  const isPoolEmpty = !summary.contacts.some(({ status }) => status === 'pool');
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-card border p-3">
      <h2 id={headingId} className="font-semibold">
        <EntriesCount summary={summary} today={today} />
      </h2>
      {isPoolEmpty ? (
        <Button
          variant="outline"
          className="self-start"
          aria-keyshortcuts="N"
          onPress={() => addContact()}
        >
          {m.add_contact()}
          <Kbd>N</Kbd>
        </Button>
      ) : isError ? (
        <ErrorMessage>{m.today_picks_load_error()}</ErrorMessage>
      ) : (
        picked !== undefined &&
        picked.length > 0 && (
          <ul aria-label={m.today_entries_picks()} className="grid gap-2 sm:grid-cols-3">
            {picked.map((contact) => {
              const organization = organizationOf(contact, summary);
              const stage = summary.stages.find(({ id }) => id === contact.stageId);
              return (
                <li
                  key={contact.id}
                  className="group relative flex min-w-0 flex-col gap-1 rounded-card border bg-background p-3 hover:bg-surface/50"
                >
                  <TodayContactLink
                    contact={contact}
                    isOpen={contact.id === openContactId}
                    asPage={asPage}
                  />
                  <span className="text-xs text-muted-foreground">
                    {organization?.name ?? m.no_organization()} ·{' '}
                    {stage
                      ? m.today_entries_last_stage({ stage: stage.name })
                      : m.today_entries_never_entered()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="relative self-start font-semibold max-md:min-h-11"
                    onPress={() => onBringIn(contact.id)}
                  >
                    {STATUS_VERB.prospecting()}
                  </Button>
                </li>
              );
            })}
          </ul>
        )
      )}
    </section>
  );
}
