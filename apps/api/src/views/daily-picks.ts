import { hasNoNextStep, pickAtRandom } from '@battlecrm/domain';
import { and, asc, eq, exists, inArray, isNull, lt, notInArray, sql } from 'drizzle-orm';

import { battle } from '../battles/index.ts';
import type { Transaction } from '../db/index.ts';
import { positioning } from '../funnel/index.ts';
import { contact, followUp, trial } from '../prospecting/index.ts';
import type { Random } from '../random.ts';
import { battlePostponement, dailyPick, type DailyPickKind } from './tables.ts';

/** How many Contacts Today proposes of each kind (spec UX §5.1: “3 or 4”). */
const PICKS_PER_DAY = 3;

/** What Today picked for a local day (spec UX §5.1, ST-47). */
export type DailyPicks = {
  day: string;
  /**
   * The Contacts of the Pool proposed for a Funnel entry, still in the Pool and not passed, in the
   * order picked.
   */
  entries: string[];
  /** The Contacts with No next step picked that day, in the order picked, handled ones too. */
  noNextStep: string[];
  /** The conclusive Battles put off that day, “Later”. */
  postponedBattleIds: string[];
};

/**
 * The Contacts Prospecting with No next step (CONTEXT.md), the earliest first: what tells them is
 * selected here, the rule is the one the SPA reads (`hasNoNextStep`, ADR 0012).
 */
async function noNextStepContacts(tx: Transaction, userId: string): Promise<string[]> {
  const rows = await tx
    .select({
      id: contact.id,
      hasFollowUp: exists(
        tx
          .select({ one: sql`1` })
          .from(followUp)
          .where(
            and(
              eq(followUp.userId, userId),
              eq(followUp.contactId, contact.id),
              eq(followUp.status, 'scheduled'),
            ),
          ),
      ).mapWith(Boolean),
      hasTrialInProgress: exists(
        tx
          .select({ one: sql`1` })
          .from(trial)
          .where(
            and(
              eq(trial.userId, userId),
              eq(trial.contactId, contact.id),
              eq(trial.outcome, 'in_progress'),
            ),
          ),
      ).mapWith(Boolean),
      stageHasPositioning: exists(
        tx
          .select({ one: sql`1` })
          .from(positioning)
          .where(
            and(
              eq(positioning.userId, userId),
              eq(positioning.stageId, contact.stageId),
              isNull(positioning.archivedAt),
            ),
          ),
      ).mapWith(Boolean),
    })
    .from(contact)
    .where(and(eq(contact.userId, userId), eq(contact.status, 'prospecting')))
    .orderBy(asc(contact.id));
  return rows.filter((row) => hasNoNextStep(row)).map(({ id }) => id);
}

/** The picks of a kind on a day, in the order picked, with the Status of each Contact. */
function picksOn(tx: Transaction, userId: string, day: string, kind: DailyPickKind) {
  return tx
    .select({
      contactId: dailyPick.contactId,
      rank: dailyPick.rank,
      passed: dailyPick.passed,
      status: contact.status,
    })
    .from(dailyPick)
    .innerJoin(contact, and(eq(contact.userId, userId), eq(contact.id, dailyPick.contactId)))
    .where(
      and(eq(dailyPick.userId, userId), eq(dailyPick.localDate, day), eq(dailyPick.kind, kind)),
    )
    .orderBy(asc(dailyPick.rank));
}

/** The pick of a Contact of a kind on a day. */
const pickOf = (userId: string, day: string, kind: DailyPickKind, contactId: string) =>
  and(
    eq(dailyPick.userId, userId),
    eq(dailyPick.localDate, day),
    eq(dailyPick.kind, kind),
    eq(dailyPick.contactId, contactId),
  );

/** Writes new picks of a kind after the ones of the day. */
async function addPicks(
  tx: Transaction,
  userId: string,
  day: string,
  kind: DailyPickKind,
  contactIds: string[],
  firstRank: number,
) {
  if (contactIds.length === 0) return;
  await tx.insert(dailyPick).values(
    contactIds.map((contactId, index) => ({
      userId,
      localDate: day,
      kind,
      contactId,
      rank: firstRank + index,
    })),
  );
}

/**
 * What Today picked for the User on `day`, picked at the first read of the day (ST-47): the Contacts
 * of the Pool proposed for an entry, one picked to replace each that left the Pool, as long as it
 * has more; the Contacts with No next step, picked once, never replaced; and the Battles put off.
 * The picks of the days before are dropped.
 */
export async function dailyPicksOf(
  tx: Transaction,
  userId: string,
  day: string,
  random: Random,
): Promise<DailyPicks> {
  // Two devices reading at once pick once.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`daily_pick:${userId}`}, 0))`,
  );
  await tx.delete(dailyPick).where(and(eq(dailyPick.userId, userId), lt(dailyPick.localDate, day)));
  await tx
    .delete(battlePostponement)
    .where(and(eq(battlePostponement.userId, userId), lt(battlePostponement.localDate, day)));
  // An integer in [0, count), as `pickAtRandom` asks for.
  const chance = (count: number) => random.int(0, count);

  const entries = await picksOn(tx, userId, day, 'entry');
  const inPool = entries.filter(({ status }) => status === 'pool');
  const entriesInPool = inPool.filter(({ passed }) => !passed).map(({ contactId }) => contactId);
  if (entriesInPool.length < PICKS_PER_DAY) {
    const pickedIds = entries.map(({ contactId }) => contactId);
    const candidates = await tx
      .select({ id: contact.id })
      .from(contact)
      .where(
        and(
          eq(contact.userId, userId),
          eq(contact.status, 'pool'),
          pickedIds.length > 0 ? notInArray(contact.id, pickedIds) : undefined,
        ),
      )
      .orderBy(asc(contact.id));
    const added = pickAtRandom(
      candidates.map(({ id }) => id),
      PICKS_PER_DAY - entriesInPool.length,
      chance,
    );
    let nextRank = (entries.at(-1)?.rank ?? -1) + 1;
    await addPicks(tx, userId, day, 'entry', added, nextRank);
    nextRank += added.length;
    entriesInPool.push(...added);
    // The Pool has no more: the ones passed come back, the first passed first, behind the others.
    const back = inPool
      .filter(({ passed }) => passed)
      .slice(0, PICKS_PER_DAY - entriesInPool.length);
    for (const { contactId } of back) {
      await tx
        .update(dailyPick)
        .set({ passed: false, rank: nextRank })
        .where(pickOf(userId, day, 'entry', contactId));
      nextRank += 1;
      entriesInPool.push(contactId);
    }
  }

  let noNextStep = (await picksOn(tx, userId, day, 'no_next_step')).map(
    ({ contactId }) => contactId,
  );
  if (noNextStep.length === 0) {
    const candidates = await noNextStepContacts(tx, userId);
    noNextStep = pickAtRandom(candidates, PICKS_PER_DAY, chance);
    await addPicks(tx, userId, day, 'no_next_step', noNextStep, 0);
  }

  const postponed = await tx
    .select({ battleId: battlePostponement.battleId })
    .from(battlePostponement)
    .where(and(eq(battlePostponement.userId, userId), eq(battlePostponement.localDate, day)))
    .orderBy(asc(battlePostponement.battleId));

  return {
    day,
    entries: entriesInPool,
    noNextStep,
    postponedBattleIds: postponed.map(({ battleId }) => battleId),
  };
}

/**
 * “Another one” on the Contact of the Pool proposed on a phone (spec UX §5.1): passed for the day on
 * every device, one more of the Pool picked in its place; passed again from a device behind, the
 * same. `false` when it was not picked that day or left the Pool.
 */
export async function passEntry(
  tx: Transaction,
  userId: string,
  contactId: string,
  day: string,
): Promise<boolean> {
  const passed = await tx
    .update(dailyPick)
    .set({ passed: true })
    .where(
      and(
        pickOf(userId, day, 'entry', contactId),
        inArray(
          dailyPick.contactId,
          tx
            .select({ id: contact.id })
            .from(contact)
            .where(and(eq(contact.userId, userId), eq(contact.status, 'pool'))),
        ),
      ),
    )
    .returning({ contactId: dailyPick.contactId });
  return passed.length > 0;
}

/**
 * Puts off an open Battle until the next day, “Later” on Today (spec UX §5.1); `false` when the User
 * has no such open Battle.
 */
export async function postponeBattle(
  tx: Transaction,
  userId: string,
  battleId: string,
  day: string,
): Promise<boolean> {
  const [open] = await tx
    .select({ id: battle.id })
    .from(battle)
    .where(and(eq(battle.userId, userId), eq(battle.id, battleId), isNull(battle.closedAt)));
  if (!open) return false;
  await tx
    .insert(battlePostponement)
    .values({ userId, battleId, localDate: day })
    .onConflictDoNothing();
  return true;
}
