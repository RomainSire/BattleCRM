import type {
  Summary,
  SummaryBattle,
  SummaryChanges,
  SummaryContact,
  SummaryOrganization,
  SummaryPositioning,
  SummaryStage,
} from '@battlecrm/contract';
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
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
  contact,
  followUp,
  interaction,
  PROSPECTING_ACTION_KINDS,
  statusChange,
} from '../prospecting/index.ts';
import { idOf } from '../route-id.ts';
import { settingsOf, timeZoneAt } from '../settings/index.ts';

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
      statusReason: current.reason,
      followUpDueOn: scheduled.dueOn,
      followUpNote: scheduled.note,
      followUpRank: scheduled.rank,
      prospectingActionDays: actions.days,
    })
    .from(contact)
    .innerJoin(latest, eq(latest.contactId, contact.id))
    .leftJoin(latestDone, eq(latestDone.contactId, contact.id))
    .leftJoin(entries, eq(entries.contactId, contact.id))
    .leftJoin(current, eq(current.contactId, contact.id))
    .leftJoin(scheduled, eq(scheduled.contactId, contact.id))
    .leftJoin(actions, eq(actions.contactId, contact.id))
    .where(and(eq(contact.userId, userId), ids && inArray(contact.id, ids)))
    .orderBy(desc(latest.occurredAt), desc(contact.id));
  return rows.map(({ followUpDueOn, followUpNote, followUpRank, ...row }) => ({
    ...row,
    lastInteractionAt: row.lastInteractionAt.toISOString(),
    funnelEntryDays: row.funnelEntryDays ?? [],
    followUp:
      followUpDueOn === null
        ? null
        : { dueOn: followUpDueOn, note: followUpNote, rank: followUpRank },
    prospectingActionDays: row.prospectingActionDays ?? [],
  }));
}

/** Every Stage of the User, archived ones too: a Contact may keep one as the last it reached. In the order of the Funnel. */
const summaryStages = (tx: Transaction, userId: string): Promise<SummaryStage[]> =>
  tx
    .select({
      id: stage.id,
      name: stage.name,
      aim: stage.aim,
      archived: isNotNull(stage.archivedAt).mapWith(Boolean),
    })
    .from(stage)
    .where(eq(stage.userId, userId))
    .orderBy(...FUNNEL_ORDER);

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
      archived: isNotNull(positioning.archivedAt).mapWith(Boolean),
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
  return rows.map(({ followUpDays, followUpMessages, ...row }) => ({
    ...row,
    attachments: attachments
      .filter(({ positioningId }) => positioningId === row.id)
      .map(({ positioningId: _joinedTo, ...attachment }) => attachment),
    followUps: followUpDays.map((days, rank) => ({
      days,
      message: followUpMessages[rank] ?? null,
    })),
    used: used.has(row.id),
    // Its Trials come with Trials (ticket 28): until then, none is frozen.
    trialCount: 0,
  }));
}

/** Every Battle of the User, open or closed, or the ones a gesture touched; the earliest first. */
async function summaryBattles(
  tx: Transaction,
  userId: string,
  ids?: string[],
): Promise<SummaryBattle[]> {
  if (ids?.length === 0) return [];
  return tx
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
    })
    .from(battle)
    .where(and(eq(battle.userId, userId), ids && inArray(battle.id, ids)))
    .orderBy(battle.openedAt, battle.id);
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
 * Positioning a use sent and the change of Status it recorded.
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
    })
    .from(interaction)
    .leftJoin(
      statusChange,
      and(eq(statusChange.userId, userId), eq(statusChange.interactionId, interaction.id)),
    )
    .where(and(eq(interaction.userId, userId), eq(interaction.contactId, contactId)))
    .orderBy(desc(interaction.occurredAt), desc(interaction.id));
  return {
    note: found.note,
    thread: thread.map(({ fromStatus, toStatus, stageId, reason, occurredAt, ...recorded }) => ({
      ...recorded,
      occurredAt: occurredAt.toISOString(),
      statusChange: toStatus === null ? null : { fromStatus, toStatus, stageId, reason },
    })),
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
  };
}

/** The reads, one per view (spec stack §5.2): this module reads the tables of the others and writes none of them. */
export function createViews({ clock, requireUser }: { clock: Clock; requireUser: RequireUser }) {
  const routes = new Hono<AppEnv>()
    // The whole working summary, in one read, as the contract describes it (ADR 0012).
    .get('/summary', requireUser, async (c) => {
      const { userId } = c.var;
      const now = clock.now();
      const summary = await withUser(userId, async (tx): Promise<Summary> => ({
        // What “today” is read in, on the device too.
        timeZone: await timeZoneAt(tx, userId, now),
        settings: await settingsOf(tx, userId, now),
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
    });
  return { routes };
}
