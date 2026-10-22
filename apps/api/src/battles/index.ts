import {
  BATTLE_HORIZON_MAX,
  BATTLE_MINIMUM_FINISHED,
  BATTLE_THRESHOLDS,
  SUCCESS_CRITERION_MAX_LENGTH,
  TAKEAWAY_MAX_LENGTH,
  TARGETS,
  VERDICTS,
} from '@battlecrm/contract';
import {
  archivedBy,
  evaluateWinRule,
  judgeVerdict,
  titleHolderAfter,
  type Verdict,
  type WinRuleCounts,
} from '@battlecrm/domain';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { RequireUser } from '../auth/index.ts';
import type { Clock } from '../clock.ts';
import { withUser, type Transaction } from '../db/index.ts';
import {
  opponentsAt,
  setArchivedAt,
  stageToOpenBattleAt,
  type PositioningBattles,
} from '../funnel/index.ts';
import {
  createCircuit,
  lockSubject,
  touched,
  type ChangesOf,
  type Creation,
  type Gesture,
  type GestureSubject,
} from '../gestures/index.ts';
import { jsonBody } from '../json-body.ts';
import { answerRefusal, refusal } from '../refusals.ts';
import { idOf } from '../route-id.ts';
import { localDateOf } from '../settings/index.ts';
import { battle } from './tables.ts';

// Read by `views`, which never writes it.
export { battle } from './tables.ts';

/** What the wizard sends to open a Battle (spec UX §6.9). */
const openRequest = z
  .object({
    stageId: z.uuid(),
    /** The initial Champion, before the first Battle of the Stage; left out once it has one. */
    championId: z.uuid().optional(),
    challengerId: z.uuid(),
    successCriterion: z.string().trim().min(1).max(SUCCESS_CRITERION_MAX_LENGTH),
    /** The one Target it is restricted to, `null` for all. */
    target: z.enum(TARGETS).nullable(),
    threshold: z.union(BATTLE_THRESHOLDS.map((threshold) => z.literal(threshold))),
    // Never below the minimum of finished Trials, which is not settable (ADR 0001).
    horizon: z.int().min(BATTLE_MINIMUM_FINISHED).max(BATTLE_HORIZON_MAX),
  })
  .refine(({ championId, challengerId }) => championId !== challengerId);

/** What an opening retains: the archived Positionings it brought back, and since when they were. */
const battleOpened = z.object({
  broughtBack: z.array(z.object({ id: z.uuid(), archivedAt: z.iso.datetime() })),
});

const byId = (userId: string, battleId: string) =>
  and(eq(battle.userId, userId), eq(battle.id, battleId));

/** The open Battle of a Stage, if it has one. */
async function openBattleAt(tx: Transaction, userId: string, stageId: string) {
  const [found] = await tx
    .select({ id: battle.id })
    .from(battle)
    .where(and(eq(battle.userId, userId), eq(battle.stageId, stageId), isNull(battle.closedAt)));
  return found;
}

/**
 * The open Battle of a Stage as an Assignment or a Trial reads it (spec stack §5.3), its row locked
 * until the transaction ends: the Assignments and Trials of a Battle are counted one at a time.
 * `undefined` when the Stage has none open.
 */
export async function openBattleToAssignAt(tx: Transaction, userId: string, stageId: string) {
  const [found] = await tx
    .select({
      id: battle.id,
      championId: battle.championId,
      challengerId: battle.challengerId,
      target: battle.target,
      horizon: battle.horizon,
    })
    .from(battle)
    .where(and(eq(battle.userId, userId), eq(battle.stageId, stageId), isNull(battle.closedAt)))
    .for('update');
  return found;
}

/**
 * Whether a Battle is open, its row shared until the transaction ends: its closing waits for a change
 * of outcome of one of its Trials under way (CONTEXT.md, Trial).
 */
export async function isBattleOpen(tx: Transaction, userId: string, battleId: string) {
  const [found] = await tx
    .select({ open: isNull(battle.closedAt).mapWith(Boolean) })
    .from(battle)
    .where(byId(userId, battleId))
    .for('share');
  return found?.open === true;
}

/**
 * What a Battle did with its Contacts (ADR 0002): `prospecting` keeps the Assignments and Trials, and
 * answers, handed by the composition root as `funnel` gets `PositioningUses`.
 */
export type BattleAssignments = {
  /** Whether it assigned anything: its opening can no longer be taken back. */
  any: (tx: Transaction, userId: string, battleId: string) => Promise<boolean>;
  /** Its Trials per Positioning, the canceled ones aside: what the Win rule reads. */
  counts: (
    tx: Transaction,
    userId: string,
    battle: { id: string; championId: string; challengerId: string },
  ) => Promise<WinRuleCounts>;
  /**
   * What its closing does to its Contacts (CONTEXT.md, Trial): its Trials still in progress canceled,
   * “Battle closed”, their Follow-ups untouched; its Assignments dropped. The Contacts it touched.
   */
  close: (tx: Transaction, userId: string, battleId: string, now: Date) => Promise<string[]>;
};

/** The side that holds the title of a Battle: its Champion while open, the winner of its Verdict once closed. */
const titleHolderOf = (held: {
  championId: string;
  challengerId: string;
  verdict: Verdict | null;
}) =>
  held.verdict !== null && titleHolderAfter(held.verdict) === 'challenger'
    ? held.challengerId
    : held.championId;

/**
 * The Champion of a Stage (CONTEXT.md): the winner of its last Battle, or the Champion it defends
 * while open, the initial Champion before the second; `undefined` before its first Battle.
 */
async function championAt(tx: Transaction, userId: string, stageId: string) {
  const [last] = await tx
    .select({
      championId: battle.championId,
      challengerId: battle.challengerId,
      verdict: battle.verdict,
    })
    .from(battle)
    .where(and(eq(battle.userId, userId), eq(battle.stageId, stageId)))
    .orderBy(desc(battle.openedAt), desc(battle.id))
    .limit(1);
  return last && titleHolderOf(last);
}

/**
 * Where a Positioning stands in the Battles (spec UX §5.6), for the workshop: archiving it, deleting
 * it or taking back its creation reads it, its row locked.
 */
export const positioningBattles: PositioningBattles = {
  async standing(tx, userId, positioningId) {
    const battles = await tx
      .select({ stageId: battle.stageId, open: isNull(battle.closedAt).mapWith(Boolean) })
      .from(battle)
      .where(
        and(
          eq(battle.userId, userId),
          or(eq(battle.championId, positioningId), eq(battle.challengerId, positioningId)),
        ),
      );
    const [any] = battles;
    if (!any) return undefined;
    if ((await championAt(tx, userId, any.stageId)) === positioningId) return 'champion';
    return battles.some(({ open }) => open) ? 'in_open_battle' : 'in_battle';
  },
};

/**
 * Open a Battle at a Stage (spec UX §6.9): its Champion, or the initial Champion the User designates
 * before the first, against a Challenger of the same Stage, archived ones included (it comes back).
 * At most one open per Stage, the Stage locked meanwhile.
 */
const openBattle = (
  assignments: BattleAssignments,
): Creation<
  'battle_opened',
  z.infer<typeof openRequest>,
  z.infer<typeof battleOpened>,
  'unknown_stage' | 'unknown_positioning' | 'battle_open' | 'champion_required' | 'champion_set'
> => ({
  kind: 'battle_opened',
  subject: { column: 'battleId' },
  async write({ tx, userId, input, now }) {
    const { stageId, challengerId } = input;
    if (!(await stageToOpenBattleAt(tx, userId, stageId))) return refusal('unknown_stage');
    // The Stage locked: no other opening there may come in between, and the partial unique index holds.
    if (await openBattleAt(tx, userId, stageId)) return refusal('battle_open');
    // The Champion of the Stage, or before its first Battle, the initial Champion the User designates.
    const championId = (await championAt(tx, userId, stageId)) ?? input.championId;
    if (championId === undefined) return refusal('champion_required');
    if (input.championId !== undefined && input.championId !== championId) {
      return refusal('champion_set');
    }
    if (championId === challengerId) return refusal('unknown_positioning');
    const opponents = await opponentsAt(tx, userId, stageId, [championId, challengerId]);
    if (opponents.length !== 2) return refusal('unknown_positioning');
    const broughtBack = opponents.flatMap(({ id, archivedAt }) =>
      archivedAt === null ? [] : [{ id, archivedAt: archivedAt.toISOString() }],
    );
    for (const { id } of broughtBack) await setArchivedAt(tx, userId, id, null);
    const [opened] = await tx
      .insert(battle)
      .values({
        userId,
        stageId,
        championId,
        challengerId,
        successCriterion: input.successCriterion,
        target: input.target,
        threshold: input.threshold,
        horizon: input.horizon,
        openedAt: now,
        openedOn: await localDateOf(tx, userId, now),
      })
      .returning({ id: battle.id });
    if (!opened) throw new Error('A Battle was not opened');
    return {
      subjectId: opened.id,
      retained: { broughtBack },
      touched: touched({
        battleIds: [opened.id],
        positioningIds: broughtBack.map(({ id }) => id),
      }),
    };
  },
  retained: battleOpened,
  /**
   * The Battle leaves no trace, and what it brought back is archived again. Refused once it assigned
   * a Positioning to a Contact: the Assignment survives “Undo” (ADR 0011), and the Battle with it.
   */
  async inverse(tx, { userId, subjectId: battleId, retained: { broughtBack } }) {
    // Its row locked first: an Assignment under way, which locks it, is then written and seen.
    const [opened] = await tx
      .select({ open: isNull(battle.closedAt).mapWith(Boolean) })
      .from(battle)
      .where(byId(userId, battleId))
      .for('update');
    // Closed since, it holds a Verdict that is never taken back (spec UX §1).
    if (opened?.open !== true) return 'superseded';
    if (await assignments.any(tx, userId, battleId)) return 'superseded';
    await tx.delete(battle).where(byId(userId, battleId));
    for (const { id, archivedAt } of broughtBack) {
      await setArchivedAt(tx, userId, id, new Date(archivedAt));
    }
    return touched({
      removedBattleIds: [battleId],
      positioningIds: broughtBack.map(({ id }) => id),
    });
  },
});

/** What the closing window sends (spec UX §6.9): the Verdict, the designation acknowledged, the Takeaway. */
const closeRequest = z.object({
  verdict: z.enum(VERDICTS),
  /** “I designate this winner anyway”, checked after the warning (ADR 0001). */
  designate: z.boolean().optional(),
  takeaway: z.string().trim().max(TAKEAWAY_MAX_LENGTH).optional(),
});

/**
 * Closes an open Battle on its Verdict (spec UX §6.9, ADR 0001), confirmed rather than undone: the Win
 * rule judges the Verdict, a winner it does not satisfy is designated by the User, who acknowledged it.
 * The Champion of the Stage follows from it, the one beaten is archived (not in an abandoned Battle),
 * its Trials still in progress are canceled and its Assignments dropped, all at once. Its row locked
 * first, then its Trials: the order a change of outcome takes them in.
 */
async function closeBattle(
  tx: Transaction,
  { userId, battleId, now }: { userId: string; battleId: string; now: Date },
  { verdict, designate, takeaway }: z.infer<typeof closeRequest>,
  assignments: BattleAssignments,
) {
  await lockSubject(tx, battleId);
  const [found] = await tx
    .select({
      id: battle.id,
      stageId: battle.stageId,
      championId: battle.championId,
      challengerId: battle.challengerId,
      threshold: battle.threshold,
      horizon: battle.horizon,
      open: isNull(battle.closedAt).mapWith(Boolean),
    })
    .from(battle)
    .where(byId(userId, battleId))
    .for('update');
  if (!found) return refusal('not_found');
  if (!found.open) return refusal('battle_closed');
  const counts: WinRuleCounts = await assignments.counts(tx, userId, found);
  const judged = judgeVerdict(evaluateWinRule(counts, found.threshold, found.horizon), verdict);
  if (!judged) return refusal('verdict_unsupported');
  if (judged.designated && designate !== true) return refusal('designation_required');
  const beaten = archivedBy(verdict);
  // Their rows locked: archiving one by hand meanwhile waits, and sees the Battle closed.
  await opponentsAt(tx, userId, found.stageId, [found.championId, found.challengerId]);
  if (beaten) {
    await setArchivedAt(
      tx,
      userId,
      beaten === 'champion' ? found.championId : found.challengerId,
      now,
    );
  }
  const contactIds = await assignments.close(tx, userId, battleId, now);
  await tx
    .update(battle)
    .set({
      closedAt: now,
      closedOn: await localDateOf(tx, userId, now),
      verdict,
      designated: judged.designated,
      takeaway: takeaway || null,
    })
    .where(byId(userId, battleId));
  return touched({
    battleIds: [battleId],
    positioningIds: [found.championId, found.challengerId],
    contactIds,
  });
}

/** A Battle as its gestures after opening read it: whether it is still open, and its Takeaway. */
const battleSubject: GestureSubject<{ open: boolean; takeaway: string | null }> = {
  column: 'battleId',
  async load(tx, userId, battleId) {
    const [found] = await tx
      .select({ open: isNull(battle.closedAt).mapWith(Boolean), takeaway: battle.takeaway })
      .from(battle)
      .where(byId(userId, battleId));
    return found;
  },
};

/** The Takeaway as an edit leaves it: emptied, there is none. */
const takeawayRequest = z.object({ takeaway: z.string().trim().max(TAKEAWAY_MAX_LENGTH) });

/** What an edit of the Takeaway retains: the one it replaced. */
const takeawayChanged = z.object({ was: z.string().nullable() });

const setTakeaway = (tx: Transaction, userId: string, battleId: string, takeaway: string | null) =>
  tx.update(battle).set({ takeaway }).where(byId(userId, battleId));

/** Edits the Takeaway of a closed Battle (CONTEXT.md, Takeaway), with “Undo”; an open one has none yet. */
const changeTakeaway: Gesture<
  'battle_takeaway_changed',
  { open: boolean; takeaway: string | null },
  z.infer<typeof takeawayRequest>,
  z.infer<typeof takeawayChanged>,
  'battle_open'
> = {
  kind: 'battle_takeaway_changed',
  subject: battleSubject,
  async refuse({ subject }) {
    return subject.open ? refusal('battle_open') : undefined;
  },
  async write({ tx, userId, subjectId, subject, input }) {
    await setTakeaway(tx, userId, subjectId, input.takeaway || null);
    return { retained: { was: subject.takeaway }, touched: touched({ battleIds: [subjectId] }) };
  },
  retained: takeawayChanged,
  async inverse(tx, { userId, subjectId, retained }) {
    await setTakeaway(tx, userId, subjectId, retained.was);
    return touched({ battleIds: [subjectId] });
  },
};

/**
 * The gestures on Battles (spec UX §6.9): open one, with “Undo”; close it on its Verdict, confirmed;
 * edit its Takeaway since, with “Undo”.
 */
export function createBattles<Changes>({
  clock,
  requireUser,
  changesOf,
  assignments,
}: {
  clock: Clock;
  requireUser: RequireUser;
  changesOf: ChangesOf<Changes>;
  assignments: BattleAssignments;
}) {
  const { create, perform } = createCircuit({ clock, changesOf });
  const opened = openBattle(assignments);
  const routes = new Hono<AppEnv>()
    .post('/battles', requireUser, jsonBody(openRequest), (c) =>
      create(c, opened, c.req.valid('json')),
    )
    .post('/battles/:id/close', requireUser, jsonBody(closeRequest), async (c) => {
      const { userId } = c.var;
      const battleId = idOf(c.req.param('id'));
      // Another User's Battle, an unknown one and an id that is none answer alike.
      if (battleId === null) return answerRefusal(c, refusal('not_found'));
      const outcome = await withUser(userId, async (tx) => {
        const closed = await closeBattle(
          tx,
          { userId, battleId, now: clock.now() },
          c.req.valid('json'),
          assignments,
        );
        if ('error' in closed) return closed;
        return { changes: await changesOf(tx, userId, closed) };
      });
      if ('error' in outcome) return answerRefusal(c, outcome);
      return c.json(outcome, 200);
    })
    .post('/battles/:id/takeaway', requireUser, jsonBody(takeawayRequest), (c) =>
      perform(c, changeTakeaway, c.req.valid('json')),
    );
  return { routes, gestures: [opened, changeTakeaway] as const };
}
