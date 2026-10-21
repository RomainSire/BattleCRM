import {
  BATTLE_HORIZON_MAX,
  BATTLE_MINIMUM_FINISHED,
  BATTLE_THRESHOLDS,
  SUCCESS_CRITERION_MAX_LENGTH,
  TARGETS,
} from '@battlecrm/contract';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { RequireUser } from '../auth/index.ts';
import type { Clock } from '../clock.ts';
import type { Transaction } from '../db/index.ts';
import {
  opponentsAt,
  setArchivedAt,
  stageToOpenBattleAt,
  type PositioningBattles,
} from '../funnel/index.ts';
import { createCircuit, touched, type ChangesOf, type Creation } from '../gestures/index.ts';
import { jsonBody } from '../json-body.ts';
import { refusal } from '../refusals.ts';
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
 * The Champion of a Stage (CONTEXT.md): the one its last Battle opposed to a Challenger, the initial
 * Champion before the second; `undefined` before its first Battle. The Verdict (ticket 32) makes the
 * winner of a closed Battle the Champion.
 */
async function championAt(tx: Transaction, userId: string, stageId: string) {
  const [last] = await tx
    .select({ championId: battle.championId })
    .from(battle)
    .where(and(eq(battle.userId, userId), eq(battle.stageId, stageId)))
    .orderBy(desc(battle.openedAt), desc(battle.id))
    .limit(1);
  return last?.championId;
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
const openBattle: Creation<
  'battle_opened',
  z.infer<typeof openRequest>,
  z.infer<typeof battleOpened>,
  'unknown_stage' | 'unknown_positioning' | 'battle_open' | 'champion_required' | 'champion_set'
> = {
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
  /** The Battle leaves no trace, and what it brought back is archived again. Trials come with ticket 28. */
  async inverse(tx, { userId, subjectId: battleId, retained: { broughtBack } }) {
    await tx.delete(battle).where(byId(userId, battleId));
    for (const { id, archivedAt } of broughtBack) {
      await setArchivedAt(tx, userId, id, new Date(archivedAt));
    }
    return touched({
      removedBattleIds: [battleId],
      positioningIds: broughtBack.map(({ id }) => id),
    });
  },
};

/**
 * The gestures on Battles (spec UX §6.9): open one, with “Undo”. Closing one, its Verdict and the
 * Champion history come with ticket 32.
 */
export function createBattles<Changes>({
  clock,
  requireUser,
  changesOf,
}: {
  clock: Clock;
  requireUser: RequireUser;
  changesOf: ChangesOf<Changes>;
}) {
  const { create } = createCircuit({ clock, changesOf });
  const routes = new Hono<AppEnv>().post('/battles', requireUser, jsonBody(openRequest), (c) =>
    create(c, openBattle, c.req.valid('json')),
  );
  return { routes, gestures: [openBattle] as const };
}
