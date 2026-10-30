import type { Insights } from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';
import { Checkbox } from '@battlecrm/ui';
import { cn } from 'cn';
import { useId, useState } from 'react';

import { formatLocalDay } from '../contacts/format.ts';
import type { Locale } from '../i18n.ts';
import type { Summary } from '../summary.ts';
import { Caption, WeekBars } from './charts.tsx';

type Stage = Summary['stages'][number];

const headClass = 'py-1.5 pr-3 font-medium';
const stageName = (stage: Stage) =>
  stage.archived ? m.insights_archived_stage({ stage: stage.name }) : stage.name;

/**
 * The Contacts arrived at each Stage, in the order of the Funnel now, and their Pass-through rate in
 * second place; the bars are decoration. An archived Stage, on demand and in grey, has no rate.
 */
function PassagesTable({
  rows,
  labelledBy,
  locale,
}: {
  rows: { stage: Stage; arrived: number; passed: number | null }[];
  labelledBy: string;
  locale: Locale;
}) {
  const busiest = Math.max(1, ...rows.map(({ arrived }) => arrived));
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  return (
    <div className="overflow-x-auto">
      <table aria-labelledby={labelledBy} className="w-full text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th scope="col" className={headClass}>
              {m.insights_stage()}
            </th>
            <th scope="col" className={cn(headClass, 'w-1/2')}>
              {m.insights_arrived()}
            </th>
            <th scope="col" className={cn(headClass, 'pr-0 text-right')}>
              {m.insights_pass_through()}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y border-t tabular-nums">
          {rows.map(({ stage, arrived, passed }) => (
            <tr key={stage.id} className={cn(stage.archived && 'text-muted-foreground')}>
              <th scope="row" className="py-1.5 pr-3 font-normal">
                {stageName(stage)}
              </th>
              <td className="py-1.5 pr-3 whitespace-nowrap">
                <span className="inline-block w-8">{arrived}</span>
                {/* Decoration: the number says it. */}
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-[calc(100%-2.5rem)] rounded-full bg-surface align-middle"
                >
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      stage.archived ? 'bg-neutral-dot' : 'bg-accent-text/50',
                    )}
                    style={{ width: `${(100 * arrived) / busiest}%` }}
                  />
                </span>
              </td>
              <td className="py-1.5 text-right text-muted-foreground">
                {passed === null || arrived === 0 ? (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">{m.insights_no_rate()}</span>
                  </>
                ) : (
                  percent.format(passed / arrived)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Where the Contacts left Prospecting from, and for which Status. */
function ExitsTable({
  exits,
  stageOf,
}: {
  exits: Insights['funnel']['exits'];
  stageOf: (id: string) => Stage | undefined;
}) {
  const headingId = useId();
  return (
    <div className="flex flex-col gap-2">
      <h3 id={headingId} className="text-sm font-medium">
        {m.insights_exits()}
      </h3>
      {exits.length === 0 ? (
        <p className="text-sm text-muted-foreground">{m.insights_no_exit()}</p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-labelledby={headingId} className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className={headClass}>
                  {m.insights_stage()}
                </th>
                {[m.insights_exit_ally, m.insights_exit_pool, m.insights_exit_archived].map(
                  (label) => (
                    <th key={label()} scope="col" className={cn(headClass, 'text-right')}>
                      {label()}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y border-t text-right tabular-nums">
              {exits.map(({ stageId, ally, pool, archived }) => {
                const stage = stageOf(stageId);
                return (
                  <tr key={stageId}>
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                      {stage ? stageName(stage) : '…'}
                    </th>
                    <td className="py-1.5 pr-3">{ally}</td>
                    <td className="py-1.5 pr-3">{pool}</td>
                    <td className="py-1.5 pr-3">{archived}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * The Funnel entries of each week of the period and their average over the weeks over, like the
 * Activity: neither a line of the goal nor the success colour, the goal of each week on hover or focus.
 */
function EntryWeeks({
  weeks,
  locale,
}: {
  weeks: Insights['funnel']['entryWeeks'];
  locale: Locale;
}) {
  const headingId = useId();
  const [shown, setShown] = useState<string | null>(null);
  // The weeks over: the current one is not.
  const over = weeks.slice(0, -1);
  const average =
    over.length === 0 ? null : over.reduce((sum, { count }) => sum + count, 0) / over.length;
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-sm font-medium">
          {m.insights_entries()}
        </h3>
        {average !== null && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {m.insights_entries_average({ average: decimal.format(average) })}
          </p>
        )}
      </div>
      <WeekBars
        weeks={weeks.map(({ monday, count, goal }, index) => ({
          monday,
          count,
          label:
            [
              m.insights_week_of({ monday: formatLocalDay(monday, locale) }),
              m.insights_week_entries({ count }),
              ...(goal === null ? [] : [m.insights_week_entry_goal({ goal })]),
            ].join(' · ') + (index === weeks.length - 1 ? ` (${m.insights_week_current()})` : ''),
        }))}
        label={m.insights_entries()}
        locale={locale}
        onShow={setShown}
      />
      <Caption testId="entries-caption">{shown ?? ''}</Caption>
    </section>
  );
}

/**
 * The Funnel over the period (spec UX §5.7): the passages by Stage as a real table, archived Stages
 * on demand, the exits by Status and by Stage, the entries by week.
 */
export function FunnelSection({
  funnel,
  summary,
  locale,
}: {
  funnel: Insights['funnel'];
  summary: Summary;
  locale: Locale;
}) {
  const headingId = useId();
  const [showArchived, setShowArchived] = useState(false);
  const stageOf = (id: string) => summary.stages.find((stage) => stage.id === id);
  // In the order of the Funnel now, as the summary has it.
  const rows = summary.stages.flatMap((stage) => {
    const counted = funnel.stages.find(({ stageId }) => stageId === stage.id);
    if (!counted || (stage.archived && !showArchived)) return [];
    return [{ stage, arrived: counted.arrived, passed: stage.archived ? null : counted.passed }];
  });
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-card border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="font-semibold">
          {m.insights_funnel()}
        </h2>
        <Checkbox className="max-md:min-h-11" isSelected={showArchived} onChange={setShowArchived}>
          {m.insights_show_archived()}
        </Checkbox>
      </div>
      <PassagesTable rows={rows} labelledBy={headingId} locale={locale} />
      <ExitsTable
        exits={funnel.exits.filter(({ stageId }) => showArchived || !stageOf(stageId)?.archived)}
        stageOf={stageOf}
      />
      <EntryWeeks weeks={funnel.entryWeeks} locale={locale} />
    </section>
  );
}
