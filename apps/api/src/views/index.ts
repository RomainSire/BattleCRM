import type {
  BattleTrial,
  TrialOutcome,
  Summary,
  SummaryBattle,
  SummaryChanges,
  SummaryContact,
  SummaryOrganization,
  SummaryPositioning,
  SummaryStage,
} from '@battlecrm/contract';
import { archivedBy } from '@battlecrm/domain';
import { and, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import type { AppEnv } from '../app.ts';
import { battle } from '../battles/index.ts';
import type { RequireUser } from '../auth/index.ts';
import type { Clock } from '../clock.ts';
import { withUser, type Transaction } from '../db/index.ts';
import { FUNNEL_ORDER, positioning, positioningAttachment, stage } from '../funnel/index.ts';
import type { Touched } from '../gestures/index.ts';
import { organization } from '../organizations/index.ts';
import {
  assignment,
  contact,
  followUp,
  interaction,
  PROSPECTING_ACTION_KINDS,
  stageChange,
  statusChange,
  trial,
} from '../prospecting/index.ts';
import type { Random } from '../random.ts';
import { idOf } from '../route-id.ts';
import { localDateOf, settingsOf, timeZoneAt } from '../settings/index.ts';
import { celebratedOnOf, recordCelebration } from './celebration.ts';
import { dailyPicksOf, passEntry, postponeBattle } from './daily-picks.ts';

/**
 * The Contacts of the working summary (ADR 0012), the latest Interaction first: all of them, or the
 * ones a gesture touched.
 */
async function summaryContacts(
  tx: Transaction,
  userId: string,
  ids?: string[],
): Promise<SummaryContact[]> {
  if (ids?.length === 0) return [];
  const latest = tx
    .selectDistinctOn([interaction.contactId], {
      contactId: interaction.contactId,
      occurredAt: interaction.occurredAt,
      localDate: interaction.localDate,
    })
    .from(interaction)
    .where(and(eq(interaction.userId, userId), ids && inArray(interaction.contactId, ids)))
    .orderBy(interaction.contactId, desc(interaction.occurredAt), desc(interaction.id))
    .as('latest');
  // The latest Interaction done, outbound or inbound: what the Days since contact count from.
  const latestDone = tx
    .selectDistinctOn([interaction.contactId], {
      contactId: interaction.contactId,
      localDate: interaction.localDate,
    })
    .from(interaction)
    .where(
      and(
        eq(interaction.userId, userId),
        inArray(interaction.direction, ['outbound', 'inbound']),
        ids && inArray(interaction.contactId, ids),
      ),
    )
    .orderBy(interaction.contactId, desc(interaction.occurredAt), desc(interaction.id))
    .as('latest_done');
  // Each Funnel entry, by the local day it was written down on (ST-49): the SPA counts those of a week.
  const entries = tx
    .select({
      contactId: statusChange.contactId,
      // As text: a `date` stays a `YYYY-MM-DD` string, never a JavaScript date (spec stack §6).
      days: sql<
        string[]
      >`array_agg(${interaction.localDate}::text order by ${interaction.occurredAt}, ${interaction.id})`.as(
        'days',
      ),
    })
    .from(statusChange)
    .innerJoin(
      interaction,
      and(eq(interaction.userId, userId), eq(interaction.id, statusChange.interactionId)),
    )
    .where(
      and(
        eq(statusChange.userId, userId),
        eq(statusChange.toStatus, 'prospecting'),
        ids && inArray(statusChange.contactId, ids),
      ),
    )
    .groupBy(statusChange.contactId)
    .as('entries');
  // The latest change that put the Contact at its Stage: a change of Stage, or an entry in the Funnel,
  // which sets the Stage it enters. Its local day is the one the Funnel table shows (spec UX §5.2).
  const reached = tx
    .selectDistinctOn([interaction.contactId], {
      contactId: interaction.contactId,
      localDate: interaction.localDate,
    })
    .from(interaction)
    .leftJoin(
      statusChange,
      and(eq(statusChange.userId, userId), eq(statusChange.interactionId, interaction.id)),
    )
    .where(
      and(
        eq(interaction.userId, userId),
        or(eq(interaction.kind, 'stage_changed'), eq(statusChange.toStatus, 'prospecting')),
        ids && inArray(interaction.contactId, ids),
      ),
    )
    .orderBy(interaction.contactId, desc(interaction.occurredAt), desc(interaction.id))
    .as('stage_reached');
  // Each Prospecting action, by its local day (ST-41): the SPA counts the Activity of a day.
  const actions = tx
    .select({
      contactId: interaction.contactId,
      days: sql<
        string[]
      >`array_agg(${interaction.localDate}::text order by ${interaction.localDate}, ${interaction.occurredAt}, ${interaction.id})`.as(
        'action_days',
      ),
    })
    .from(interaction)
    .where(
      and(
        eq(interaction.userId, userId),
        inArray(interaction.kind, [...PROSPECTING_ACTION_KINDS]),
        ids && inArray(interaction.contactId, ids),
      ),
    )
    .groupBy(interaction.contactId)
    .as('actions');
  // The scheduled Follow-up, at most one per Contact.
  const scheduled = tx
    .select({
      contactId: followUp.contactId,
      dueOn: followUp.dueOn,
      note: followUp.note,
      rank: followUp.rank,
    })
    .from(followUp)
    .where(
      and(
        eq(followUp.userId, userId),
        eq(followUp.status, 'scheduled'),
        ids && inArray(followUp.contactId, ids),
      ),
    )
    .as('scheduled');
  // The change that put the Contact in its Status: its reason, shown with it (spec UX §5.3, §5.10).
  const current = tx
    .selectDistinctOn([statusChange.contactId], {
      contactId: statusChange.contactId,
      reason: statusChange.reason,
    })
    .from(statusChange)
    .innerJoin(
      interaction,
      and(eq(interaction.userId, userId), eq(interaction.id, statusChange.interactionId)),
    )
    .where(and(eq(statusChange.userId, userId), ids && inArray(statusChange.contactId, ids)))
    .orderBy(statusChange.contactId, desc(interaction.occurredAt), desc(interaction.id))
    .as('current_status');
  // Its Trial in progress, at most one, from the day of the use that started it.
  const inProgress = tx
    .select({
      contactId: trial.contactId,
      battleId: trial.battleId,
      positioningId: trial.positioningId,
      startedOn: interaction.localDate,
      overridden: trial.overridden,
    })
    .from(trial)
    .innerJoin(
      interaction,
      and(eq(interaction.userId, userId), eq(interaction.id, trial.interactionId)),
    )
    .where(
      and(
        eq(trial.userId, userId),
        eq(trial.outcome, 'in_progress'),
        ids && inArray(trial.contactId, ids),
      ),
    )
    .as('trial_in_progress');
  const rows = await tx
    .select({
      id: contact.id,
      name: contact.name,
      status: contact.status,
      stageId: contact.stageId,
      // What the search and the duplicate checks read without a round trip (ST-63, ST-64); not the note.
      organizationId: contact.organizationId,
      jobTitle: contact.jobTitle,
      email: contact.email,
      phone: contact.phone,
      linkedinUrl: contact.linkedinUrl,
      lastInteractionAt: latest.occurredAt,
      lastInteractionOn: latest.localDate,
      lastDoneInteractionOn: latestDone.localDate,
      funnelEntryDays: entries.days,
      stageEnteredOn: reached.localDate,
      statusReason: current.reason,
      followUpDueOn: scheduled.dueOn,
      followUpNote: scheduled.note,
      followUpRank: scheduled.rank,
      prospectingActionDays: actions.days,
      assignmentBattleId: assignment.battleId,
      assignmentPositioningId: assignment.positioningId,
      trialBattleId: inProgress.battleId,
      trialPositioningId: inProgress.positioningId,
      trialStartedOn: inProgress.startedOn,
      trialOverridden: inProgress.overridden,
    })
    .from(contact)
    .innerJoin(latest, eq(latest.contactId, contact.id))
    .leftJoin(latestDone, eq(latestDone.contactId, contact.id))
    .leftJoin(entries, eq(entries.contactId, contact.id))
    .leftJoin(reached, eq(reached.contactId, contact.id))
    .leftJoin(current, eq(current.contactId, contact.id))
    .leftJoin(scheduled, eq(scheduled.contactId, contact.id))
    .leftJoin(actions, eq(actions.contactId, contact.id))
    .leftJoin(assignment, and(eq(assignment.userId, userId), eq(assignment.contactId, contact.id)))
    .leftJoin(inProgress, eq(inProgress.contactId, contact.id))
    .where(and(eq(contact.userId, userId), ids && inArray(contact.id, ids)))
    .orderBy(desc(latest.occurredAt), desc(contact.id));
  return rows.map(
    ({
      followUpDueOn,
      followUpNote,
      followUpRank,
      assignmentBattleId,
      assignmentPositioningId,
      trialBattleId,
      trialPositioningId,
      trialStartedOn,
      trialOverridden,
      ...row
    }) => ({
      ...row,
      lastInteractionAt: row.lastInteractionAt.toISOString(),
      funnelEntryDays: row.funnelEntryDays ?? [],
      followUp:
        followUpDueOn === null
          ? null
          : { dueOn: followUpDueOn, note: followUpNote, rank: followUpRank },
      prospectingActionDays: row.prospectingActionDays ?? [],
      assignment:
        assignmentBattleId === null || assignmentPositioningId === null
          ? null
          : { battleId: assignmentBattleId, positioningId: assignmentPositioningId },
      trial:
        trialBattleId === null ||
        trialPositioningId === null ||
        trialStartedOn === null ||
        trialOverridden === null
          ? null
          : {
              battleId: trialBattleId,
              positioningId: trialPositioningId,
              startedOn: trialStartedOn,
              overridden: trialOverridden,
            },
    }),
  );
}

/**
 * Every Stage of the User, archived ones too: a Contact may keep one as the last it reached. In the
 * order of the Funnel, each with whether it served (CONTEXT.md, Stage).
 */
async function summaryStages(tx: Transaction, userId: string): Promise<SummaryStage[]> {
  const stages = await tx
    .select({
      id: stage.id,
      name: stage.name,
      aim: stage.aim,
      archived: isNotNull(stage.archivedAt).mapWith(Boolean),
    })
    .from(stage)
    .where(eq(stage.userId, userId))
    .orderBy(...FUNNEL_ORDER);
  // A Contact is or was there, it bears a Positioning or a Battle.
  const served = await tx.execute<{ stage_id: string }>(sql`
    select ${contact.stageId} as stage_id from ${contact} where ${eq(contact.userId, userId)}
    union select ${statusChange.stageId} from ${statusChange} where ${eq(statusChange.userId, userId)}
    union select ${stageChange.fromStageId} from ${stageChange} where ${eq(stageChange.userId, userId)}
    union select ${stageChange.toStageId} from ${stageChange} where ${eq(stageChange.userId, userId)}
    union select ${positioning.stageId} from ${positioning} where ${eq(positioning.userId, userId)}
    union select ${battle.stageId} from ${battle} where ${eq(battle.userId, userId)}`);
  const servedIds = new Set(served.rows.map(({ stage_id }) => stage_id));
  return stages.map((row) => ({ ...row, served: servedIds.has(row.id) }));
}

/**
 * Every Positioning of the User, archived ones too, or the ones a gesture touched; the earliest first
 * (uuidv7), so a copy comes after its original.
 */
async function summaryPositionings(
  tx: Transaction,
  userId: string,
  ids?: string[],
): Promise<SummaryPositioning[]> {
  if (ids?.length === 0) return [];
  const rows = await tx
    .select({
      id: positioning.id,
      stageId: positioning.stageId,
      label: positioning.label,
      channel: positioning.channel,
      content: positioning.content,
      followUpDays: positioning.followUpDays,
      followUpMessages: positioning.followUpMessages,
      responseWindowDays: positioning.responseWindowDays,
      derivedFromId: positioning.derivedFromId,
      archivedAt: positioning.archivedAt,
    })
    .from(positioning)
    .where(and(eq(positioning.userId, userId), ids && inArray(positioning.id, ids)))
    .orderBy(positioning.id);
  // Its attachments not removed, in the order they were joined; their bytes are downloaded apart.
  const attachments = await tx
    .select({
      id: positioningAttachment.id,
      positioningId: positioningAttachment.positioningId,
      name: positioningAttachment.name,
      contentType: positioningAttachment.contentType,
      size: positioningAttachment.size,
    })
    .from(positioningAttachment)
    .where(
      and(
        eq(positioningAttachment.userId, userId),
        isNull(positioningAttachment.removedAt),
        ids && inArray(positioningAttachment.positioningId, ids),
      ),
    )
    .orderBy(positioningAttachment.id);
  // The ones used at least once: no longer deletable (CONTEXT.md, Positioning).
  const uses = await tx
    .selectDistinct({ positioningId: interaction.positioningId })
    .from(interaction)
    .where(
      and(
        eq(interaction.userId, userId),
        isNotNull(interaction.positioningId),
        ids && inArray(interaction.positioningId, ids),
      ),
    );
  const used = new Set(uses.map(({ positioningId }) => positioningId));
  // Its Trials, canceled ones too: frozen from the first (CONTEXT.md, Positioning).
  const trials = await tx
    .select({ positioningId: trial.positioningId, count: sql<number>`count(*)::int` })
    .from(trial)
    .where(and(eq(trial.userId, userId), ids && inArray(trial.positioningId, ids)))
    .groupBy(trial.positioningId);
  const trialCounts = new Map(trials.map(({ positioningId, count }) => [positioningId, count]));
  // The Battles whose closing archived one, at the same instant (spec UX §5.6).
  const closed = await tx
    .select({
      championId: battle.championId,
      challengerId: battle.challengerId,
      verdict: battle.verdict,
      closedAt: battle.closedAt,
      closedOn: battle.closedOn,
    })
    .from(battle)
    .where(and(eq(battle.userId, userId), isNotNull(battle.closedAt)));
  const archivedByBattleOf = (positioningId: string, archivedAt: Date | null) => {
    for (const { championId, challengerId, verdict, closedAt, closedOn } of closed) {
      if (verdict === null || closedOn === null || archivedAt === null) continue;
      if (closedAt?.getTime() !== archivedAt.getTime()) continue;
      const archived = archivedBy(verdict);
      if (archived === undefined) continue;
      const [archivedId, againstId] =
        archived === 'champion' ? [championId, challengerId] : [challengerId, championId];
      if (archivedId === positioningId) return { againstId, on: closedOn, verdict };
    }
    return null;
  };
  return rows.map(({ followUpDays, followUpMessages, archivedAt, ...row }) => ({
    ...row,
    archived: archivedAt !== null,
    archivedByBattle: archivedByBattleOf(row.id, archivedAt),
    attachments: attachments
      .filter(({ positioningId }) => positioningId === row.id)
      .map(({ positioningId: _joinedTo, ...attachment }) => attachment),
    followUps: followUpDays.map((days, rank) => ({
      days,
      message: followUpMessages[rank] ?? null,
    })),
    used: used.has(row.id),
    trialCount: trialCounts.get(row.id) ?? 0,
  }));
}

/** Every Battle of the User, open or closed, or the ones a gesture touched; the earliest first. */
async function summaryBattles(
  tx: Transaction,
  userId: string,
  ids?: string[],
): Promise<SummaryBattle[]> {
  if (ids?.length === 0) return [];
  // Its Trials started, the canceled ones aside, and the finished ones among them.
  const trials = tx
    .select({
      battleId: trial.battleId,
      started: sql<number>`count(*) filter (where ${trial.outcome} <> 'canceled')::int`.as(
        'started',
      ),
      finished:
        sql<number>`count(*) filter (where ${trial.outcome} in ('success', 'no_result'))::int`.as(
          'finished',
        ),
    })
    .from(trial)
    .where(and(eq(trial.userId, userId), ids && inArray(trial.battleId, ids)))
    .groupBy(trial.battleId)
    .as('battle_trials');
  const rows = await tx
    .select({
      id: battle.id,
      stageId: battle.stageId,
      championId: battle.championId,
      challengerId: battle.challengerId,
      successCriterion: battle.successCriterion,
      target: battle.target,
      threshold: battle.threshold,
      horizon: battle.horizon,
      openedOn: battle.openedOn,
      open: isNull(battle.closedAt).mapWith(Boolean),
      closedOn: battle.closedOn,
      verdict: battle.verdict,
      designated: battle.designated,
      takeaway: battle.takeaway,
      startedTrials: trials.started,
      finishedTrials: trials.finished,
    })
    .from(battle)
    .leftJoin(trials, eq(trials.battleId, battle.id))
    .where(and(eq(battle.userId, userId), ids && inArray(battle.id, ids)))
    .orderBy(battle.openedAt, battle.id);
  // Its Trials per Positioning and outcome, the canceled ones aside: what the Win rule reads.
  const outcomes = await tx
    .select({
      battleId: trial.battleId,
      positioningId: trial.positioningId,
      outcome: trial.outcome,
      count: sql<number>`count(*)::int`,
    })
    .from(trial)
    .where(
      and(
        eq(trial.userId, userId),
        ne(trial.outcome, 'canceled'),
        ids && inArray(trial.battleId, ids),
      ),
    )
    .groupBy(trial.battleId, trial.positioningId, trial.outcome);
  const countsOf = (battleId: string, positioningId: string) => {
    const count = (outcome: TrialOutcome) =>
      outcomes.find(
        (row) =>
          row.battleId === battleId &&
          row.positioningId === positioningId &&
          row.outcome === outcome,
      )?.count ?? 0;
    return {
      successes: count('success'),
      noResults: count('no_result'),
      inProgress: count('in_progress'),
    };
  };
  return rows.map(({ startedTrials, finishedTrials, ...row }) => ({
    ...row,
    startedTrials: startedTrials ?? 0,
    finishedTrials: finishedTrials ?? 0,
    trials: {
      champion: countsOf(row.id, row.championId),
      challenger: countsOf(row.id, row.challengerId),
    },
  }));
}

/**
 * The Trials of a Battle, read on demand by its panel (spec UX §5.5): the latest first, each with its
 * Contact, Positioning, day, outcome and Target. `undefined` when the User has no such Battle.
 */
async function battleTrials(
  tx: Transaction,
  userId: string,
  battleId: string,
): Promise<BattleTrial[] | undefined> {
  const [found] = await tx
    .select({ id: battle.id })
    .from(battle)
    .where(and(eq(battle.userId, userId), eq(battle.id, battleId)));
  if (!found) return undefined;
  return tx
    .select({
      id: trial.id,
      contactId: trial.contactId,
      positioningId: trial.positioningId,
      startedOn: interaction.localDate,
      outcome: trial.outcome,
      target: trial.target,
      cancelReason: trial.cancelReason,
    })
    .from(trial)
    .innerJoin(
      interaction,
      and(eq(interaction.userId, userId), eq(interaction.id, trial.interactionId)),
    )
    .where(and(eq(trial.userId, userId), eq(trial.battleId, battleId)))
    .orderBy(desc(interaction.occurredAt), desc(trial.id));
}

/** Every Organization of the User, or the ones a gesture touched, by name. */
async function summaryOrganizations(
  tx: Transaction,
  userId: string,
  ids?: string[],
): Promise<SummaryOrganization[]> {
  if (ids?.length === 0) return [];
  return tx
    .select({ id: organization.id, name: organization.name, type: organization.type })
    .from(organization)
    .where(and(eq(organization.userId, userId), ids && inArray(organization.id, ids)))
    .orderBy(organization.normalizedName);
}

/**
 * What the record of a Contact reads beyond the summary, on demand (spec stack §3): its note, and its
 * thread from the latest Interaction to the earliest, each with its note, the Channel of a reply, the
 * Positioning a use sent, the change of Status or of Stage it recorded: forward or back as the Funnel
 * read then (ADR 0003).
 * `undefined` when the User has no such Contact.
 */
async function contactRecord(tx: Transaction, userId: string, contactId: string) {
  const [found] = await tx
    .select({ note: contact.note })
    .from(contact)
    .where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
  if (!found) return undefined;
  const thread = await tx
    .select({
      id: interaction.id,
      kind: interaction.kind,
      direction: interaction.direction,
      occurredAt: interaction.occurredAt,
      localDate: interaction.localDate,
      note: interaction.note,
      channel: interaction.channel,
      positioningId: interaction.positioningId,
      fromStatus: statusChange.fromStatus,
      toStatus: statusChange.toStatus,
      stageId: statusChange.stageId,
      reason: statusChange.reason,
      fromStageId: stageChange.fromStageId,
      toStageId: stageChange.toStageId,
      fromPosition: stageChange.fromPosition,
      toPosition: stageChange.toPosition,
    })
    .from(interaction)
    .leftJoin(
      statusChange,
      and(eq(statusChange.userId, userId), eq(statusChange.interactionId, interaction.id)),
    )
    .leftJoin(
      stageChange,
      and(eq(stageChange.userId, userId), eq(stageChange.interactionId, interaction.id)),
    )
    .where(and(eq(interaction.userId, userId), eq(interaction.contactId, contactId)))
    .orderBy(desc(interaction.occurredAt), desc(interaction.id));
  return {
    note: found.note,
    thread: thread.map(
      ({
        fromStatus,
        toStatus,
        stageId,
        reason,
        fromStageId,
        toStageId,
        fromPosition,
        toPosition,
        occurredAt,
        ...recorded
      }) => ({
        ...recorded,
        occurredAt: occurredAt.toISOString(),
        statusChange: toStatus === null ? null : { fromStatus, toStatus, stageId, reason },
        stageChange:
          fromStageId === null || toStageId === null
            ? null
            : { fromStageId, toStageId, forward: (toPosition ?? 0) > (fromPosition ?? 0) },
      }),
    ),
  };
}

/** What the answer of a gesture carries: the rows of the summary it changed, and the ones it removed. */
export async function summaryChanges(
  tx: Transaction,
  userId: string,
  touched: Touched,
): Promise<SummaryChanges> {
  return {
    contacts: await summaryContacts(tx, userId, touched.contactIds),
    removedContactIds: touched.removedContactIds,
    organizations: await summaryOrganizations(tx, userId, touched.organizationIds),
    removedOrganizationIds: touched.removedOrganizationIds,
    positionings: await summaryPositionings(tx, userId, touched.positioningIds),
    removedPositioningIds: touched.removedPositioningIds,
    battles: await summaryBattles(tx, userId, touched.battleIds),
    removedBattleIds: touched.removedBattleIds,
    stages: touched.stages ? await summaryStages(tx, userId) : null,
  };
}

/**
 * The reads, one per view (spec stack §5.2): this module reads the tables of the others and writes
 * none of them, only its own: what Today picked for the day (`daily_pick`, `battle_postponement`), and
 * the latest day celebrated (`celebration`).
 */
export function createViews({
  clock,
  random,
  requireUser,
}: {
  clock: Clock;
  random: Random;
  requireUser: RequireUser;
}) {
  const routes = new Hono<AppEnv>()
    // The whole working summary, in one read, as the contract describes it (ADR 0012).
    .get('/summary', requireUser, async (c) => {
      const { userId } = c.var;
      const now = clock.now();
      const summary = await withUser(userId, async (tx): Promise<Summary> => ({
        // What “today” is read in, on the device too.
        timeZone: await timeZoneAt(tx, userId, now),
        settings: await settingsOf(tx, userId, now),
        celebratedOn: await celebratedOnOf(tx, userId),
        contacts: await summaryContacts(tx, userId),
        stages: await summaryStages(tx, userId),
        organizations: await summaryOrganizations(tx, userId),
        positionings: await summaryPositionings(tx, userId),
        battles: await summaryBattles(tx, userId),
      }));
      return c.json(summary, 200);
    })
    // The record of a Contact, beyond what the summary holds (spec UX §5.3).
    .get('/contacts/:id/record', requireUser, async (c) => {
      const { userId } = c.var;
      const contactId = idOf(c.req.param('id'));
      // Another User's Contact, an unknown one and an id that is none answer alike.
      const record =
        contactId !== null &&
        (await withUser(userId, (tx) => contactRecord(tx, userId, contactId)));
      if (!record) return c.json({ error: 'not_found' as const }, 404);
      return c.json(record, 200);
    })
    // The Trials of a Battle, for its panel (spec UX §5.5): Trials and By Target.
    .get('/battles/:id/trials', requireUser, async (c) => {
      const { userId } = c.var;
      const battleId = idOf(c.req.param('id'));
      // Another User's Battle, an unknown one and an id that is none answer alike.
      const trials =
        battleId !== null && (await withUser(userId, (tx) => battleTrials(tx, userId, battleId)));
      if (!trials) return c.json({ error: 'not_found' as const }, 404);
      return c.json({ trials }, 200);
    })
    // What Today picked for the day, the same on every device all day long (spec UX §5.1, ST-47).
    .get('/today/picks', requireUser, async (c) => {
      const { userId } = c.var;
      const picks = await withUser(userId, async (tx) =>
        dailyPicksOf(tx, userId, await localDateOf(tx, userId, clock.now()), random),
      );
      return c.json(picks, 200);
    })
    // “Another one” on the Contact of the Pool proposed on a phone: the picks of the day without it.
    .post('/today/picks/entries/:id/pass', requireUser, async (c) => {
      const { userId } = c.var;
      const contactId = idOf(c.req.param('id'));
      // Not picked today, another User's Contact and an id that is none answer alike.
      const picks =
        contactId !== null &&
        (await withUser(userId, async (tx) => {
          const day = await localDateOf(tx, userId, clock.now());
          if (!(await passEntry(tx, userId, contactId, day))) return null;
          return dailyPicksOf(tx, userId, day, random);
        }));
      if (!picks) return c.json({ error: 'not_found' as const }, 404);
      return c.json(picks, 200);
    })
    // A gesture of this device brought the Activity of the day to its goal: celebrated once a day,
    // on every device (ST-44). Not a gesture: “Undo” never takes it back (ADR 0011).
    .post('/today/celebration', requireUser, async (c) => {
      const { userId } = c.var;
      const now = clock.now();
      const answer = await withUser(userId, async (tx) =>
        recordCelebration(tx, userId, await localDateOf(tx, userId, now), now),
      );
      return c.json(answer, 200);
    })
    // “Later” on a conclusive Battle: hidden from Today until the next day, on every device.
    .post('/today/battles/:id/later', requireUser, async (c) => {
      const { userId } = c.var;
      const battleId = idOf(c.req.param('id'));
      // Another User's Battle, an unknown or closed one and an id that is none answer alike.
      const postponed =
        battleId !== null &&
        (await withUser(userId, async (tx) =>
          postponeBattle(tx, userId, battleId, await localDateOf(tx, userId, clock.now())),
        ));
      if (!postponed) return c.json({ error: 'not_found' as const }, 404);
      return c.body(null, 204);
    });
  return { routes };
}
