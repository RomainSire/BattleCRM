import { and, eq, gt, like, ne, sql } from 'drizzle-orm';
import type { Logger } from 'pino';

import type { Clock } from '../clock.ts';
import type { Config } from '../config.ts';
import { withoutIsolation, type Transaction } from '../db/index.ts';
import type { Locale } from '../email/index.ts';
import type { SendEmail } from '../email/index.ts';
import type { Random } from '../random.ts';
import { languageAndTimeZoneOf } from '../settings/index.ts';
import { cancelEmailChanges } from './email-change.ts';
import { newPasswordRefusal, type Hibp } from './hibp.ts';
import type { LoginAttempts } from './login-attempts.ts';
import { purgeExpiredLinks } from './purge.ts';
import { account, session, user, verification } from './tables.ts';
import { cancelTwoFactorRecovery } from './two-factor-recovery.ts';
import { endSecondFactorChallenges, type TwoFactor } from './two-factor.ts';
import { hashToken } from './token-hash.ts';

const RESET_LINK_LIFETIME_MS = 60 * 60 * 1000;
/** Between two reset links sent to the same address. */
const RESET_RESEND_DELAY_MS = 60 * 1000;
/** A reset link is a row of `verification`: this and the hash of its token as identifier, its address as value. */
const RESET_PREFIX = 'password-reset:';

const resetIdentifier = (token: string) => `${RESET_PREFIX}${hashToken(token)}`;
/** Every reset link sent to an address. */
const resetLinksOf = (email: string) =>
  and(like(verification.identifier, `${RESET_PREFIX}%`), eq(verification.value, email));

type Owner = { id: string; email: string };

/**
 * The new password of a User; whatever reset link was on its way opens nothing any more, and a change of
 * address or a recovery of the second factor under way is cancelled: it is what “It wasn't me” promises
 * in the e-mail that warned of it.
 */
async function setPassword(tx: Transaction, owner: Owner, passwordHash: string, now: Date) {
  await tx
    .update(account)
    .set({ password: passwordHash, updatedAt: now })
    .where(and(eq(account.userId, owner.id), eq(account.providerId, 'credential')));
  await tx.delete(verification).where(resetLinksOf(owner.email));
  await cancelEmailChanges(tx, owner.id);
  await cancelTwoFactorRecovery(tx, owner.id);
  // Else someone who had the old password could ask for the recovery again, without the new one.
  await endSecondFactorChallenges(tx, owner.id);
}

/**
 * The two ways a password changes once the account exists (spec stack §7): the home-made end of a reset,
 * by a single-use link of one hour, and a change by a signed-in User. Both check the new password against
 * known breaches, sign the other devices out and tell the User by e-mail. A reset also takes a code
 * of the second factor when the account has one.
 */
export function createPasswords({
  config,
  clock,
  random,
  logger,
  hibp,
  sendEmail,
  loginAttempts,
  twoFactor,
  hashPassword,
}: {
  config: Config;
  clock: Clock;
  random: Random;
  logger: Logger;
  hibp: Hibp;
  sendEmail: SendEmail;
  loginAttempts: LoginAttempts;
  twoFactor: TwoFactor;
  hashPassword: (password: string) => Promise<string>;
}) {
  /** The security e-mail of both journeys; “It wasn't me” leads to a new password. */
  function tellChanged(owner: Owner, locale: Locale) {
    sendEmail(
      owner.email,
      'password_changed',
      { notMeUrl: `${config.appOrigin}/forgot-password` },
      locale,
    );
  }

  return {
    /**
     * “Forgot your password”: a link leaves if the address has an account, and the caller answers alike
     * either way (ST-13). An address nobody owns gets its row too, never clickable: both cases write
     * the same, and only an account adds the reads its e-mail needs. At most one link a minute per address.
     */
    async requestReset(email: string): Promise<void> {
      const now = clock.now();
      const token = random.token();
      const issued = await withoutIsolation((db) =>
        db.transaction(async (tx) => {
          const ofThisAddress = resetLinksOf(email);
          // Requests sent together for one address queue here: a single one sends a link.
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${RESET_PREFIX + email}))`);
          const justSent = await tx
            .select({ id: verification.id })
            .from(verification)
            .where(
              and(
                ofThisAddress,
                gt(verification.createdAt, new Date(now.getTime() - RESET_RESEND_DELAY_MS)),
              ),
            )
            .limit(1);
          if (justSent.length > 0) return false;
          // A new link replaces the previous one.
          await tx.delete(verification).where(ofThisAddress);
          await tx.insert(verification).values({
            identifier: resetIdentifier(token),
            value: email,
            expiresAt: new Date(now.getTime() + RESET_LINK_LIFETIME_MS),
            createdAt: now,
            updatedAt: now,
          });
          return true;
        }),
      );
      if (!issued) return;
      const [owner] = await withoutIsolation((db) =>
        db.select({ id: user.id }).from(user).where(eq(user.email, email)),
      );
      if (!owner) return;
      const { locale } = await languageAndTimeZoneOf(owner.id, now);
      // In the fragment: it never reaches a server log.
      sendEmail(
        email,
        'password_reset_link',
        { url: `${config.appOrigin}/reset-password#${token}` },
        locale,
      );
    },

    /**
     * The end of a reset: the link is used up by the request that changes the password, which ends
     * every session of the User and lifts the block of its address. An account with a second factor
     * gives a code too (spec UX §5.9). A refused password or code leaves the link alone.
     * The caller then signs this device in.
     */
    async completeReset({
      token,
      password,
      code,
    }: {
      token: string;
      password: string;
      code?: string | undefined;
    }): Promise<
      | { id: string; email: string }
      | {
          refused:
            | 'invalid_link'
            | 'two_factor_required'
            | 'invalid_code'
            | 'too_many_attempts'
            | 'password_compromised'
            | 'password_check_unavailable';
        }
    > {
      const now = clock.now();
      const link = and(
        eq(verification.identifier, resetIdentifier(token)),
        gt(verification.expiresAt, now),
      );
      const [owner] = await withoutIsolation((db) =>
        db
          .select({ id: user.id, email: user.email })
          .from(verification)
          .innerJoin(user, eq(user.email, verification.value))
          .where(link),
      );
      if (!owner) return { refused: 'invalid_link' };
      const codeAwaited = await twoFactor.isEnabled(owner.id);
      if (codeAwaited && code === undefined) return { refused: 'two_factor_required' };
      const refused = await newPasswordRefusal(hibp, logger, password);
      if (refused) return { refused };
      const passwordHash = await hashPassword(password);
      // Read before anything changes: once the password is set, nothing may fail the answer.
      const { locale } = await languageAndTimeZoneOf(owner.id, now);
      // Last before the change: a backup code is used up by the check, and only a reset about to go
      // through may cost one.
      const denied =
        codeAwaited && code !== undefined ? await twoFactor.check(owner, code) : undefined;
      if (denied) return { refused: denied };
      const used = await withoutIsolation((db) =>
        db.transaction(async (tx) => {
          // Two requests with the same link: a single one deletes the row.
          const consumed = await tx
            .delete(verification)
            .where(link)
            .returning({ id: verification.id });
          if (consumed.length === 0) return false;
          await setPassword(tx, owner, passwordHash, now);
          await tx.delete(session).where(eq(session.userId, owner.id));
          return true;
        }),
      );
      if (!used) return { refused: 'invalid_link' };
      await loginAttempts.succeeded(owner.email);
      tellChanged(owner, locale);
      return owner;
    },

    /** A signed-in User, already reauthenticated, takes a new password: every other session ends. */
    async change(
      userId: string,
      currentSessionId: string,
      newPassword: string,
    ): Promise<'password_compromised' | 'password_check_unavailable' | undefined> {
      const refused = await newPasswordRefusal(hibp, logger, newPassword);
      if (refused) return refused;
      const passwordHash = await hashPassword(newPassword);
      const now = clock.now();
      const [owner] = await withoutIsolation((db) =>
        db.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, userId)),
      );
      if (!owner) throw new Error('A signed-in User has no account');
      const { locale } = await languageAndTimeZoneOf(owner.id, now);
      await withoutIsolation((db) =>
        db.transaction(async (tx) => {
          await setPassword(tx, owner, passwordHash, now);
          await tx
            .delete(session)
            .where(and(eq(session.userId, userId), ne(session.id, currentSessionId)));
        }),
      );
      tellChanged(owner, locale);
      return undefined;
    },

    /** Scheduled: an expired reset link is refused, never erased by a click. Returns how many went. */
    purgeExpiredLinks: () => purgeExpiredLinks(RESET_PREFIX, clock.now()),
  };
}
