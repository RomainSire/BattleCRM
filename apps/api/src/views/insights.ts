import type { Insights, InsightsPeriod } from '@battlecrm/contract';
import { addDays, localDay, mondayOf } from '@battlecrm/domain';
import { and, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm';

import type { Transaction } from '../db/index.ts';
import { FUNNEL_ORDER, stage } from '../funnel/index.ts';
import {
  interaction,
  PROSPECTING_ACTION_KINDS,
  stageChange,
  statusChange,
  trial,
} from '../prospecting/index.ts';
import { activityGoalReader, entryGoalReader, timeZoneReader } from '../settings/index.ts';

/** The local day `count` months before another one, the end of a shorter month when it has no such day. */
function monthsBefore(day: string, count: number): string {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 - count, 1, 12));
  const lastDate = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  target.setUTCDate(Math.min(date, lastDate));
  return target.toISOString().slice(0, 10);
}

/** The first local day of the last `count` months up to today, today included. */
const lastMonthsFrom = (today: string, count: number) => addDays(monthsBefore(today, count), 1);

/** Every local day from one to another, both included. */
function daysFrom(from: string, to: string): string[] {
  const days = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** The Prospecting actions of each local day from one on (ST-41): by the day of the Interaction, not its entry. */
async function actionsByDay(tx: Transaction, userId: string, from: string) {
  const rows = await tx
    .select({ day: interaction.localDate, count: sql<number>`count(*)::int` })
    .from(interaction)
    .where(
      and(
        eq(interaction.userId, userId),
        inArray(interaction.kind, [...PROSPECTING_ACTION_KINDS]),
        gte(interaction.localDate, from),
      ),
    )
    .groupBy(interaction.localDate);
  return new Map(rows.map(({ day, count }) => [day, count]));
}

/**
 * The Trials settled in a period, Success or No result: each on the local day it was settled, in the
 * time zone in effect then.
 */
async function finishedTrialsIn(tx: Transaction, userId: string, from: string, to: string) {
  const settled = await tx
    .select({ settledAt: trial.settledAt })
    .from(trial)
    .where(and(eq(trial.userId, userId), inArray(trial.outcome, ['success', 'no_result'])));
  const timeZoneAt = await timeZoneReader(tx, userId);
  return settled.filter(({ settledAt }) => {
    if (settledAt === null) return false;
    const day = localDay(settledAt, timeZoneAt(settledAt));
    return day >= from && day <= to;
  }).length;
}

/**
 * The Funnel entries of each week of a period, from its Monday, by the local day they were written
 * down on (ST-49), with the Entry goal the week had: the first week whole, never cut at the start of
 * the period.
 */
async function entryWeeksIn(tx: Transaction, userId: string, from: string, to: string) {
  const entries = await tx
    .select({ day: interaction.localDate })
    .from(statusChange)
    .innerJoin(
      interaction,
      and(eq(interaction.userId, userId), eq(interaction.id, statusChange.interactionId)),
    )
    .where(
      and(
        eq(statusChange.userId, userId),
        eq(statusChange.toStatus, 'prospecting'),
        gte(interaction.localDate, mondayOf(from)),
        lte(interaction.localDate, to),
      ),
    );
  const entryGoalOf = await entryGoalReader(tx, userId);
  const weeks = [];
  for (let monday = mondayOf(from); monday <= to; monday = addDays(monday, 7)) {
    const count = entries.filter(({ day }) => mondayOf(day) === monday).length;
    weeks.push({ monday, count, goal: entryGoalOf(monday) });
  }
  return weeks;
}

/**
 * Each Stage, archived ones too, in the order of the Funnel: the Contacts that arrived there in a
 * period, by an entry or a change of Stage, and how many of them then went further from it, a skip
 * too, “further” read in the order of the Funnel when they moved (ADR 0003). The Stages skipped and
 * those before the one a Contact entered at are not arrived at. An archived Stage has no
 * Pass-through rate (CONTEXT.md).
 */
async function stagePassagesIn(tx: Transaction, userId: string, from: string, to: string) {
  const counted = await tx.execute<{ stage_id: string; arrived: number; passed: number }>(sql`
    with arrival as (
      select ${statusChange.contactId} as contact_id, ${statusChange.stageId} as stage_id,
             ${interaction.occurredAt} as occurred_at, ${interaction.id} as id
        from ${statusChange}
        join ${interaction} on ${interaction.userId} = ${statusChange.userId}
                           and ${interaction.id} = ${statusChange.interactionId}
       where ${statusChange.userId} = ${userId} and ${statusChange.toStatus} = 'prospecting'
         and ${interaction.localDate} between ${from} and ${to}
      union all
      select ${stageChange.contactId}, ${stageChange.toStageId}, ${interaction.occurredAt}, ${interaction.id}
        from ${stageChange}
        join ${interaction} on ${interaction.userId} = ${stageChange.userId}
                           and ${interaction.id} = ${stageChange.interactionId}
       where ${stageChange.userId} = ${userId}
         and ${interaction.localDate} between ${from} and ${to}
    ),
    -- A Contact counts once at a Stage: from the first time it arrived there in the period.
    first_arrival as (
      select distinct on (contact_id, stage_id) *
        from arrival
       order by contact_id, stage_id, occurred_at, id
    )
    select first_arrival.stage_id, count(*)::int as arrived,
           count(*) filter (where exists (
             select 1
               from ${stageChange}
               join ${interaction} on ${interaction.userId} = ${stageChange.userId}
                                  and ${interaction.id} = ${stageChange.interactionId}
              where ${stageChange.userId} = ${userId}
                and ${stageChange.contactId} = first_arrival.contact_id
                and ${stageChange.fromStageId} = first_arrival.stage_id
                and ${stageChange.toPosition} > ${stageChange.fromPosition}
                and (${interaction.occurredAt}, ${interaction.id}) > (first_arrival.occurred_at, first_arrival.id)
           ))::int as passed
      from first_arrival
     group by first_arrival.stage_id`);
  const byStage = new Map(counted.rows.map((row) => [row.stage_id, row]));
  const stages = await tx
    .select({ id: stage.id, archived: isNotNull(stage.archivedAt).mapWith(Boolean) })
    .from(stage)
    .where(eq(stage.userId, userId))
    .orderBy(...FUNNEL_ORDER);
  return stages.map(({ id, archived }) => ({
    stageId: id,
    arrived: byStage.get(id)?.arrived ?? 0,
    passed: archived ? null : (byStage.get(id)?.passed ?? 0),
  }));
}

/**
 * The Contacts that left Prospecting in a period, for the Pool, the Circle or the archive, by the
 * Stage they left it from: only the Stages some left from, in the order of the Funnel.
 */
async function exitsIn(
  tx: Transaction,
  userId: string,
  from: string,
  to: string,
  stageIds: readonly string[],
) {
  const rows = await tx
    .select({
      stageId: statusChange.stageId,
      toStatus: statusChange.toStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(statusChange)
    .innerJoin(
      interaction,
      and(eq(interaction.userId, userId), eq(interaction.id, statusChange.interactionId)),
    )
    .where(
      and(
        eq(statusChange.userId, userId),
        eq(statusChange.fromStatus, 'prospecting'),
        gte(interaction.localDate, from),
        lte(interaction.localDate, to),
      ),
    )
    .groupBy(statusChange.stageId, statusChange.toStatus);
  const countOf = (stageId: string, toStatus: string) =>
    rows.find((row) => row.stageId === stageId && row.toStatus === toStatus)?.count ?? 0;
  return stageIds
    .filter((stageId) => rows.some((row) => row.stageId === stageId))
    .map((stageId) => ({
      stageId,
      ally: countOf(stageId, 'ally'),
      pool: countOf(stageId, 'pool'),
      archived: countOf(stageId, 'archived'),
    }));
}

/** The first local day of a period ending today (spec UX §5.7). */
async function periodFrom(
  tx: Transaction,
  userId: string,
  period: InsightsPeriod,
  today: string,
): Promise<string> {
  if (period === '30d') return addDays(today, -29);
  if (period === '3m') return lastMonthsFrom(today, 3);
  if (period === '12m') return lastMonthsFrom(today, 12);
  // Since the first thing the User recorded.
  const [first] = await tx
    .select({ day: sql<string | null>`min(${interaction.localDate})` })
    .from(interaction)
    .where(and(eq(interaction.userId, userId), lte(interaction.localDate, today)));
  return first?.day ?? today;
}

/**
 * What Insights read over a period ending today (spec UX §5.7): each count by the local day it was
 * written down on, never recomputed in today's time zone, and each goal as it was in effect (ADR 0003).
 */
export async function insightsOf(
  tx: Transaction,
  userId: string,
  period: InsightsPeriod,
  today: string,
): Promise<Insights> {
  const from = await periodFrom(tx, userId, period, today);
  const yearFrom = lastMonthsFrom(today, 12);
  const lastMonday = addDays(mondayOf(today), -7);
  const actions = await actionsByDay(
    tx,
    userId,
    [yearFrom, from, lastMonday].toSorted()[0] ?? from,
  );
  const actionsFrom = (first: string, last = today) =>
    daysFrom(first, last).reduce((total, day) => total + (actions.get(day) ?? 0), 0);
  const activityGoalOn = await activityGoalReader(tx, userId);
  const stages = await stagePassagesIn(tx, userId, from, today);
  return {
    period: { from, to: today },
    prospecting: {
      actionsThisWeek: actionsFrom(mondayOf(today)),
      actionsLastWeek: actionsFrom(lastMonday, addDays(mondayOf(today), -1)),
      actionsInPeriod: actionsFrom(from),
      finishedTrials: await finishedTrialsIn(tx, userId, from, today),
    },
    activity: daysFrom(yearFrom, today).map((day) => ({
      day,
      count: actions.get(day) ?? 0,
      goal: activityGoalOn(day),
    })),
    funnel: {
      stages,
      exits: await exitsIn(
        tx,
        userId,
        from,
        today,
        stages.map(({ stageId }) => stageId),
      ),
      entryWeeks: await entryWeeksIn(tx, userId, from, today),
    },
  };
}
