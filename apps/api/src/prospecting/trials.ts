import {
  TARGETS,
  TRIAL_OUTCOMES,
  type SettledTrialOutcome,
  type TrialOutcome,
  type WithoutTrialReason,
} from '@battlecrm/contract';
import {
  chooseAssignment,
  targetOf,
  type Target,
  type TrialCounts,
  type WinRuleCounts,
} from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { and, eq, ne, notExists, sql } from 'drizzle-orm';
import { z } from 'zod';

import { isBattleOpen, openBattleToAssignAt } from '../battles/index.ts';
import type { Transaction } from '../db/index.ts';
import { organizationTypeOf } from '../organizations/index.ts';
import type { Random } from '../random.ts';
import { refusal } from '../refusals.ts';
import { settingsOf } from '../settings/index.ts';
import { assignment, contact, trial, trialDeviation, type TrialDeviationKind } from './tables.ts';

type OpenBattle = NonNullable<Awaited<ReturnType<typeof openBattleToAssignAt>>>;

/** A Contact of the User Prospecting at a Stage: what the Assignment and the Trial are read for. */
type ContactAtStage = { userId: string; contactId: string; stageId: string };

/** The Target of a Contact now (CONTEXT.md, Target): the type of its Organization, unknown without one. */
async function targetOfContact(tx: Transaction, userId: string, contactId: string) {
  const [found] = await tx
    .select({ organizationId: contact.organizationId })
    .from(contact)
    .where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
  const type =
    found?.organizationId == null
      ? undefined
      : await organizationTypeOf(tx, userId, found.organizationId);
  return targetOf(type && { type });
}

/** The Trials counted in a Battle: every one but the canceled (CONTEXT.md, Trial). */
const countedIn = (userId: string, battleId: string) =>
  and(eq(trial.userId, userId), eq(trial.battleId, battleId), ne(trial.outcome, 'canceled'));

/**
 * The Trials counted in a Battle, per Positioning, among the Contacts of a Target or all of them: the
 * latter is what the Horizon counts.
 */
async function trialsIn(tx: Transaction, userId: string, battleId: string, target?: Target) {
  const rows = await tx
    .select({ positioningId: trial.positioningId, count: sql<number>`count(*)::int` })
    .from(trial)
    .where(and(countedIn(userId, battleId), target && eq(trial.target, target)))
    .groupBy(trial.positioningId);
  return new Map(rows.map(({ positioningId, count }) => [positioningId, count]));
}

/** The Trial in progress of a Contact: at most one. */
const inProgressOf = (userId: string, contactId: string) =>
  and(eq(trial.userId, userId), eq(trial.contactId, contactId), eq(trial.outcome, 'in_progress'));

/** The Battle of a Trial in progress of a Contact, if it has one: at most one. */
async function trialInProgressOf(tx: Transaction, userId: string, contactId: string) {
  const [found] = await tx
    .select({ battleId: trial.battleId })
    .from(trial)
    .where(inProgressOf(userId, contactId));
  return found?.battleId;
}

/**
 * The Positioning reserved for a Contact in a Battle (ADR 0002), as it stands now. One reserved in
 * another Battle fell with its Battle or its Stage: it goes. One that reached the Horizon since is no
 * longer assigned: the other one is, the only one left, which no chance decides.
 */
async function reservedIn(
  tx: Transaction,
  { userId, contactId }: ContactAtStage,
  battle: OpenBattle,
  atHorizon: (positioningId: string) => boolean,
) {
  const [held] = await tx
    .select({
      id: assignment.id,
      battleId: assignment.battleId,
      positioningId: assignment.positioningId,
    })
    .from(assignment)
    .where(and(eq(assignment.userId, userId), eq(assignment.contactId, contactId)));
  if (!held) return undefined;
  const byId = and(eq(assignment.userId, userId), eq(assignment.id, held.id));
  if (held.battleId !== battle.id) {
    await tx.delete(assignment).where(byId);
    return undefined;
  }
  if (!atHorizon(held.positioningId)) return held.positioningId;
  const other = held.positioningId === battle.championId ? battle.challengerId : battle.championId;
  await tx.update(assignment).set({ positioningId: other }).where(byId);
  return other;
}

/**
 * Where a Contact Prospecting at a Stage stands with the open Battle there (CONTEXT.md, Trial), that
 * Battle locked: no Battle open; no Trial possible, and why; or a Trial possible, with the Assignment
 * it already has.
 */
async function trialSituation(tx: Transaction, contactAtStage: ContactAtStage) {
  const { userId, contactId, stageId } = contactAtStage;
  const battle = await openBattleToAssignAt(tx, userId, stageId);
  if (!battle) return { kind: 'no_battle' } as const;
  const withoutTrial = (reason: WithoutTrialReason) =>
    ({ kind: 'without_trial', reason, battle }) as const;
  const inProgressIn = await trialInProgressOf(tx, userId, contactId);
  if (inProgressIn !== undefined) {
    return withoutTrial(inProgressIn === battle.id ? 'already_tried' : 'trial_in_progress');
  }
  const [tried] = await tx
    .select({ id: trial.id })
    .from(trial)
    .where(and(countedIn(userId, battle.id), eq(trial.contactId, contactId)));
  if (tried) return withoutTrial('already_tried');
  const target = await targetOfContact(tx, userId, contactId);
  if (battle.target !== null && battle.target !== target) return withoutTrial('off_target');
  const started = await trialsIn(tx, userId, battle.id);
  const atHorizon = (positioningId: string) => (started.get(positioningId) ?? 0) >= battle.horizon;
  if (atHorizon(battle.championId) && atHorizon(battle.challengerId))
    return withoutTrial('horizon');
  return {
    kind: 'open',
    battle,
    target,
    atHorizon,
    assignedId: await reservedIn(tx, contactAtStage, battle, atHorizon),
  } as const;
}

/**
 * The load of each Positioning of a Battle among the Contacts of a Target (ADR 0002): its Trials
 * counted, and the Assignments still reserved, the ones no counted Trial took up yet.
 */
async function loadsAmong(tx: Transaction, userId: string, battle: OpenBattle, target: Target) {
  const trials = await trialsIn(tx, userId, battle.id, target);
  const reserved = await tx
    .select({ positioningId: assignment.positioningId, count: sql<number>`count(*)::int` })
    .from(assignment)
    .where(
      and(
        eq(assignment.userId, userId),
        eq(assignment.battleId, battle.id),
        eq(assignment.target, target),
        notExists(
          tx
            .select({ id: trial.id })
            .from(trial)
            .where(and(countedIn(userId, battle.id), eq(trial.contactId, assignment.contactId))),
        ),
      ),
    )
    .groupBy(assignment.positioningId);
  return (positioningId: string) =>
    (trials.get(positioningId) ?? 0) +
    (reserved.find((row) => row.positioningId === positioningId)?.count ?? 0);
}

/**
 * Reveals the Assignment of a Contact Prospecting at a Stage (spec UX §6.1): the one it already has,
 * never chosen again, or one chosen now and reserved; otherwise why its use starts no Trial.
 * `not_in_battle` when the Stage has no open Battle.
 */
export async function revealAssignment(
  tx: Transaction,
  contactAtStage: ContactAtStage,
  { now, random }: { now: Date; random: Random },
) {
  const { userId, contactId } = contactAtStage;
  const situation = await trialSituation(tx, contactAtStage);
  if (situation.kind === 'no_battle') return 'not_in_battle' as const;
  if (situation.kind === 'without_trial') {
    return { battleId: situation.battle.id, assignment: null, withoutTrial: situation.reason };
  }
  const { battle, target, atHorizon } = situation;
  const revealed = (positioningId: string) => ({
    battleId: battle.id,
    assignment: { battleId: battle.id, positioningId },
    withoutTrial: null,
  });
  if (situation.assignedId !== undefined) return revealed(situation.assignedId);
  const load = await loadsAmong(tx, userId, battle, target);
  const chosen = chooseAssignment(
    [battle.championId, battle.challengerId].map((positioningId) => ({
      positioningId,
      load: load(positioningId),
      atHorizon: atHorizon(positioningId),
    })),
    (count) => random.int(0, count),
  );
  // Both at the Horizon was told above.
  if (chosen === undefined) throw new Error('No Positioning to assign');
  await tx.insert(assignment).values({
    userId,
    contactId,
    battleId: battle.id,
    positioningId: chosen,
    target,
    assignedAt: now,
  });
  return revealed(chosen);
}

/**
 * The Trial the use of a Positioning starts for a Contact Prospecting at a Stage (CONTEXT.md, Trial),
 * if any: in its open Battle, one of its two Positionings, below the Horizon, the Contact in its
 * Target and without a Trial there yet. Refused while it has a Trial in progress elsewhere, to settle
 * first, and before its Assignment is revealed: what to send is assigned before it is sent (ADR 0002).
 */
export async function trialToStart(
  tx: Transaction,
  contactAtStage: ContactAtStage,
  positioningId: string,
) {
  const situation = await trialSituation(tx, contactAtStage);
  if (situation.kind === 'no_battle') return undefined;
  if (situation.kind === 'without_trial') {
    return situation.reason === 'trial_in_progress' ? refusal('trial_in_progress') : undefined;
  }
  const { battle, target, atHorizon, assignedId } = situation;
  if (positioningId !== battle.championId && positioningId !== battle.challengerId)
    return undefined;
  if (assignedId === undefined) return refusal('assignment_required');
  if (atHorizon(positioningId)) return undefined;
  return { battleId: battle.id, target, overridden: positioningId !== assignedId };
}

/** Starts a Trial with the use that recorded it; the id of the Trial. */
export async function startTrial(
  tx: Transaction,
  started: {
    userId: string;
    contactId: string;
    battleId: string;
    positioningId: string;
    interactionId: string;
    target: Target;
    overridden: boolean;
    overrideReason: string | null;
  },
) {
  const [inserted] = await tx
    .insert(trial)
    .values({ ...started, outcome: 'in_progress' })
    .returning({ id: trial.id });
  if (!inserted) throw new Error('A Trial was not started');
  return inserted.id;
}

/** A Trial removed, as “Undo” takes its use back (ADR 0011): its Assignment stays. */
export async function removeTrial(tx: Transaction, userId: string, trialId: string) {
  await tx.delete(trial).where(and(eq(trial.userId, userId), eq(trial.id, trialId)));
}

/** Whether a Contact has a Trial in progress: it must be settled before leaving Prospecting. */
export const hasTrialInProgress = async (tx: Transaction, userId: string, contactId: string) =>
  (await trialInProgressOf(tx, userId, contactId)) !== undefined;

/** A Trial a gesture settled, as it keeps it to put it back in progress with “Undo”. */
export const settledTrial = z.object({ id: z.uuid(), battleId: z.uuid() });

/**
 * Settles the Trial in progress of a Contact (CONTEXT.md, Trial): a Success or No result, a data
 * point of its Battle, or canceled with its reason, which is not counted. The Trial settled, if the
 * Contact had one in progress.
 */
export async function settleTrial(
  tx: Transaction,
  userId: string,
  contactId: string,
  { outcome, cancelReason }: { outcome: SettledTrialOutcome; cancelReason?: string | undefined },
  now: Date,
): Promise<z.infer<typeof settledTrial> | undefined> {
  // Its Battle shared first, as a change of outcome takes it: a closing waits, or ran first and
  // canceled the Trial, which is then no longer in progress (CONTEXT.md, Trial).
  const battleId = await trialInProgressOf(tx, userId, contactId);
  if (battleId !== undefined) await isBattleOpen(tx, userId, battleId);
  const [settled] = await tx
    .update(trial)
    .set({
      outcome,
      cancelReason: outcome === 'canceled' ? (cancelReason ?? null) : null,
      settledAt: now,
    })
    .where(inProgressOf(userId, contactId))
    .returning({ id: trial.id, battleId: trial.battleId });
  return settled;
}

/**
 * Puts a Trial settled back in progress, as “Undo” takes back the gesture that settled it (ADR 0011):
 * no other Trial of the Contact started since, which only a later gesture on it could do.
 */
export const unsettleTrial = (tx: Transaction, userId: string, trialId: string) =>
  tx
    .update(trial)
    .set({ outcome: 'in_progress', cancelReason: null, settledAt: null })
    .where(and(eq(trial.userId, userId), eq(trial.id, trialId)));

/**
 * Traces a deviation from the Cadence on the Trial in progress of a Contact (ST-34): its id, or none
 * without a Trial in progress.
 */
export async function traceDeviation(
  tx: Transaction,
  userId: string,
  contactId: string,
  kind: TrialDeviationKind,
  now: Date,
) {
  const [inProgress] = await tx
    .select({ id: trial.id })
    .from(trial)
    .where(inProgressOf(userId, contactId));
  if (!inProgress) return undefined;
  const [traced] = await tx
    .insert(trialDeviation)
    .values({ userId, trialId: inProgress.id, kind, recordedAt: now })
    .returning({ id: trialDeviation.id });
  return traced?.id;
}

/** A deviation traced by a gesture “Undo” takes back. */
export async function removeDeviation(tx: Transaction, userId: string, deviationId: string) {
  await tx
    .delete(trialDeviation)
    .where(and(eq(trialDeviation.userId, userId), eq(trialDeviation.id, deviationId)));
}

/** An Assignment as a gesture that dropped it keeps it, to bring it back with “Undo”. */
export const droppedAssignment = z.object({
  battleId: z.uuid(),
  positioningId: z.uuid(),
  target: z.enum(TARGETS),
  assignedAt: z.iso.datetime(),
});

/**
 * Drops the Assignment of a Contact (ADR 0002): it falls when the Contact leaves Prospecting or its
 * Stage, and frees its place in the balance. What it was, for “Undo”.
 */
export async function dropAssignment(
  tx: Transaction,
  userId: string,
  contactId: string,
): Promise<z.infer<typeof droppedAssignment> | undefined> {
  const [dropped] = await tx
    .delete(assignment)
    .where(and(eq(assignment.userId, userId), eq(assignment.contactId, contactId)))
    .returning({
      battleId: assignment.battleId,
      positioningId: assignment.positioningId,
      target: assignment.target,
      assignedAt: assignment.assignedAt,
    });
  return dropped && { ...dropped, assignedAt: dropped.assignedAt.toISOString() };
}

/**
 * Brings back an Assignment “Undo” restores with its Contact, never chosen again (ADR 0011), as long
 * as its Battle is still open.
 */
export async function restoreAssignment(
  tx: Transaction,
  { userId, contactId, stageId }: ContactAtStage,
  dropped: z.infer<typeof droppedAssignment>,
) {
  const battle = await openBattleToAssignAt(tx, userId, stageId);
  if (battle?.id !== dropped.battleId) return;
  await tx
    .insert(assignment)
    .values({ userId, contactId, ...dropped, assignedAt: new Date(dropped.assignedAt) });
}

/** Whether a Contact has an Assignment: revealed since a gesture, it closes the way back before it. */
export async function hasAssignment(tx: Transaction, userId: string, contactId: string) {
  const [found] = await tx
    .select({ id: assignment.id })
    .from(assignment)
    .where(and(eq(assignment.userId, userId), eq(assignment.contactId, contactId)));
  return found !== undefined;
}

/** Whether a Battle assigned anything: its opening can no longer be taken back. */
export async function anyAssignmentIn(tx: Transaction, userId: string, battleId: string) {
  const [found] = await tx
    .select({ id: assignment.id })
    .from(assignment)
    .where(and(eq(assignment.userId, userId), eq(assignment.battleId, battleId)))
    .limit(1);
  return found !== undefined;
}

/** Whether a Positioning served in a Trial: frozen from the first (CONTEXT.md, Positioning). */
export async function anyTrialWith(tx: Transaction, userId: string, positioningId: string) {
  const [found] = await tx
    .select({ id: trial.id })
    .from(trial)
    .where(and(eq(trial.userId, userId), eq(trial.positioningId, positioningId)))
    .limit(1);
  return found !== undefined;
}

/** The Contact of a Trial a route names, `undefined` when the User has no such Trial. */
export async function contactOfTrial(tx: Transaction, userId: string, trialId: string) {
  const [found] = await tx
    .select({ contactId: trial.contactId })
    .from(trial)
    .where(and(eq(trial.userId, userId), eq(trial.id, trialId)));
  return found?.contactId;
}

/** The outcome of a Trial as a change keeps it, to put it back with “Undo”. */
export const trialOutcomeOf = z.object({
  outcome: z.enum(TRIAL_OUTCOMES),
  cancelReason: z.string().nullable(),
  settledAt: z.iso.datetime().nullable(),
});

/** Writes the outcome of a Trial, as a change or its “Undo” leaves it. */
const writeOutcome = (
  tx: Transaction,
  userId: string,
  trialId: string,
  { outcome, cancelReason, settledAt }: z.infer<typeof trialOutcomeOf>,
) =>
  tx
    .update(trial)
    .set({ outcome, cancelReason, settledAt: settledAt === null ? null : new Date(settledAt) })
    .where(and(eq(trial.userId, userId), eq(trial.id, trialId)));

/**
 * Changes the outcome of a Trial while its Battle is open (CONTEXT.md, Trial), its Contact locked:
 * back in progress only for a Contact Prospecting without another Trial in progress; counted again
 * only while its Contact has no other Trial counted in the Battle. What it was, for “Undo”.
 */
export async function changeTrialOutcome(
  tx: Transaction,
  { userId, contactId, trialId }: { userId: string; contactId: string; trialId: string },
  {
    outcome,
    cancelReason,
    isProspecting,
  }: { outcome: TrialOutcome; cancelReason?: string | undefined; isProspecting: boolean },
  now: Date,
) {
  const byId = and(eq(trial.userId, userId), eq(trial.id, trialId));
  // The Battle first, then the Trial: the order a closing takes them in. A Trial never changes Battle.
  const [inBattle] = await tx.select({ battleId: trial.battleId }).from(trial).where(byId);
  if (!inBattle) return refusal('not_found');
  if (!(await isBattleOpen(tx, userId, inBattle.battleId))) return refusal('battle_closed');
  const [found] = await tx
    .select({
      battleId: trial.battleId,
      outcome: trial.outcome,
      cancelReason: trial.cancelReason,
      settledAt: trial.settledAt,
    })
    .from(trial)
    .where(byId)
    .for('update');
  if (!found) return refusal('not_found');
  if (found.outcome === outcome) return refusal('same_outcome');
  if (outcome === 'in_progress') {
    if (!isProspecting) return refusal('not_prospecting');
    if (await hasTrialInProgress(tx, userId, contactId)) return refusal('trial_in_progress');
  }
  if (found.outcome === 'canceled') {
    const [counted] = await tx
      .select({ id: trial.id })
      .from(trial)
      .where(and(countedIn(userId, found.battleId), eq(trial.contactId, contactId)));
    if (counted) return refusal('already_tried');
  }
  await writeOutcome(tx, userId, trialId, {
    outcome,
    cancelReason: outcome === 'canceled' ? (cancelReason ?? null) : null,
    settledAt: outcome === 'in_progress' ? null : now.toISOString(),
  });
  return {
    battleId: found.battleId,
    was: {
      outcome: found.outcome,
      cancelReason: found.cancelReason,
      settledAt: found.settledAt?.toISOString() ?? null,
    },
  };
}

/**
 * Puts the outcome of a Trial back as it was, as “Undo” takes its change back: only while its Battle
 * is open, whose closing settled its Trials for good. Whether it was put back.
 */
export async function restoreTrialOutcome(
  tx: Transaction,
  { userId, battleId, trialId }: { userId: string; battleId: string; trialId: string },
  was: z.infer<typeof trialOutcomeOf>,
) {
  if (!(await isBattleOpen(tx, userId, battleId))) return false;
  await writeOutcome(tx, userId, trialId, was);
  return true;
}

/** The Trials of a Battle per Positioning, the canceled ones aside: what the Win rule reads (ADR 0001). */
export async function trialCountsIn(
  tx: Transaction,
  userId: string,
  battle: { id: string; championId: string; challengerId: string },
): Promise<WinRuleCounts> {
  const rows = await tx
    .select({
      positioningId: trial.positioningId,
      outcome: trial.outcome,
      count: sql<number>`count(*)::int`,
    })
    .from(trial)
    .where(countedIn(userId, battle.id))
    .groupBy(trial.positioningId, trial.outcome);
  const countsOf = (positioningId: string): TrialCounts => {
    const count = (outcome: TrialOutcome) =>
      rows.find((row) => row.positioningId === positioningId && row.outcome === outcome)?.count ??
      0;
    return {
      successes: count('success'),
      noResults: count('no_result'),
      inProgress: count('in_progress'),
    };
  };
  return { champion: countsOf(battle.championId), challenger: countsOf(battle.challengerId) };
}

/**
 * What closing a Battle does to its Contacts (CONTEXT.md, Trial), its row locked by the closing: its
 * Trials still in progress canceled, “Battle closed” in the language of the User, their Follow-ups
 * untouched; its Assignments dropped (ADR 0002). The Contacts it touched.
 */
export async function closeTrialsOf(tx: Transaction, userId: string, battleId: string, now: Date) {
  const { locale } = await settingsOf(tx, userId, now);
  const canceled = await tx
    .update(trial)
    .set({
      outcome: 'canceled',
      cancelReason: m.trial_cancel_reason_battle_closed({}, { locale }),
      settledAt: now,
    })
    .where(
      and(eq(trial.userId, userId), eq(trial.battleId, battleId), eq(trial.outcome, 'in_progress')),
    )
    .returning({ contactId: trial.contactId });
  const dropped = await tx
    .delete(assignment)
    .where(and(eq(assignment.userId, userId), eq(assignment.battleId, battleId)))
    .returning({ contactId: assignment.contactId });
  return [...new Set([...canceled, ...dropped].map(({ contactId }) => contactId))];
}

/**
 * Whether “Undo” may still put back a Trial of a Battle: only while it is open, whose closing settled
 * its Trials for good (CONTEXT.md, Trial). Always, without a Trial.
 */
export const canUndoTrialIn = async (
  tx: Transaction,
  userId: string,
  battleId: string | undefined,
) => battleId === undefined || isBattleOpen(tx, userId, battleId);
