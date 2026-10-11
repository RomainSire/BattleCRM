import { eq, lt } from 'drizzle-orm';

import type { Clock } from '../clock.ts';
import { withoutIsolation } from '../db/index.ts';
import { loginAttempt } from './tables.ts';

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
/** From this many failures in a row, each attempt waits longer than the one before. */
const SLOWED_AFTER = 5;
/** This many failures in a row block the address, for 15 minutes. */
const BLOCKED_AFTER = 10;

/** 1 s after the 5th failure, then twice as long each time: 16 s before the 10th attempt. */
const delayAfter = (failures: number) => 1000 * 2 ** (failures - SLOWED_AFTER);

export type LoginAttempts = ReturnType<typeof createLoginAttempts>;

/**
 * The sign-in limiter by address (ST-15, spec stack §7): 5 failures in 15 minutes, then a growing delay;
 * 10 failures, then 15 minutes blocked. Failures add up until 15 minutes pass without an attempt:
 * no boundary of a window gives a fresh start to someone who keeps trying. It counts by address, not by account: an address nobody owns
 * slows down and blocks alike, so the limiter tells nothing about who has an account (ST-13).
 */
export function createLoginAttempts({ clock }: { clock: Clock }) {
  return {
    /**
     * Before any check of a password or a code: counts the attempt as a failure, which `succeeded`
     * erases, and waits out its delay. Resolves to false when the address is blocked.
     * Counting first, under a row lock, is what holds against attempts sent together.
     */
    async admit(email: string): Promise<boolean> {
      const now = clock.now();
      const attemptAt = await withoutIsolation((db) =>
        db.transaction(async (tx) => {
          await tx
            .insert(loginAttempt)
            .values({ email, failures: 0, lastAttemptAt: now })
            .onConflictDoNothing();
          const [counter] = await tx
            .select()
            .from(loginAttempt)
            .where(eq(loginAttempt.email, email))
            .for('update');
          if (!counter) throw new Error('The sign-in counter was not written');
          if (counter.blockedUntil && counter.blockedUntil > now) return undefined;
          const quiet = now.getTime() - counter.lastAttemptAt.getTime() >= LOGIN_WINDOW_MS;
          const failures = quiet ? 0 : counter.failures;
          // Attempts sent together queue behind one another: each counts from the one before.
          const notBefore =
            failures >= SLOWED_AFTER ? counter.lastAttemptAt.getTime() + delayAfter(failures) : 0;
          const admittedAt = new Date(Math.max(now.getTime(), notBefore));
          await tx
            .update(loginAttempt)
            .set({
              failures: failures + 1,
              lastAttemptAt: admittedAt,
              blockedUntil:
                failures + 1 >= BLOCKED_AFTER
                  ? new Date(admittedAt.getTime() + LOGIN_WINDOW_MS)
                  : null,
            })
            .where(eq(loginAttempt.email, email));
          return admittedAt;
        }),
      );
      if (!attemptAt) return false;
      const delay = attemptAt.getTime() - now.getTime();
      if (delay > 0) await clock.sleep(delay);
      return true;
    },

    /** The address proved itself: its failures are forgotten, a block included. */
    async succeeded(email: string): Promise<void> {
      await withoutIsolation((db) => db.delete(loginAttempt).where(eq(loginAttempt.email, email)));
    },

    /** Scheduled: a counter nobody touched for a whole window counts nothing any more. Returns how many. */
    async purgeExpired(): Promise<number> {
      const before = new Date(clock.now().getTime() - LOGIN_WINDOW_MS);
      const purged = await withoutIsolation((db) =>
        db
          .delete(loginAttempt)
          .where(lt(loginAttempt.lastAttemptAt, before))
          .returning({ email: loginAttempt.email }),
      );
      return purged.length;
    },
  };
}
