import type { Insights } from '@battlecrm/contract';
import { addDays, mondayOf } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { Button } from '@battlecrm/ui';
import { useId, useState } from 'react';

import { formatLocalDay } from '../contacts/format.ts';
import type { Locale } from '../i18n.ts';
import { Caption, DayGrid, formatChartDay, WeekBars } from './charts.tsx';

type ActivityDay = Insights['activity'][number];

/** “2 Actions · goal of the day: 3”, the goal in effect that day; the count alone without one. */
const dayLabel = ({ day, count, goal }: ActivityDay, locale: Locale) =>
  [
    formatChartDay(day, locale),
    m.insights_day_actions({ count }),
    ...(goal === null ? [] : [m.insights_day_goal({ goal })]),
  ].join(' · ');

/** The days of the 12 months by week, from the Monday of the first: the days outside left out. */
function weeksOf(days: readonly ActivityDay[]) {
  const first = days[0]?.day;
  const last = days.at(-1)?.day;
  if (first === undefined || last === undefined) return [];
  const byDay = new Map(days.map((row) => [row.day, row]));
  const weeks = [];
  for (let monday = mondayOf(first); monday <= last; monday = addDays(monday, 7)) {
    const week = Array.from({ length: 7 }, (_, index) => byDay.get(addDays(monday, index)));
    weeks.push({
      monday,
      days: week,
      total: week.reduce((sum, day) => sum + (day?.count ?? 0), 0),
    });
  }
  return weeks;
}

/** The Activity as a real table: a row per week, a column per day, then its total. */
function ActivityTable({ weeks, locale }: { weeks: ReturnType<typeof weeksOf>; locale: Locale }) {
  const monday = weeks[0]?.monday;
  if (monday === undefined) return null;
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${addDays(monday, index)}T12:00:00Z`);
    const format = (weekday: 'narrow' | 'long') =>
      new Intl.DateTimeFormat(locale, { weekday, timeZone: 'UTC' }).format(date);
    return { narrow: format('narrow'), long: format('long') };
  });
  return (
    <div className="max-h-96 overflow-auto">
      <table aria-label={m.insights_activity_days()} className="w-full text-right text-sm">
        <thead className="sticky top-0 bg-background text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="py-1.5 pr-2 text-left font-medium">
              {m.insights_week()}
            </th>
            {weekdays.map(({ narrow, long }) => (
              <th key={long} scope="col" className="px-1 py-1.5 font-medium">
                <abbr title={long} className="no-underline">
                  {narrow}
                </abbr>
              </th>
            ))}
            <th scope="col" className="py-1.5 pl-2 font-medium">
              {m.insights_total()}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y border-t tabular-nums">
          {weeks.map((week) => (
            <tr key={week.monday}>
              <th scope="row" className="py-1 pr-2 text-left font-normal whitespace-nowrap">
                {formatLocalDay(week.monday, locale)}
              </th>
              {week.days.map((day, index) => (
                // A day outside the 12 months is no day of the table.
                // oxlint-disable-next-line react/no-array-index-key
                <td key={index} className="px-1 py-1">
                  {day?.count ?? ''}
                </td>
              ))}
              <td className="py-1 pl-2 font-medium">{week.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The Activity of the last 12 months (spec UX §5.7): a day graph by intensity alone, the goal of each
 * day only on hover or focus, the weekly totals in bars without any goal, the current week faded;
 * a sentence of synthesis, and the same as a table.
 */
export function ActivitySection({
  activity,
  locale,
}: {
  activity: Insights['activity'];
  locale: Locale;
}) {
  const headingId = useId();
  const [asTable, setAsTable] = useState(false);
  const [dayShown, setDayShown] = useState<string | null>(null);
  const [weekShown, setWeekShown] = useState<string | null>(null);
  const total = activity.reduce((sum, { count }) => sum + count, 0);
  const weeks = weeksOf(activity);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-card border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="font-semibold">
          {m.insights_activity()}
        </h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {m.insights_activity_total({ count: total })}
        </p>
        <Button variant="outline" size="sm" onPress={() => setAsTable((shown) => !shown)}>
          {asTable ? m.insights_show_chart() : m.insights_show_table()}
        </Button>
      </div>
      {asTable ? (
        <ActivityTable weeks={weeks} locale={locale} />
      ) : (
        <>
          <DayGrid
            days={activity}
            labelOf={(index) => {
              const day = activity[index];
              return day ? dayLabel(day, locale) : '';
            }}
            label={m.insights_activity_days()}
            locale={locale}
            onShow={setDayShown}
          />
          <Caption testId="activity-caption">{dayShown ?? m.insights_hint()}</Caption>
          <h3 className="text-sm font-medium">{m.insights_by_week()}</h3>
          <WeekBars
            weeks={weeks.map(({ monday, total: count }, index) => ({
              monday,
              count,
              label:
                `${m.insights_week_of({ monday: formatLocalDay(monday, locale) })} · ${m.insights_day_actions({ count })}` +
                (index === weeks.length - 1 ? ` (${m.insights_week_current()})` : ''),
            }))}
            label={m.insights_by_week()}
            locale={locale}
            onShow={setWeekShown}
          />
          <Caption testId="weeks-caption">{weekShown ?? ''}</Caption>
        </>
      )}
    </section>
  );
}
