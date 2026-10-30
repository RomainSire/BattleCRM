import { funnelOf } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { Button, ErrorMessage } from '@battlecrm/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';

import { CloseBattlePanel } from '../battles/close-battle-panel.tsx';

import { useAddContact } from '../contacts/add-contact-context.ts';
import { ContactName } from '../contacts/contact-name.tsx';
import {
  ContactPanel,
  RecordGesturePanels,
  useRecordGestures,
} from '../contacts/contact-record.tsx';
import { followUpTitle } from '../contacts/follow-up.tsx';
import {
  CardActions,
  followUpText,
  type Card,
  trialText,
  type FunnelGestureSearch,
  type OpenGesture,
} from '../funnel/next-action.tsx';
import { useLocale } from '../i18n.ts';
import { Screen } from '../screens/screen.tsx';
import { useApi } from '../session.ts';
import { settingsOf } from '../settings/use-settings.ts';
import { Kbd } from '../shell/kbd.tsx';
import {
  countedContacts,
  summaryQuery,
  todayOf,
  type Summary,
  type SummaryBattle,
  type SummaryContact,
} from '../summary.ts';
import { useIsNarrow } from '../use-narrow.ts';
import { ActivityCard } from './activity-card.tsx';
import { ConclusiveBattle, ConclusiveBattles, conclusiveBattlesOf } from './conclusive-battles.tsx';
import { DAILY_PICKS_KEY, dailyPicksQuery, todayPicksOf } from './daily-picks.ts';
import { EntriesBanner, EntriesCount } from './entries-banner.tsx';
import { toHandleOf, type TodayRow } from './to-handle.ts';
import { EntryCard, TodayDeck, type DeckItem } from './today-deck.tsx';
import { Row } from './today-row.tsx';

/** A section of the main column, its heading naming its list. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="font-semibold">
        {title}
      </h2>
      <ul aria-labelledby={headingId} className="flex flex-col gap-2">
        {children}
      </ul>
    </section>
  );
}

/** The Circle against its size goal, a link to its page (spec UX §5.1): “Circle 7/10”. */
function CircleLink({ summary }: { summary: Summary }) {
  const count = summary.contacts.filter(({ status }) => status === 'ally').length;
  const goal = settingsOf(summary).circleSizeGoal;
  return (
    <Link
      to="/circle"
      className="self-start rounded-control font-semibold tabular-nums underline-offset-4 focus-ring hover:underline"
    >
      {goal === null ? (
        m.today_circle_count({ allies: m.circle_count({ count }) })
      ) : (
        <>
          <span aria-hidden="true">{m.today_circle({ count, goal })} →</span>
          <span className="sr-only">{m.today_circle_label({ count, goal })}</span>
        </>
      )}
    </Link>
  );
}

/**
 * The side column (spec UX §5.1): the Activity of the day, the Circle, the conclusive Battles, and
 * what comes tomorrow.
 */
function SideColumn({
  summary,
  today,
  tomorrow,
  battles,
  onCloseBattle,
}: {
  summary: Summary;
  today: string;
  tomorrow: SummaryContact[];
  battles: SummaryBattle[];
  onCloseBattle: (battleId: string) => void;
}) {
  const headingId = useId();
  return (
    <div className="flex flex-col gap-4">
      <ActivityCard summary={summary} today={today} />
      <div className="flex flex-col rounded-card border p-3">
        <CircleLink summary={summary} />
      </div>
      <ConclusiveBattles summary={summary} battles={battles} onClose={onCloseBattle} />
      <section aria-labelledby={headingId} className="flex flex-col gap-2 rounded-card border p-3">
        <h2 id={headingId} className="font-semibold">
          {m.today_upcoming()}
        </h2>
        {tomorrow.length === 0 ? (
          <p className="text-xs text-muted-foreground">{m.today_upcoming_none()}</p>
        ) : (
          <ul aria-labelledby={headingId} className="flex flex-col gap-1">
            {tomorrow.map((contact) => (
              <li key={contact.id} className="flex flex-col">
                <span className="font-medium">
                  <ContactName contact={contact} />
                </span>
                <span className="text-xs text-muted-foreground">
                  {contact.followUp &&
                    m.today_upcoming_follow_up({ followUp: followUpTitle(contact.followUp) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * The first day (spec UX §5.1): no Contact yet, the Stages the Funnel starts with, and the add of a
 * Contact (`N`).
 */
function FirstDay({ summary }: { summary: Summary }) {
  const addContact = useAddContact();
  return (
    <div className="flex max-w-prose flex-col gap-3">
      <p>{m.today_first_day()}</p>
      <p className="text-muted-foreground">{m.today_first_day_stages()}</p>
      <ol className="list-inside list-decimal">
        {funnelOf(summary.stages).map((stage) => (
          <li key={stage.id}>{stage.name}</li>
        ))}
      </ol>
      <Button className="self-start" aria-keyshortcuts="N" onPress={() => addContact()}>
        {m.add_contact()}
        <Kbd>N</Kbd>
      </Button>
    </div>
  );
}

/**
 * Today (spec UX §5.1), on a phone one card at a time (`TodayDeck`). On a desktop: the Entries banner on top; the Follow-ups due and the Allies to
 * check in with in one list, the longest overdue first, then the Trials past their window and the
 * Contacts with No next step picked for the day, each with its actions; beside them, the Circle, the
 * conclusive Battles and what comes tomorrow. The record of a Contact opens in a panel in place of
 * the side column, and a gesture opened from a row in the same panel as anywhere else, kept by the
 * address (ST-70).
 */
export function TodayScreen() {
  const locale = useLocale();
  const api = useApi();
  const navigate = useNavigate();
  const isNarrow = useIsNarrow();
  const queryClient = useQueryClient();
  const { data: summary, isError } = useQuery(summaryQuery(api));
  const picksDay = summary && todayOf(summary);
  const picks = useQuery({
    ...dailyPicksQuery(api, picksDay ?? ''),
    enabled: picksDay !== undefined,
  });
  const current = useSearch({ from: '/app/today' });
  const { contact: contactId, panel, battle: closingId } = current;
  // A Contact that enters or leaves the Pool: the picks are read again, so one that entered the
  // Funnel is replaced (spec UX §5.1).
  const pool = summary?.contacts
    .filter(({ status }) => status === 'pool')
    .map(({ id }) => id)
    .join();
  const poolRead = useRef(pool);
  useEffect(() => {
    if (poolRead.current === pool) return;
    poolRead.current = pool;
    void queryClient.invalidateQueries({ queryKey: DAILY_PICKS_KEY });
  }, [pool, queryClient]);
  const gestures = useRecordGestures();
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
      to: '/today',
      // Another Contact: what was open on the previous one closes.
      search: { ...(contactId === id ? current : {}), contact: id, ...search },
    });
  };
  // Closed, the record gives the focus back to its row (ST-66).
  const closePanel = () => {
    void navigate({ to: '/today', search: ({ panel: _closed, ...search }) => search }).then(() => {
      if (contactId) {
        document.querySelector<HTMLElement>(`[data-today-row="${contactId}"]`)?.focus();
      }
    });
  };

  if (summary === undefined) {
    return (
      <Screen title={m.today()}>
        <ErrorMessage>{isError && m.today_load_error()}</ErrorMessage>
      </Screen>
    );
  }
  const today = todayOf(summary);
  const { rows, windowElapsed, tomorrow } = toHandleOf(summary, today);
  const { entries, noNextStep, postponedBattleIds } = todayPicksOf(summary, picks.data, today);
  const battles = conclusiveBattlesOf(summary, postponedBattleIds);
  const closing = battles.find(({ id }) => id === closingId);
  const closingStage = closing && summary.stages.find(({ id }) => id === closing.stageId);
  const closeBattleWindow = () => void navigate({ to: '/today', search: {} });
  const contact = summary.contacts.find(({ id }) => id === contactId);
  const isRecordOpen = panel === 'record' && contactId !== undefined && !isNarrow;
  const rowProps = (row: SummaryContact) => ({
    contact: row,
    summary,
    isOpen: panel === 'record' && row.id === contactId,
    asPage: isNarrow,
  });
  const todayRow = (row: TodayRow, as: 'li' | 'div' = 'li') => {
    if (row.kind === 'ally') {
      const { contact: ally, signal, daysLate } = row;
      return (
        <Row
          key={ally.id}
          as={as}
          {...rowProps(ally)}
          line={m.today_ally_rhythm_past({ late: daysLate, days: signal.daysSinceContact })}
          isLate
        >
          <Button
            variant="outline"
            size="sm"
            className="font-semibold max-md:min-h-11"
            onPress={() => onOpen(ally.id, { interaction: 'check-in' })}
          >
            {m.verb_check_in()}
          </Button>
        </Row>
      );
    }
    const { card } = row;
    return (
      <Row
        key={card.contact.id}
        as={as}
        {...rowProps(card.contact)}
        line={card.contact.followUp ? followUpText(card.contact.followUp, today, locale) : ''}
        isLate
      >
        <CardActions
          card={card}
          summary={summary}
          open={(search: FunnelGestureSearch) => onOpen(card.contact.id, search)}
        />
      </Row>
    );
  };
  const cardRow = (card: Card, line: string, as: 'li' | 'div' = 'li') => (
    <Row key={card.contact.id} as={as} {...rowProps(card.contact)} line={line} isLate={false}>
      <CardActions
        card={card}
        summary={summary}
        open={(search: FunnelGestureSearch) => onOpen(card.contact.id, search)}
      />
    </Row>
  );
  const noNextStepSection = noNextStep.length > 0 && (
    <Section title={m.today_no_next_step()}>
      {noNextStep.map((card) => cardRow(card, m.today_no_next_step()))}
    </Section>
  );
  const onCloseBattle = (battleId: string) =>
    void navigate({ to: '/today', search: { battle: battleId } });
  const main =
    summary.contacts.length === 0 ? (
      <FirstDay summary={summary} />
    ) : (
      <>
        {rows.length === 0 && windowElapsed.length === 0 && (
          <p className="text-muted-foreground">{m.today_nothing()}</p>
        )}
        {rows.length > 0 && (
          <Section title={m.today_follow_ups_and_allies()}>
            {rows.map((row) => todayRow(row))}
          </Section>
        )}
        {windowElapsed.length > 0 && (
          <Section title={m.today_window_elapsed()}>
            {windowElapsed.map((card) => cardRow(card, trialText(card, summary, locale) ?? ''))}
          </Section>
        )}
        {noNextStepSection}
      </>
    );
  // Opened from a row or a card, without the record: the gesture alone; and the closing of a Battle.
  const windows = (
    <>
      {panel !== 'record' && contact && (
        <RecordGesturePanels contact={contact} summary={summary} gestures={gestures} />
      )}
      {closing && closingStage && (
        <CloseBattlePanel
          key={closing.id}
          summary={summary}
          stage={closingStage}
          battle={closing}
          onClose={closeBattleWindow}
          onClosed={closeBattleWindow}
        />
      )}
    </>
  );
  if (isNarrow && summary.contacts.length > 0) {
    // The Entries card until a Contact entered the Funnel today (spec UX §5.1).
    const isPoolEmpty = !summary.contacts.some(({ status }) => status === 'pool');
    const enteredToday = countedContacts(summary).some(({ funnelEntryDays }) =>
      funnelEntryDays.includes(today),
    );
    const items: DeckItem[] = [
      ...(isPoolEmpty || enteredToday
        ? []
        : [
            {
              key: 'entry',
              title: <EntriesCount summary={summary} today={today} />,
              content: (
                <EntryCard
                  summary={summary}
                  today={today}
                  picked={entries}
                  isError={picks.isError}
                  onBringIn={(id) => onOpen(id, { statusTo: 'prospecting' })}
                />
              ),
            },
          ]),
      ...rows.map((row) => ({
        key: `${row.kind}:${row.kind === 'ally' ? row.contact.id : row.card.contact.id}`,
        title: row.kind === 'ally' ? m.today_card_ally() : m.today_card_follow_up(),
        content: todayRow(row, 'div'),
      })),
      ...windowElapsed.map((card) => ({
        key: `trial:${card.contact.id}`,
        title: m.today_card_window_elapsed(),
        content: cardRow(card, trialText(card, summary, locale) ?? '', 'div'),
      })),
      ...battles.map((battle) => ({
        key: `battle:${battle.id}`,
        title: m.today_card_conclusive_battle(),
        content: (
          <div className="rounded-card border p-3">
            <ConclusiveBattle summary={summary} battle={battle} onClose={onCloseBattle} />
          </div>
        ),
      })),
    ];
    return (
      <Screen title={m.today()}>
        {/* Without the Entries card, the Entries keep their count (spec UX §5.1). */}
        {(isPoolEmpty || enteredToday) && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              <EntriesCount summary={summary} today={today} />
            </p>
            {isPoolEmpty && (
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                aria-keyshortcuts="N"
                onPress={() => addContact()}
              >
                {m.add_contact()}
              </Button>
            )}
          </div>
        )}
        <TodayDeck
          today={today}
          items={items}
          done={noNextStepSection}
          after={
            <SideColumn
              summary={summary}
              today={today}
              tomorrow={tomorrow}
              battles={[]}
              onCloseBattle={onCloseBattle}
            />
          }
        />
        {windows}
      </Screen>
    );
  }
  return (
    <Screen title={m.today()}>
      {summary.contacts.length > 0 && (
        <div className="mb-6">
          <EntriesBanner
            summary={summary}
            today={today}
            picked={entries}
            isError={picks.isError}
            openContactId={panel === 'record' ? contactId : undefined}
            asPage={isNarrow}
            onBringIn={(id) => onOpen(id, { statusTo: 'prospecting' })}
          />
        </div>
      )}
      <div
        className={cn(
          'grid items-start gap-6',
          isRecordOpen
            ? 'md:grid-cols-[minmax(0,1fr)_22rem]'
            : 'md:grid-cols-[minmax(0,1fr)_18rem]',
        )}
      >
        <div className="flex min-w-0 flex-col gap-6">{main}</div>
        {isRecordOpen ? (
          <div className="sticky top-4">
            <ContactPanel
              key={contactId}
              contactId={contactId}
              headingRef={focusHeading}
              onClose={closePanel}
            />
          </div>
        ) : (
          <SideColumn
            summary={summary}
            today={today}
            tomorrow={tomorrow}
            battles={battles}
            onCloseBattle={onCloseBattle}
          />
        )}
      </div>
      {windows}
    </Screen>
  );
}
