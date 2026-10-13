import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';

import type { Clock } from '../clock.ts';
import type { Config } from '../config.ts';
import { withoutIsolation, type Database, type Transaction } from '../db/index.ts';
import type { SendEmail } from '../email/index.ts';
import type { Random } from '../random.ts';
import { languageAndTimeZoneOf } from '../settings/index.ts';
import { twoFactor, twoFactorRecovery, user } from './tables.ts';
import { hashToken } from './token-hash.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Between the request and the second factor going off: the time left to whoever owns the account to cancel. */
const RECOVERY_DELAY_MS = 7 * DAY_MS;
/** How long before the end the reminder leaves. */
const REMINDER_LEAD_MS = DAY_MS;

type Owner = { id: string; email: string };

/**
 * Whatever recovery a User had under way no longer happens: a real code, a new password or the second
 * factor turned off by hand each show it is not needed, or not wanted.
 */
export const cancelTwoFactorRecovery = (db: Database | Transaction, userId: string) =>
  db.delete(twoFactorRecovery).where(eq(twoFactorRecovery.userId, userId));

export type TwoFactorRecovery = ReturnType<typeof createTwoFactorRecovery>;

/**
 * The home-made recovery of the second factor (spec stack §7, ST-19), for a User who has the password
 * but neither the authenticator app nor a backup code. Nothing is turned off when it is asked for: the
 * address of the account is warned at once, again the day before, and the second factor goes after
 * 7 days unless someone cancels. The delay is the whole protection: whoever stole a password must also
 * keep the owner away from the mailbox for a week.
 */
export function createTwoFactorRecovery({
  config,
  clock,
  random,
  sendEmail,
}: {
  config: Config;
  clock: Clock;
  random: Random;
  sendEmail: SendEmail;
}) {
  // In the fragment: it never reaches a server log.
  const cancelUrl = (token: string) => `${config.appOrigin}/cancel-two-factor-recovery#${token}`;
  // “It wasn't me” leads to a new password, which cancels the recovery.
  const notMeUrl = `${config.appOrigin}/forgot-password`;

  return {
    /**
     * Asked by someone who just gave the right password of `owner` and is awaited at the code: the
     * caller checked both. A recovery already under way keeps its date and sends nothing more.
     */
    async request(owner: Owner): Promise<{ dueAt: Date }> {
      const now = clock.now();
      const token = random.token();
      const dueAt = new Date(now.getTime() + RECOVERY_DELAY_MS);
      const { locale, timeZone } = await languageAndTimeZoneOf(owner.id, now);
      const tokenHash = hashToken(token);
      // One statement: two requests sent together write a single row, and the second reads the first's,
      // which nothing can cancel in between.
      const [recovery] = await withoutIsolation((db) =>
        db
          .insert(twoFactorRecovery)
          .values({ userId: owner.id, tokenHash, requestedAt: now, dueAt })
          .onConflictDoUpdate({
            target: twoFactorRecovery.userId,
            set: { userId: sql`excluded.user_id` },
          })
          .returning({ tokenHash: twoFactorRecovery.tokenHash, dueAt: twoFactorRecovery.dueAt }),
      );
      if (!recovery) throw new Error('The recovery was not written');
      if (recovery.tokenHash !== tokenHash) return { dueAt: recovery.dueAt };
      sendEmail(
        owner.email,
        'two_factor_recovery_started',
        { dueAt, timeZone, cancelUrl: cancelUrl(token), notMeUrl },
        locale,
      );
      return { dueAt };
    },

    /** “Cancel”, in either e-mail: whoever holds the link needs no session. Resolves to whether one ended. */
    async cancelByLink(token: string): Promise<boolean> {
      const tokenHash = hashToken(token);
      const cancelled = await withoutIsolation((db) =>
        db
          .delete(twoFactorRecovery)
          .where(
            or(
              eq(twoFactorRecovery.tokenHash, tokenHash),
              eq(twoFactorRecovery.reminderTokenHash, tokenHash),
            ),
          )
          .returning({ id: twoFactorRecovery.id }),
      );
      return cancelled.length > 0;
    },

    /** Outside a transaction of the caller's. */
    cancel: (userId: string) => withoutIsolation((db) => cancelTwoFactorRecovery(db, userId)),

    /**
     * Scheduled (spec stack §10.6): turns off the second factor of every recovery whose 7 days have
     * passed, and reminds of those that end within a day. Each step is written in its transaction and
     * its e-mail leaves after the commit: a second run finds nothing left to do, and an e-mail that
     * fails is not sent again (spec stack §8). Returns how many of each.
     */
    async runDeadlines(): Promise<{ completed: number; reminded: number }> {
      const now = clock.now();
      const count = { completed: 0, reminded: 0 };

      const due = await withoutIsolation((db) =>
        db
          .select({ id: twoFactorRecovery.id, userId: twoFactorRecovery.userId })
          .from(twoFactorRecovery)
          .where(lte(twoFactorRecovery.dueAt, now)),
      );
      for (const { id, userId } of due) {
        const { locale } = await languageAndTimeZoneOf(userId, now);
        const owner = await withoutIsolation((db) =>
          db.transaction(async (tx) => {
            // Cancelled since it was read: nothing happens.
            const ended = await tx
              .delete(twoFactorRecovery)
              .where(eq(twoFactorRecovery.id, id))
              .returning({ id: twoFactorRecovery.id });
            if (ended.length === 0) return undefined;
            // What the plugin's own `disable` does.
            await tx.delete(twoFactor).where(eq(twoFactor.userId, userId));
            const [turnedOff] = await tx
              .update(user)
              .set({ twoFactorEnabled: false, updatedAt: now })
              .where(and(eq(user.id, userId), eq(user.twoFactorEnabled, true)))
              .returning({ email: user.email });
            return turnedOff;
          }),
        );
        if (!owner) continue;
        sendEmail(owner.email, 'two_factor_recovery_completed', { notMeUrl }, locale);
        count.completed += 1;
      }

      const ending = await withoutIsolation((db) =>
        db
          .select({ id: twoFactorRecovery.id, userId: twoFactorRecovery.userId })
          .from(twoFactorRecovery)
          .where(
            and(
              isNull(twoFactorRecovery.remindedAt),
              gt(twoFactorRecovery.dueAt, now),
              lte(twoFactorRecovery.dueAt, new Date(now.getTime() + REMINDER_LEAD_MS)),
            ),
          ),
      );
      for (const { id, userId } of ending) {
        // The first link stays good; the reminder carries one of its own, only the hash being kept.
        const token = random.token();
        const { locale, timeZone } = await languageAndTimeZoneOf(userId, now);
        const [reminded] = await withoutIsolation((db) =>
          db.transaction(async (tx) => {
            const marked = await tx
              .update(twoFactorRecovery)
              .set({ remindedAt: now, reminderTokenHash: hashToken(token) })
              .where(and(eq(twoFactorRecovery.id, id), isNull(twoFactorRecovery.remindedAt)))
              .returning({ id: twoFactorRecovery.id });
            // Reminded or cancelled since it was read.
            if (marked.length === 0) return [];
            return tx
              .select({ email: user.email, dueAt: twoFactorRecovery.dueAt })
              .from(twoFactorRecovery)
              .innerJoin(user, eq(user.id, twoFactorRecovery.userId))
              .where(eq(twoFactorRecovery.id, id));
          }),
        );
        if (!reminded) continue;
        sendEmail(
          reminded.email,
          'two_factor_recovery_reminder',
          { dueAt: reminded.dueAt, timeZone, cancelUrl: cancelUrl(token), notMeUrl },
          locale,
        );
        count.reminded += 1;
      }
      return count;
    },
  };
}
