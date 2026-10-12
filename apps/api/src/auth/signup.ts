import { SIGNUP_RESEND_DELAY_SECONDS } from '@battlecrm/contract';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { Logger } from 'pino';

import type { Clock } from '../clock.ts';
import type { Config } from '../config.ts';
import { withoutIsolation, withUser, type Transaction } from '../db/index.ts';
import type { Locale, SendEmail } from '../email/index.ts';
import type { Random } from '../random.ts';
import { newPasswordRefusal, type Hibp } from './hibp.ts';
import { account, pendingSignup, user } from './tables.ts';
import { hashToken } from './token-hash.ts';

const LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;
const RESEND_DELAY_MS = SIGNUP_RESEND_DELAY_SECONDS * 1000;
const UNVERIFIED_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** What a module learns when an account is created, in the transaction that creates it. */
export type AccountCreated = { userId: string; locale: Locale; timeZone: string; now: Date };
/** The extension point "account created": each handler writes its module's first rows for the new User. */
export type OnAccountCreated = (tx: Transaction, account: AccountCreated) => Promise<void>;

export type SignupDependencies = {
  config: Config;
  clock: Clock;
  random: Random;
  logger: Logger;
  hibp: Hibp;
  sendEmail: SendEmail;
  hashPassword: (password: string) => Promise<string>;
  onAccountCreated: OnAccountCreated[];
};

/** The home-made sign-up (spec stack §7): an attempt per submission, the account at the click. */
export function createSignup({
  config,
  clock,
  random,
  logger,
  hibp,
  sendEmail,
  hashPassword,
  onAccountCreated,
}: SignupDependencies) {
  /** A fresh single-use link for an attempt; only its hash is stored. */
  function newLink(now: Date) {
    const token = random.token();
    return {
      token,
      stored: {
        tokenHash: hashToken(token),
        tokenExpiresAt: new Date(now.getTime() + LINK_LIFETIME_MS),
        lastSentAt: now,
      },
    };
  }

  /** The verification link, or "you already have an account": the screen cannot tell which one left. */
  async function sendLink({ email, locale }: { email: string; locale: Locale }, token: string) {
    const taken = await withoutIsolation((db) =>
      db.select({ id: user.id }).from(user).where(eq(user.email, email)),
    );
    if (taken.length > 0) {
      sendEmail(
        email,
        'account_exists',
        {
          signInUrl: `${config.appOrigin}/sign-in`,
          resetUrl: `${config.appOrigin}/forgot-password`,
        },
        locale,
      );
    } else {
      // In the fragment: it never reaches a server log.
      sendEmail(
        email,
        'verify_email',
        { url: `${config.appOrigin}/verify-email#${token}` },
        locale,
      );
    }
  }

  return {
    async start(request: {
      email: string;
      password: string;
      locale: Locale;
      timeZone: string;
    }): Promise<
      | { attemptId: string }
      | { refused: 'signups_closed' | 'password_compromised' | 'password_check_unavailable' }
    > {
      if (!config.signupsOpen) return { refused: 'signups_closed' };
      const refused = await newPasswordRefusal(hibp, logger, request.password);
      if (refused) return { refused };
      const passwordHash = await hashPassword(request.password);
      const now = clock.now();
      const link = newLink(now);
      // The delay between two sends holds per address too: signing up again and again floods nobody.
      // The answer stays the same; the link already sent, or "Resend the link" a minute later, still works.
      const justSent = await withoutIsolation((db) =>
        db
          .select({ id: pendingSignup.id })
          .from(pendingSignup)
          .where(
            and(
              eq(pendingSignup.email, request.email),
              gt(pendingSignup.lastSentAt, new Date(now.getTime() - RESEND_DELAY_MS)),
            ),
          )
          .limit(1),
      );
      const [attempt] = await withoutIsolation((db) =>
        db
          .insert(pendingSignup)
          .values({
            email: request.email,
            passwordHash,
            locale: request.locale,
            timeZone: request.timeZone,
            createdAt: now,
            ...link.stored,
          })
          .returning({ id: pendingSignup.id }),
      );
      if (!attempt) throw new Error('The sign-up attempt was not written');
      if (justSent.length === 0) await sendLink(request, link.token);
      return { attemptId: attempt.id };
    },

    /** A new link for the same attempt, which replaces the previous one; an unknown attempt answers alike. */
    async resend(attemptId: string): Promise<'sent' | { retryAfterSeconds: number }> {
      const now = clock.now();
      const link = newLink(now);
      const sendableSince = new Date(now.getTime() - RESEND_DELAY_MS);
      const outcome = await withoutIsolation((db) =>
        db.transaction(async (tx) => {
          const [attempt] = await tx
            .select()
            .from(pendingSignup)
            .where(eq(pendingSignup.id, attemptId))
            .for('update');
          if (!attempt) return 'unknown';
          if (attempt.lastSentAt > sendableSince) {
            const waitMs = attempt.lastSentAt.getTime() - sendableSince.getTime();
            return { retryAfterSeconds: Math.ceil(waitMs / 1000), attempt: undefined };
          }
          await tx.update(pendingSignup).set(link.stored).where(eq(pendingSignup.id, attemptId));
          return { attempt };
        }),
      );
      if (outcome === 'unknown') return 'sent';
      if (outcome.attempt === undefined) return { retryAfterSeconds: outcome.retryAfterSeconds };
      await sendLink(outcome.attempt, link.token);
      return 'sent';
    },

    /**
     * The click: creates the User with the password of this attempt, and everything it starts with,
     * in one transaction. The link works once, and never once the address has an account.
     */
    async verify(token: string): Promise<{ userId: string; email: string } | undefined> {
      const now = clock.now();
      const generated = await withoutIsolation((db) =>
        db.execute<{ id: string }>(sql`select uuidv7() as id`),
      );
      const userId = generated.rows[0]?.id;
      if (!userId) throw new Error('The database generated no id');
      return withUser(userId, async (tx) => {
        // An expired link leaves its attempt alone: "Resend the link" can still revive it.
        const [attempt] = await tx
          .delete(pendingSignup)
          .where(
            and(
              eq(pendingSignup.tokenHash, hashToken(token)),
              gt(pendingSignup.tokenExpiresAt, now),
            ),
          )
          .returning();
        if (!attempt) return undefined;
        const { email } = attempt;
        const created = await tx
          .insert(user)
          .values({
            id: userId,
            name: '',
            email,
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing({ target: user.email })
          .returning({ id: user.id });
        if (created.length === 0) return undefined;
        await tx.insert(account).values({
          accountId: userId,
          providerId: 'credential',
          userId,
          password: attempt.passwordHash,
          createdAt: now,
          updatedAt: now,
        });
        // The other attempts on this address die with their passwords.
        await tx.delete(pendingSignup).where(eq(pendingSignup.email, email));
        const accountCreated = {
          userId,
          locale: attempt.locale,
          timeZone: attempt.timeZone,
          now,
        };
        for (const handler of onAccountCreated) await handler(tx, accountCreated);
        return { userId, email };
      });
    },

    /** Scheduled (ST-21): an attempt never verified is erased after 7 days. Returns how many. */
    async purgeUnverified(): Promise<number> {
      const before = new Date(clock.now().getTime() - UNVERIFIED_LIFETIME_MS);
      const purged = await withoutIsolation((db) =>
        db
          .delete(pendingSignup)
          .where(lt(pendingSignup.createdAt, before))
          .returning({ id: pendingSignup.id }),
      );
      return purged.length;
    },
  };
}
