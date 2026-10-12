import { and, eq, gt, like, sql } from 'drizzle-orm';

import type { Clock } from '../clock.ts';
import type { Config } from '../config.ts';
import { withoutIsolation, type Transaction } from '../db/index.ts';
import type { SendEmail } from '../email/index.ts';
import type { Random } from '../random.ts';
import { languageAndTimeZoneOf } from '../settings/index.ts';
import { purgeExpiredLinks } from './purge.ts';
import { user, verification } from './tables.ts';
import { hashToken } from './token-hash.ts';

const CHANGE_LINK_LIFETIME_MS = 60 * 60 * 1000;
/**
 * A change under way is a row of `verification`: this and the hash of its token as identifier,
 * the User and the new address as value, a space between them.
 */
const CHANGE_PREFIX = 'email-change:';

const changeIdentifier = (token: string) => `${CHANGE_PREFIX}${hashToken(token)}`;

/** Every change of address a User has under way. An id is a UUID: nothing in it means anything to `like`. */
const emailChangesOf = (userId: string) =>
  and(like(verification.identifier, `${CHANGE_PREFIX}%`), like(verification.value, `${userId} %`));

/** Whatever change of address a User had under way no longer happens. */
export const cancelEmailChanges = (tx: Transaction, userId: string) =>
  tx.delete(verification).where(emailChangesOf(userId));

const isTaken = async (tx: Transaction, email: string) =>
  (await tx.select({ id: user.id }).from(user).where(eq(user.email, email))).length > 0;

/**
 * The home-made change of address (ADR 0010): the native `/change-email` stays off the allowlist, since
 * its link opens a session without the second factor. Here the link opens nothing: it only works for a
 * device already signed in to the account that asked. The current address is warned when the change is
 * asked for, while its “It wasn't me” can still stop it: a new password cancels the change under way.
 */
export function createEmailChange({
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
  return {
    /**
     * A User, already reauthenticated, asks for a new address: a link leaves for it, unless someone
     * has it already, and the caller answers alike either way. An address that is taken gets its row too,
     * never clickable: both cases write the same. A new request replaces the one before.
     */
    async request(userId: string, email: string): Promise<void> {
      const now = clock.now();
      const token = random.token();
      const [owner] = await withoutIsolation((db) =>
        db.select({ email: user.email }).from(user).where(eq(user.id, userId)),
      );
      if (!owner) throw new Error('A signed-in User has no account');
      if (owner.email === email) return;
      const { locale } = await languageAndTimeZoneOf(userId, now);
      const taken = await withoutIsolation((db) =>
        db.transaction(async (tx) => {
          // Requests sent together by one User queue here: the last one alone keeps its link.
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${CHANGE_PREFIX + userId}))`);
          await cancelEmailChanges(tx, userId);
          await tx.insert(verification).values({
            identifier: changeIdentifier(token),
            value: `${userId} ${email}`,
            expiresAt: new Date(now.getTime() + CHANGE_LINK_LIFETIME_MS),
            createdAt: now,
            updatedAt: now,
          });
          return isTaken(tx, email);
        }),
      );
      if (!taken) {
        // In the fragment: it never reaches a server log.
        sendEmail(
          email,
          'email_change_confirm',
          { url: `${config.appOrigin}/change-email#${token}` },
          locale,
        );
      }
      sendEmail(
        owner.email,
        'email_change_notice',
        // “It wasn't me” leads to a new password, which cancels the change.
        { newEmail: email, notMeUrl: `${config.appOrigin}/forgot-password` },
        locale,
      );
    },

    /**
     * The click, on a device signed in as `userId`: the link is used up and the address changes, in one
     * transaction. A link of another User, expired, already used, replaced, or whose address someone
     * took in the meantime all resolve to nothing.
     */
    async confirm(userId: string, token: string): Promise<{ email: string } | undefined> {
      const now = clock.now();
      return withoutIsolation((db) =>
        db.transaction(async (tx) => {
          // Two requests with the same link: a single one deletes the row.
          const [link] = await tx
            .delete(verification)
            .where(
              and(
                eq(verification.identifier, changeIdentifier(token)),
                gt(verification.expiresAt, now),
                emailChangesOf(userId),
              ),
            )
            .returning({ value: verification.value });
          if (!link) return undefined;
          const email = link.value.slice(userId.length + 1);
          // Two Users clicking for the same address queue here: the second one finds it taken.
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${CHANGE_PREFIX + email}))`);
          if (await isTaken(tx, email)) return undefined;
          await tx.update(user).set({ email, updatedAt: now }).where(eq(user.id, userId));
          return { email };
        }),
      );
    },

    /** Scheduled: an expired link is refused, never erased by a click. Returns how many went. */
    purgeExpiredLinks: () => purgeExpiredLinks(CHANGE_PREFIX, clock.now()),
  };
}
