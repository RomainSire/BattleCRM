import { m } from '@battlecrm/i18n';
import { Button, ErrorMessage } from '@battlecrm/ui';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { STATUS_VERB } from '../contacts/status.ts';
import { useApi } from '../session.ts';
import { organizationOf, type Summary, type SummaryContact } from '../summary.ts';
import { TodayContactLink } from './contact-link.tsx';
import { dailyPicksQuery } from './daily-picks.ts';

/** A card of Today on a phone (spec UX §5.1): what it is, named by its title, and its content. */
export type DeckItem = { key: string; title: ReactNode; content: ReactNode };

/** Where this tab keeps the cards it showed on a day, to tell how many were handled since. */
const seenKey = (day: string) => `battlecrm.today-deck.${day}`;
/** The same, when the browser refuses its storage: kept as long as the page. */
const memory = new Map<string, string[]>();

function readSeen(day: string): string[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(seenKey(day)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((key) => typeof key === 'string') : [];
  } catch {
    return memory.get(day) ?? [];
  }
}

function writeSeen(day: string, keys: string[]) {
  memory.set(day, keys);
  try {
    sessionStorage.setItem(seenKey(day), JSON.stringify(keys));
  } catch {
    // Storage refused: the progress only won't survive the tab.
  }
}

/**
 * How many cards were handled today: shown on this tab, then gone from the deck, whatever took them
 * away (a gesture, “Postpone”, “Later”, another device). Kept in `sessionStorage` (ST-70), so a tab the
 * browser dropped comes back with its progress; a new day starts from nothing.
 */
function useHandledToday(day: string, keys: readonly string[]): number {
  const seen = readSeen(day);
  const fresh = keys.filter((key) => !seen.includes(key)).join();
  useEffect(() => {
    if (fresh === '') return;
    const kept = readSeen(day);
    writeSeen(day, [...kept, ...fresh.split(',').filter((key) => !kept.includes(key))]);
  }, [day, fresh]);
  return seen.filter((key) => !keys.includes(key)).length;
}

/**
 * The progress of the day (spec UX §5.1): the cards handled against all the cards of the day, in a
 * bar and in words.
 */
function Progress({ done, total }: { done: number; total: number }) {
  const value = m.today_deck_progress_value({ done, total });
  return (
    <div className="flex items-center gap-3">
      <progress
        aria-label={m.today_deck_progress()}
        aria-valuetext={value}
        max={total}
        value={done}
        className="h-1.5 flex-1 appearance-none overflow-hidden rounded-full bg-surface ring-1 ring-border [&::-moz-progress-bar]:bg-accent-text [&::-webkit-progress-bar]:bg-surface [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-accent-text"
      />
      <span aria-hidden="true" className="text-xs text-muted-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

/**
 * The Entries card, first on a phone (spec UX §5.1): the entries of the week, one Contact of the
 * Pool picked for the day at a time, with “Bring in…” and “Another one”, which passes it for the day
 * on every device and proposes the next one.
 */
export function EntryCard({
  summary,
  today,
  picked,
  isError,
  onBringIn,
}: {
  summary: Summary;
  today: string;
  /** The Contacts of the Pool picked for the day, still in the Pool; `undefined` while read. */
  picked: SummaryContact[] | undefined;
  isError: boolean;
  onBringIn: (contactId: string) => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  if (isError) return <ErrorMessage>{m.today_picks_load_error()}</ErrorMessage>;
  const contact = picked?.[0];
  if (contact === undefined) return null;
  const organization = organizationOf(contact, summary);
  const stage = summary.stages.find(({ id }) => id === contact.stageId);
  // “Another one” only when the Pool has another.
  const hasAnother = summary.contacts.filter(({ status }) => status === 'pool').length > 1;

  const another = async () => {
    setSending(true);
    setFailed(false);
    try {
      const response = await api.today.picks.entries[':id'].pass.$post({
        param: { id: contact.id },
      });
      if (!response.ok) throw new Error('POST /api/today/picks/entries/:id/pass failed');
      queryClient.setQueryData(dailyPicksQuery(api, today).queryKey, await response.json());
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="group relative flex flex-col gap-2 rounded-card border bg-background p-3">
      <TodayContactLink contact={contact} isOpen={false} asPage />
      <span className="text-xs text-muted-foreground">
        {organization?.name ?? m.no_organization()} ·{' '}
        {stage
          ? m.today_entries_last_stage({ stage: stage.name })
          : m.today_entries_never_entered()}
      </span>
      <div className="relative flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 font-semibold"
          onPress={() => onBringIn(contact.id)}
        >
          {STATUS_VERB.prospecting()}
        </Button>
        {hasAnother && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            isDisabled={sending}
            onPress={() => void another()}
          >
            {m.today_another()}
          </Button>
        )}
      </div>
      <ErrorMessage>{failed && m.today_another_error()}</ErrorMessage>
    </div>
  );
}

/**
 * Today on a phone (spec UX §5.1): one card at a time, in the order of priority, with the progress
 * of the day; the previous and next cards a button away. Once none is left, “Day wrapped up”, where
 * the celebration of the Activity goal lands (`after` holds the Activity card).
 */
export function TodayDeck({
  today,
  items,
  done: whenDone,
  after,
}: {
  today: string;
  items: DeckItem[];
  /** What the day still offers once wrapped up: the Contacts with No next step. */
  done: ReactNode;
  /** Below the cards: the Activity of the day, the Circle, tomorrow. */
  after: ReactNode;
}) {
  const keys = items.map(({ key }) => key);
  const handled = useHandledToday(today, keys);
  // The card shown, by its key; once handled, the one that takes its place.
  const [at, setAt] = useState<{ key: string | undefined; index: number }>({
    key: undefined,
    index: 0,
  });
  const found = at.key === undefined ? -1 : keys.indexOf(at.key);
  const index = found === -1 ? Math.min(at.index, items.length - 1) : found;
  const item = items[index];
  const titleId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const wrappedRef = useRef<HTMLHeadingElement>(null);
  // The card handled is gone, its controls with it: the focus moves to what replaces it (ST-66).
  const gone = at.key !== undefined && found === -1;
  useEffect(() => {
    if (!gone) return;
    const active = document.activeElement;
    if (active !== null && active !== document.body && document.contains(active)) return;
    (cardRef.current ?? wrappedRef.current)?.focus();
  }, [gone]);

  const move = (to: number) => setAt({ key: keys[to], index: to });

  return (
    <div className="flex flex-col gap-4">
      {items.length + handled > 0 && <Progress done={handled} total={items.length + handled} />}
      {item === undefined ? (
        <div className="flex flex-col gap-1 rounded-card border p-4 text-center">
          {handled > 0 ? (
            <>
              <h2 ref={wrappedRef} tabIndex={-1} className="text-lg font-semibold outline-none">
                {m.today_day_done()}
              </h2>
              <p className="text-muted-foreground">{m.today_day_done_count({ count: handled })}</p>
            </>
          ) : (
            <p className="text-muted-foreground">{m.today_nothing()}</p>
          )}
        </div>
      ) : (
        <>
          <section
            key={item.key}
            ref={cardRef}
            tabIndex={-1}
            aria-labelledby={titleId}
            className="flex flex-col gap-2 rounded-card outline-none"
          >
            <h2 id={titleId} className="text-sm font-semibold text-muted-foreground">
              {item.title}
            </h2>
            {item.content}
          </section>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              aria-label={m.today_deck_previous()}
              isDisabled={index === 0}
              onPress={() => move(index - 1)}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <span aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
              {m.today_deck_position({ index: index + 1, count: items.length })}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              aria-label={m.today_deck_next()}
              isDisabled={index === items.length - 1}
              onPress={() => move(index + 1)}
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
        </>
      )}
      {item === undefined && whenDone}
      {after}
    </div>
  );
}
