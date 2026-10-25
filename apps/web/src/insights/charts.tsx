import { addDays, daysBetween, mondayOf } from '@battlecrm/domain';
import { cn } from 'cn';
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import type { Locale } from '../i18n.ts';
import { LEVEL_CLASSES, levelOf } from '../today/activity-card.tsx';

/**
 * One item of a chart reachable at a time (a roving focus): a single Tab reaches the chart, the
 * arrows move from item to item. The last item, today or this week, first. Each item is a button
 * that shows its detail, focused, hovered or pressed.
 */
function useRoving(count: number) {
  const [chosen, setChosen] = useState<number | null>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const active = Math.min(chosen ?? count - 1, count - 1);
  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(index, count - 1));
    setChosen(next);
    items.current[next]?.focus();
  };
  return { active, moveTo, items };
}

/** A local day as a chart says it: “lun. 5 janv. 2026”. */
export const formatChartDay = (day: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));

/** What a chart shows of the item under the pointer or the focus, or its hint. */
export function Caption({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <p aria-hidden="true" data-testid={testId} className="min-h-5 text-xs text-muted-foreground">
      {children}
    </p>
  );
}

const DAY_SIZE = 12;
const DAY_GAP = 3;

/**
 * The days as GitHub draws them: a column per week, Monday at the top, the current week on the right;
 * one square per day as dark as its count, an empty day neutral, no mark of any goal (spec UX §5.7).
 * Each day says its label, on hover and focus too; up and down move a day, left and right a week.
 */
export function DayGrid({
  days,
  labelOf,
  label,
  locale,
  onShow,
}: {
  /** Every day shown, one after another, today last. */
  days: readonly { day: string; count: number }[];
  labelOf: (index: number) => string;
  label: string;
  locale: Locale;
  onShow: (label: string) => void;
}) {
  const { active, moveTo, items } = useRoving(days.length);
  const scroller = useRef<HTMLDivElement>(null);
  // Today in sight, on the right, however narrow the screen.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, []);
  const first = days[0]?.day;
  const last = days.at(-1)?.day;
  if (first === undefined || last === undefined) return null;
  const firstMonday = mondayOf(first);
  // The days of the first week before the first one shown: empty places.
  const before = Array.from({ length: daysBetween(firstMonday, first) }, (_, index) =>
    addDays(firstMonday, index),
  );
  const weeks = Math.ceil((before.length + days.length) / 7);
  const busiest = Math.max(1, ...days.map(({ count }) => count));
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  const mondays = Array.from({ length: weeks }, (_, index) => addDays(firstMonday, 7 * index));
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[event.key];
    if (step !== undefined) moveTo(index + step);
    else if (event.key === 'Home') moveTo(0);
    else if (event.key === 'End') moveTo(days.length - 1);
    else return;
    event.preventDefault();
  };
  const columns = { gridTemplateColumns: `repeat(${weeks}, ${DAY_SIZE}px)`, columnGap: DAY_GAP };
  return (
    // Its width never comes from the weeks it holds: else the page would scroll sideways.
    <div ref={scroller} className="overflow-x-auto pb-1 [contain:inline-size]">
      <div aria-hidden="true" className="grid text-[10px] text-muted-foreground" style={columns}>
        {mondays.map((monday, index) => {
          const previous = mondays[index - 1];
          const starts = previous === undefined || monday.slice(5, 7) !== previous.slice(5, 7);
          return (
            <span key={monday} className="overflow-visible whitespace-nowrap">
              {starts && index < weeks - 2 ? month.format(new Date(`${monday}T12:00:00Z`)) : ''}
            </span>
          );
        })}
      </div>
      <ol
        aria-label={label}
        className="grid grid-flow-col p-0.5"
        style={{ ...columns, gridTemplateRows: `repeat(7, ${DAY_SIZE}px)`, rowGap: DAY_GAP }}
      >
        {before.map((day) => (
          <li key={day} aria-hidden="true" />
        ))}
        {days.map(({ day, count }, index) => (
          <li key={day} className="relative flex">
            <button
              type="button"
              ref={(element) => {
                items.current[index] = element;
              }}
              tabIndex={index === active ? 0 : -1}
              onKeyDown={(event) => onKeyDown(event, index)}
              onFocus={() => onShow(labelOf(index))}
              onMouseEnter={() => onShow(labelOf(index))}
              onClick={() => onShow(labelOf(index))}
              className={cn(
                'flex-1 cursor-default rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foreground',
                LEVEL_CLASSES[levelOf(count, busiest)],
              )}
            >
              <span className="sr-only">{labelOf(index)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * A bar per week, as tall as its count against the busiest one, the current week faded and said so
 * in its label: no line of any goal (spec UX §5.7). Each week says its label, on hover and focus too;
 * left and right move a week.
 */
export function WeekBars({
  weeks,
  label,
  locale,
  onShow,
}: {
  /** Every week shown, from its Monday, the current one last. */
  weeks: readonly { monday: string; count: number; label: string }[];
  label: string;
  locale: Locale;
  onShow: (label: string) => void;
}) {
  const { active, moveTo, items } = useRoving(weeks.length);
  const busiest = Math.max(1, ...weeks.map(({ count }) => count));
  const short = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (step !== undefined) moveTo(index + step);
    else if (event.key === 'Home') moveTo(0);
    else if (event.key === 'End') moveTo(weeks.length - 1);
    else return;
    event.preventDefault();
  };
  return (
    <div className="flex flex-col gap-1">
      <ol aria-label={label} className="flex h-24 items-end gap-0.5 border-b border-border">
        {weeks.map(({ monday, count, label: weekLabel }, index) => (
          <li key={monday} className="relative flex h-full min-w-0 flex-1">
            <button
              type="button"
              ref={(element) => {
                items.current[index] = element;
              }}
              tabIndex={index === active ? 0 : -1}
              onKeyDown={(event) => onKeyDown(event, index)}
              onFocus={() => onShow(weekLabel)}
              onMouseEnter={() => onShow(weekLabel)}
              onClick={() => onShow(weekLabel)}
              className="flex flex-1 cursor-default items-end rounded-t-[3px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foreground"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'w-full rounded-t-[3px] bg-accent-text',
                  index === weeks.length - 1 && 'opacity-50',
                )}
                // An empty week keeps a hairline: there, but nothing in it.
                style={{ height: count === 0 ? 1 : `${(100 * count) / busiest}%` }}
              />
              <span className="sr-only">{weekLabel}</span>
            </button>
          </li>
        ))}
      </ol>
      <div aria-hidden="true" className="flex gap-0.5 text-[10px] text-muted-foreground">
        {weeks.map(({ monday }, index) => (
          <span key={monday} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
            {/* A Monday every fourth week. */}
            {index % 4 === 0 ? short.format(new Date(`${monday}T12:00:00Z`)) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
