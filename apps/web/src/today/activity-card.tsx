import { activityGoalReached, activityOn, addDays, mondayOf } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { CheckIcon } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';

import { formatWeekDay } from '../contacts/format.ts';
import { useLocale, type Locale } from '../i18n.ts';
import { settingsOf } from '../settings/use-settings.ts';
import type { Summary } from '../summary.ts';
import { useHalo } from './celebration.tsx';

/** The weeks the graph shows at least, the current one last (spec UX §5.1): more when the width holds them. */
const MIN_WEEKS = 4;
/** The size a day aims for, and the space between two, in pixels: the weeks fill the width around it. */
const DAY_SIZE = 16;
const DAY_GAP = 4;

/**
 * As many weeks as the width of an element holds, with days of about `DAY_SIZE`, and the size that
 * makes them fill it: measured, then again each time the width changes (a phone, the record opened).
 */
function useWeeksThatFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ weeks: MIN_WEEKS, size: DAY_SIZE });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => {
      const width = element.clientWidth;
      const weeks = Math.max(MIN_WEEKS, Math.floor((width + DAY_GAP) / (DAY_SIZE + DAY_GAP)));
      const size = Math.max(DAY_SIZE / 2, (width + DAY_GAP) / weeks - DAY_GAP);
      setFit((previous) =>
        previous.weeks === weeks && previous.size === size ? previous : { weeks, size },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, ...fit };
}

/** A ring filled as far as the Activity of the day went towards its goal: decoration, the phrase says it. */
function Ring({ activity, goal }: { activity: number; goal: number }) {
  const radius = 15;
  const length = 2 * Math.PI * radius;
  const filled = Math.min(activity / goal, 1) * length;
  return (
    <svg viewBox="0 0 36 36" className="size-12 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" r={radius} fill="none" strokeWidth="4" className="stroke-border" />
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${length}`}
        className="stroke-accent-text"
      />
    </svg>
  );
}

/** How dark a day shows, from 0 (none) to 4 (the busiest of the weeks shown): intensity alone, no goal. */
function levelOf(count: number, busiest: number): number {
  return count === 0 ? 0 : Math.ceil((4 * count) / busiest);
}

const LEVEL_CLASSES = [
  'bg-surface ring-1 ring-border ring-inset',
  'bg-accent-text/25',
  'bg-accent-text/50',
  'bg-accent-text/75',
  'bg-accent-text',
];

/**
 * The last weeks as GitHub draws them, as many as the width holds and at least 4: a column per week,
 * the current one on the right, Monday at the top and Sunday at the bottom; one square per day as dark
 * as its Activity, no mark of the goal (spec UX §5.1, §5.7). Each day says its count, so the intensity
 * is never alone (spec UX §7). The days stay in their order in the list, the grid fills it column by
 * column.
 */
function Weeks({ summary, today, locale }: { summary: Summary; today: string; locale: Locale }) {
  const { ref, weeks, size } = useWeeksThatFit();
  const first = addDays(mondayOf(today), -7 * (weeks - 1));
  const days = Array.from({ length: 7 * weeks }, (_, index) => addDays(first, index));
  const counts = new Map(days.map((day) => [day, activityOn(summary.contacts, day)]));
  const busiest = Math.max(1, ...counts.values());
  const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
  const weekdays = days.slice(0, 7).map((day) => narrow.format(new Date(`${day}T00:00:00Z`)));
  const rows = { gridTemplateRows: `repeat(7, ${size}px)`, gap: DAY_GAP };
  return (
    <div className="flex gap-1.5">
      <div aria-hidden="true" className="grid" style={rows}>
        {weekdays.map((weekday, index) => (
          <span
            // The same letter comes back: Tuesday and Wednesday, Saturday and Sunday.
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
            className="flex items-center text-[10px] leading-none text-muted-foreground"
          >
            {weekday}
          </span>
        ))}
      </div>
      {/* Its width never comes from the weeks it holds: else they would hold it wide once the
          window narrows, and the page would scroll sideways. */}
      <div ref={ref} className="min-w-0 flex-1 [contain:inline-size]">
        <ol
          className="grid grid-flow-col"
          style={{ ...rows, gridTemplateColumns: `repeat(${weeks}, ${size}px)` }}
          aria-label={m.today_activity_weeks({ count: weeks })}
        >
          {days.map((day) => {
            // A day to come has nothing yet: an empty place in its week.
            if (day > today) return <li key={day} aria-hidden="true" />;
            const count = counts.get(day) ?? 0;
            const label = m.today_activity_day({ day: formatWeekDay(day, locale), count });
            return (
              <li
                key={day}
                title={label}
                className={cn('rounded-[3px]', LEVEL_CLASSES[levelOf(count, busiest)])}
              >
                <span className="sr-only">{label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/**
 * The Activity of the day against the Activity goal in effect today (spec UX §5.1): a ring and its
 * phrase, “reached” once reached, the count alone without a goal; the last 4 weeks; a link to Insights.
 * A brief halo as the goal is celebrated (spec UX §2).
 */
export function ActivityCard({ summary, today }: { summary: Summary; today: string }) {
  const celebrating = useHalo();
  const locale = useLocale();
  const headingId = useId();
  const activity = activityOn(summary.contacts, today);
  const goal = settingsOf(summary).activityGoal.inEffect;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col gap-3 rounded-card border p-3 transition-shadow duration-500 motion-reduce:transition-none',
        celebrating && 'shadow-[0_0_0_4px_color-mix(in_srgb,var(--success)_35%,transparent)]',
      )}
    >
      <h2 id={headingId} className="font-semibold">
        {m.today_activity()}
      </h2>
      {goal === null ? (
        <p className="tabular-nums">{m.today_activity_no_goal({ count: activity })}</p>
      ) : (
        <div className="flex items-center gap-3">
          <Ring activity={activity} goal={goal} />
          <div className="flex flex-col">
            <span aria-hidden="true" className="text-lg font-semibold tabular-nums">
              {m.today_activity_count({ count: activity, goal })}
            </span>
            <span className="sr-only">{m.today_activity_label({ count: activity, goal })}</span>
            {activityGoalReached(activity, goal) && (
              <span className="flex items-center gap-1 text-xs font-medium text-success">
                <CheckIcon aria-hidden="true" className="size-3.5" />
                {m.today_activity_reached()}
              </span>
            )}
          </div>
        </div>
      )}
      <Weeks summary={summary} today={today} locale={locale} />
      <Link
        to="/insights"
        className="self-start rounded-control text-xs underline-offset-4 focus-ring hover:underline"
      >
        {m.insights()}
        <span aria-hidden="true"> →</span>
      </Link>
    </section>
  );
}
