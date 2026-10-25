import { targetOf, type AllySignal } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { AlarmClock } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { useAddContact } from '../contacts/add-contact-context.ts';
import { ContactName } from '../contacts/contact-name.tsx';
import { PickContact } from '../contacts/pick-contact.tsx';
import {
  ContactPanel,
  RecordGesturePanels,
  useRecordGestures,
} from '../contacts/contact-record.tsx';
import { formatLocalDay, formatWeekDay } from '../contacts/format.ts';
import { targetText } from '../contacts/organization-field.tsx';
import type { FunnelGestureSearch } from '../funnel/next-action.tsx';
import { useLocale, type Locale } from '../i18n.ts';
import { ROW_LINK_CLASS } from '../screens/row-link.ts';
import { Screen } from '../screens/screen.tsx';
import { useApi } from '../session.ts';
import { settingsOf } from '../settings/use-settings.ts';
import {
  organizationOf,
  summaryQuery,
  todayOf,
  type Summary,
  type SummaryContact,
} from '../summary.ts';
import { useIsNarrow } from '../use-narrow.ts';
import { allySignalOf, TIER_LABEL, TIERS, type Tier } from './ally-signal.ts';
import { RhythmGauge } from './rhythm-gauge.tsx';

/** An Ally of the Circle, with where it stands today. */
type Ally = { contact: SummaryContact; signal: AllySignal };

/** How a row opens a gesture on its Ally, or its record: kept by the address (ST-70). */
type OpenGesture = (contactId: string, search: FunnelGestureSearch) => void;

/** The colour of the Days since contact, the tier being written beside: never the colour alone (spec UX §5.11). */
const DAYS_CLASS: Record<Tier, string> = {
  'time-to-check-in': 'font-medium text-overdue',
  soon: 'text-soon-text',
  none: 'text-neutral-text',
};

/** The Allies, each in its tier, the most Days since contact first (spec UX §5.11). */
function tiersOf(summary: Summary, today: string): Record<Tier, Ally[]> {
  const allies = summary.contacts
    .filter(({ status }) => status === 'ally')
    .map((contact) => ({ contact, signal: allySignalOf(contact, summary, today) }))
    .toSorted(
      (a, b) =>
        b.signal.daysSinceContact - a.signal.daysSinceContact ||
        a.contact.name.localeCompare(b.contact.name),
    );
  return {
    'time-to-check-in': allies.filter(({ signal }) => signal.signal === 'time-to-check-in'),
    soon: allies.filter(({ signal }) => signal.signal === 'soon'),
    none: allies.filter(({ signal }) => signal.signal === 'none'),
  };
}

/** The scheduled Follow-up of an Ally, which comes before the Rhythm: “⏰ Follow-up Wed, Oct 14”. */
function followUpLine(contact: SummaryContact, signal: AllySignal, locale: Locale) {
  if (contact.followUp === null) return undefined;
  const { dueOn } = contact.followUp;
  if (signal.followUp === 'due') {
    return m.circle_follow_up_due({ date: formatWeekDay(dueOn, locale) });
  }
  return m.circle_follow_up({ date: formatWeekDay(dueOn, locale) });
}

/**
 * An Ally (spec UX §5.11): its name, which opens its record, its Organization, Target and latest
 * Interaction; the gauge of the Rhythm and its Days since contact written; Check in…, in bold when it
 * is time, or Follow up… when its Follow-up is due. A row on a desktop, a card on a phone. The whole
 * row opens the record: its name stretches over it (one tab stop), its actions stay above (as the
 * rows of Contacts and Battles); the row whose record is open is marked.
 */
function AllyRow({
  ally: { contact, signal },
  summary,
  isOpen,
  asPage,
  onOpen,
}: {
  ally: Ally;
  summary: Summary;
  isOpen: boolean;
  /** On a phone, the record is a page. */
  asPage: boolean;
  onOpen: OpenGesture;
}) {
  const locale = useLocale();
  const organization = organizationOf(contact, summary);
  const followUp = followUpLine(contact, signal, locale);
  const lastDone = contact.lastDoneInteractionOn;
  const isDue = signal.signal === 'time-to-check-in';
  return (
    <li
      className={cn(
        'group relative grid gap-2 rounded-card border bg-background p-3 hover:bg-surface/50 md:grid-cols-[minmax(0,1fr)_12rem_11rem] md:items-center md:gap-4',
        isOpen && 'shadow-[inset_3px_0_0_var(--accent-text)]',
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        {asPage ? (
          <Link
            to="/contacts/$contactId"
            params={{ contactId: contact.id }}
            className={ROW_LINK_CLASS}
          >
            <ContactName contact={contact} />
          </Link>
        ) : (
          <Link
            to="/circle"
            search={{ contact: contact.id, panel: 'record' }}
            aria-current={isOpen ? 'page' : undefined}
            className={ROW_LINK_CLASS}
          >
            <ContactName contact={contact} />
          </Link>
        )}
        <span className="text-xs text-muted-foreground">
          {organization?.name ?? m.no_organization()} · {targetText(targetOf(organization))}
          {' · '}
          {lastDone === null
            ? m.circle_no_interaction_done()
            : m.circle_last_interaction({ date: formatLocalDay(lastDone, locale) })}
        </span>
        {followUp && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              signal.followUp === 'due' && 'font-medium text-overdue',
            )}
          >
            <AlarmClock aria-hidden="true" className="size-3.5 shrink-0" />
            {followUp}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <RhythmGauge signal={signal} rhythmDays={settingsOf(summary).checkInRhythmDays} />
        <span className={cn('text-xs tabular-nums', DAYS_CLASS[signal.signal])}>
          {m.circle_days_since_contact({ days: signal.daysSinceContact })}
        </span>
      </div>
      {/* Above the name stretched over the row: its own gesture, not the record. */}
      <div className="relative flex flex-wrap gap-2 md:justify-end">
        {signal.followUp === 'due' ? (
          <Button
            variant="outline"
            size="sm"
            className="font-semibold max-md:min-h-11"
            onPress={() => onOpen(contact.id, { followUp: 'do' })}
          >
            {m.verb_follow_up()}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className={cn(isDue ? 'font-semibold' : 'font-normal', 'max-md:min-h-11')}
            onPress={() => onOpen(contact.id, { interaction: 'check-in' })}
          >
            {m.verb_check_in()}
          </Button>
        )}
      </div>
    </li>
  );
}

/** The count of the Circle against its size goal, with a dot per Ally aimed for; or the count alone. */
function CircleCount({ count, goal }: { count: number; goal: number | null }) {
  if (goal === null) {
    return <p className="text-2xl font-semibold tabular-nums">{m.circle_count({ count })}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-2xl font-semibold tabular-nums">
        <span aria-hidden="true">
          {count}/{goal}
        </span>
        <span className="sr-only">{m.circle_count_of_goal({ count, goal })}</span>
      </p>
      <div aria-hidden="true" className="flex flex-wrap gap-1">
        {Array.from({ length: goal }, (_, index) => (
          <span
            key={index}
            data-circle-dot={index < count ? 'filled' : 'empty'}
            className={cn(
              'size-2.5 rounded-full border border-accent',
              index < count && 'bg-accent',
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The Circle (spec UX §5.11): its count against its size goal, “Add to Circle…”, and the Allies in
 * three tiers, Time to check in, Soon, Up to date; the record of an Ally in a panel beside them, and a
 * gesture opened from a row in the same panel as anywhere else, kept by the address (ST-70).
 */
export function CircleScreen() {
  useLocale();
  const api = useApi();
  const navigate = useNavigate();
  const isNarrow = useIsNarrow();
  const { data: summary, isError } = useQuery(summaryQuery(api));
  const current = useSearch({ from: '/app/circle' });
  const { contact: contactId, panel } = current;
  const gestures = useRecordGestures();
  const [isPicking, setPicking] = useState(false);
  const addContact = useAddContact();
  // The record opened takes the focus once (ST-66).
  const focusHeading = useCallback((heading: HTMLHeadingElement | null) => heading?.focus(), []);

  const onOpen: OpenGesture = (id, search) => {
    // On a phone, the record is a page.
    if (search.panel === 'record' && isNarrow) {
      void navigate({ to: '/contacts/$contactId', params: { contactId: id } });
      return;
    }
    void navigate({
      to: '/circle',
      // Another Contact: what was open on the previous one closes.
      search: { ...(contactId === id ? current : {}), contact: id, ...search },
    });
  };
  const closePanel = () =>
    void navigate({ to: '/circle', search: ({ panel: _closed, ...search }) => search });

  if (summary === undefined) {
    return (
      <Screen title={m.circle()}>
        <ErrorMessage>{isError && m.circle_load_error()}</ErrorMessage>
      </Screen>
    );
  }
  const today = todayOf(summary);
  const tiers = tiersOf(summary, today);
  const count = TIERS.reduce((total, tier) => total + tiers[tier].length, 0);
  const goal = settingsOf(summary).circleSizeGoal;
  const contact = summary.contacts.find(({ id }) => id === contactId);
  const addToCircle = (
    <Button className="self-start max-md:min-h-11" onPress={() => setPicking(true)}>
      {m.verb_add_to_circle()}
    </Button>
  );
  return (
    <Screen title={m.circle()}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <CircleCount count={count} goal={goal} />
        {count > 0 && addToCircle}
      </div>
      {count === 0 ? (
        <div className="flex max-w-prose flex-col gap-3">
          <p>{m.circle_empty()}</p>
          {addToCircle}
          <p className="text-muted-foreground">{m.circle_empty_from_record()}</p>
        </div>
      ) : (
        <div
          className={cn(
            'grid items-start gap-4',
            panel === 'record' && contact && 'md:grid-cols-[minmax(0,1fr)_22rem]',
          )}
        >
          <div className="flex min-w-0 flex-col gap-6">
            {TIERS.map((tier) => {
              const headingId = `circle-tier-${tier}`;
              return (
                <section key={tier} aria-labelledby={headingId} className="flex flex-col gap-2">
                  <h2 id={headingId} className="font-semibold">
                    {TIER_LABEL[tier]()}{' '}
                    <span className="font-normal text-muted-foreground tabular-nums">
                      ({tiers[tier].length})
                    </span>
                  </h2>
                  {tiers[tier].length > 0 && (
                    <ul aria-labelledby={headingId} className="flex flex-col gap-2">
                      {tiers[tier].map((ally) => (
                        <AllyRow
                          key={ally.contact.id}
                          ally={ally}
                          summary={summary}
                          isOpen={panel === 'record' && ally.contact.id === contactId}
                          asPage={isNarrow}
                          onOpen={onOpen}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
          {panel === 'record' && contactId && !isNarrow && (
            <div className="sticky top-4">
              <ContactPanel
                key={contactId}
                contactId={contactId}
                headingRef={focusHeading}
                onClose={closePanel}
              />
            </div>
          )}
        </div>
      )}
      {/* Opened from a row, or from the choice of a Contact: the gesture alone. */}
      {panel !== 'record' && contact && (
        <RecordGesturePanels contact={contact} summary={summary} gestures={gestures} />
      )}
      {/* Add to Circle… from the page: a Contact chosen, the Allies aside, then the window of the
          change of Status; without a match, the quick add of an Ally. */}
      <PickContact
        summary={summary}
        title={m.verb_add_to_circle()}
        contacts={summary.contacts.filter(({ status }) => status !== 'ally')}
        isOpen={isPicking}
        onOpenChange={setPicking}
        onPick={({ id }) => onOpen(id, { statusTo: 'ally' })}
        quickAdd={{
          label: (name) => m.circle_quick_add_ally({ name }),
          onAdd: (name) => addContact({ name, status: 'ally' }),
        }}
      />
    </Screen>
  );
}
