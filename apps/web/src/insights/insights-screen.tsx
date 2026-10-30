import { INSIGHTS_PERIODS, type Insights, type InsightsPeriod } from '@battlecrm/contract';
import { daysBetween, funnelEntriesInWeek } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import {
  ErrorMessage,
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '@battlecrm/ui';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { cn } from 'cn';
import { useId, type ReactNode } from 'react';

import { useLocale, type Locale } from '../i18n.ts';
import { Screen } from '../screens/screen.tsx';
import { useApi, type ApiClient } from '../session.ts';
import { settingsOf } from '../settings/use-settings.ts';
import { countedContacts, INSIGHTS_KEY, summaryQuery, todayOf, type Summary } from '../summary.ts';
import { ActivitySection } from './activity-section.tsx';
import { FunnelSection } from './funnel-section.tsx';

const PERIOD_LABEL: Record<InsightsPeriod, () => string> = {
  '30d': m.insights_period_30d,
  '3m': m.insights_period_3m,
  '12m': m.insights_period_12m,
  all: m.insights_period_all,
};

/** Insights over a period, read on demand (spec stack §3), never kept on the device. */
const insightsQuery = (api: ApiClient, period: InsightsPeriod) =>
  queryOptions({
    queryKey: [...INSIGHTS_KEY, period],
    queryFn: async (): Promise<Insights> => {
      const response = await api.insights.$get({ query: { period } });
      if (!response.ok) throw new Error('GET /api/insights failed');
      return response.json();
    },
    retry: false,
  });

/** A figure at the top: what it counts, its value, and what puts it in context. */
function Figure({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-card border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
      {detail !== undefined && (
        <dd className="text-xs text-muted-foreground tabular-nums">{detail}</dd>
      )}
    </div>
  );
}

/**
 * The figures of the effort at the top (spec UX §5.7): the Prospecting actions of the week and of the period, the
 * Trials finished, the Funnel entries of the week against the Entry goal and the size of the Circle;
 * no rate. The entries and the Circle come from the summary: they follow each gesture at once.
 */
function TopFigures({
  insights,
  summary,
  locale,
}: {
  insights: Insights;
  summary: Summary;
  locale: Locale;
}) {
  const headingId = useId();
  const { prospecting, period } = insights;
  const settings = settingsOf(summary);
  const decimal = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const perDay = prospecting.actionsInPeriod / (daysBetween(period.from, period.to) + 1);
  const entries = funnelEntriesInWeek(countedContacts(summary), todayOf(summary));
  const entryGoal = settings.entryGoal.inEffect;
  const allies = summary.contacts.filter(({ status }) => status === 'ally').length;
  const circleGoal = settings.circleSizeGoal;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="sr-only">
        {m.insights_effort()}
      </h2>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Figure
          label={m.insights_actions_week()}
          value={prospecting.actionsThisWeek}
          detail={m.insights_actions_last_week({ count: prospecting.actionsLastWeek })}
        />
        <Figure
          label={m.insights_actions_period()}
          value={prospecting.actionsInPeriod}
          detail={m.insights_actions_per_day({ average: decimal.format(perDay) })}
        />
        <Figure label={m.insights_finished_trials()} value={prospecting.finishedTrials} />
        {entryGoal === null ? (
          <Figure
            label={m.today_entries()}
            value={m.today_entries_count_no_goal({ count: entries })}
          />
        ) : (
          <Figure
            label={m.today_entries_week()}
            value={
              // The success colour once reached; the figures say it as well.
              <span className={cn(entries >= entryGoal && 'text-success')}>
                <span aria-hidden="true">
                  {m.today_entries_count({ count: entries, goal: entryGoal })}
                </span>
                <span className="sr-only">
                  {m.today_entries_label({ count: entries, goal: entryGoal })}
                </span>
              </span>
            }
          />
        )}
        <Figure
          label={m.insights_circle()}
          value={
            circleGoal === null ? (
              m.circle_count({ count: allies })
            ) : (
              <>
                <span aria-hidden="true">
                  {allies}/{circleGoal}
                </span>
                <span className="sr-only">
                  {m.circle_count_of_goal({ count: allies, goal: circleGoal })}
                </span>
              </>
            )
          }
        />
      </dl>
    </section>
  );
}

/** The Insights screen (spec UX §5.7): the period, the effort, the Funnel, the Activity. */
export function InsightsScreen({
  period,
  onPeriodChange,
}: {
  period: InsightsPeriod;
  onPeriodChange: (period: InsightsPeriod) => void;
}) {
  const api = useApi();
  const locale = useLocale();
  const { data: summary, isError: summaryFailed } = useQuery(summaryQuery(api));
  const { data: insights, isError } = useQuery(insightsQuery(api, period));
  return (
    <Screen title={m.insights()}>
      <SegmentedControl
        aria-label={m.insights_period()}
        value={period}
        onChange={(value) => {
          const chosen = INSIGHTS_PERIODS.find((id) => id === value);
          if (chosen) onPeriodChange(chosen);
        }}
      >
        <SegmentedControlItems className="flex-wrap">
          {INSIGHTS_PERIODS.map((id) => (
            <SegmentedControlItem key={id} value={id}>
              {PERIOD_LABEL[id]()}
            </SegmentedControlItem>
          ))}
        </SegmentedControlItems>
      </SegmentedControl>
      <ErrorMessage>{(isError || summaryFailed) && m.insights_load_error()}</ErrorMessage>
      {summary && insights && (
        <>
          <TopFigures insights={insights} summary={summary} locale={locale} />
          <FunnelSection funnel={insights.funnel} summary={summary} locale={locale} />
          <ActivitySection activity={insights.activity} locale={locale} />
        </>
      )}
    </Screen>
  );
}
