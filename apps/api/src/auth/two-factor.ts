import { createOTP } from '@better-auth/utils/otp';
import { symmetricDecrypt, symmetricEncrypt, type SecretConfig } from 'better-auth/crypto';
import { and, eq, like } from 'drizzle-orm';
import { z } from 'zod';

import type { Clock } from '../clock.ts';
import type { Config } from '../config.ts';
import { withoutIsolation, type Transaction } from '../db/index.ts';
import type { SendEmail } from '../email/index.ts';
import { languageAndTimeZoneOf } from '../settings/index.ts';
import type { LoginAttempts } from './login-attempts.ts';
import { purgeExpiredLinks } from './purge.ts';
import { twoFactor, user, verification } from './tables.ts';

/** A code as typed: of the authenticator app or a backup one, spaces left out. */
export const secondFactorCode = z
  .string()
  .max(40)
  .transform((code) => code.replaceAll(/\s/g, ''))
  .pipe(z.string().min(1));

/** What the authenticator app shows; anything else is tried as a backup code. */
const TOTP_CODE = /^\d{6}$/;
/** The rows the plugin writes in `verification` while a sign-in awaits its code: `2fa-…` and `2fa-attempts-2fa-…`. */
const CHALLENGE_PREFIX = '2fa-';

type Owner = { id: string; email: string };

/**
 * Whatever sign-in of a User awaited its code no longer does: the password that opened it is not the
 * password any more, and its challenge must not ask for a recovery either. A challenge names its User as value.
 */
export const endSecondFactorChallenges = (tx: Transaction, userId: string) =>
  tx
    .delete(verification)
    .where(
      and(like(verification.identifier, `${CHALLENGE_PREFIX}%`), eq(verification.value, userId)),
    );

/** The second factor of a User once a first code confirmed it. */
async function confirmedOf(userId: string) {
  const [row] = await withoutIsolation((db) =>
    db
      .select({ id: twoFactor.id, secret: twoFactor.secret, backupCodes: twoFactor.backupCodes })
      .from(twoFactor)
      .innerJoin(user, eq(user.id, twoFactor.userId))
      .where(and(eq(twoFactor.userId, userId), eq(user.twoFactorEnabled, true))),
  );
  return row;
}

export type TwoFactor = ReturnType<typeof createTwoFactor>;

/**
 * What our own journeys need of the second factor beyond the plugin's endpoints (spec stack §7):
 * how many backup codes are left, a code checked where no sign-in is under way (the end of a
 * password reset), and the two security e-mails. The plugin keeps the key and the codes encrypted
 * with the secret of Better Auth, which `secretKey` hands over.
 */
export function createTwoFactor({
  config,
  clock,
  sendEmail,
  loginAttempts,
  secretKey,
}: {
  config: Config;
  clock: Clock;
  sendEmail: SendEmail;
  loginAttempts: LoginAttempts;
  secretKey: () => Promise<string | SecretConfig>;
}) {
  const backupCodesIn = async (encrypted: string) =>
    z
      .array(z.string())
      .parse(JSON.parse(await symmetricDecrypt({ key: await secretKey(), data: encrypted })));

  /** Uses a backup code up. Two requests with the same code: a single one rewrites the list it read. */
  async function useBackupCode(row: { id: string; backupCodes: string }, code: string) {
    const codes = await backupCodesIn(row.backupCodes);
    if (!codes.includes(code)) return false;
    const left = await symmetricEncrypt({
      key: await secretKey(),
      data: JSON.stringify(codes.filter((kept) => kept !== code)),
    });
    const used = await withoutIsolation((db) =>
      db
        .update(twoFactor)
        .set({ backupCodes: left })
        .where(and(eq(twoFactor.id, row.id), eq(twoFactor.backupCodes, row.backupCodes)))
        .returning({ id: twoFactor.id }),
    );
    return used.length > 0;
  }

  return {
    /** The address the counters of a User go by. */
    async ownerOf(userId: string): Promise<Owner | undefined> {
      const [owner] = await withoutIsolation((db) =>
        db.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, userId)),
      );
      return owner;
    },

    /** Whether a code is asked of this User. */
    async isEnabled(userId: string): Promise<boolean> {
      return (await confirmedOf(userId)) !== undefined;
    },

    /** The backup codes still unused: shown once when they are made, counted afterwards (ST-18). */
    async backupCodes(userId: string): Promise<string[] | undefined> {
      const row = await confirmedOf(userId);
      return row && (await backupCodesIn(row.backupCodes));
    },

    /**
     * A code given outside a sign-in, by someone who holds no session. Counted with the failed sign-ins
     * of the address before it is looked at; the caller erases them once its journey went through.
     * Resolves to nothing when the code is right, a backup code being used up, to the refusal otherwise.
     */
    async check(
      owner: Owner,
      code: string,
    ): Promise<'invalid_code' | 'too_many_attempts' | undefined> {
      if (!(await loginAttempts.admit(owner.email))) return 'too_many_attempts';
      const row = await confirmedOf(owner.id);
      if (!row) throw new Error('A code was checked for a User without a second factor');
      const right = TOTP_CODE.test(code)
        ? await createOTP(
            await symmetricDecrypt({ key: await secretKey(), data: row.secret }),
          ).verify(code)
        : await useBackupCode(row, code);
      return right ? undefined : 'invalid_code';
    },

    /**
     * The security e-mail of a second factor turned on or off; “It wasn't me” leads to a new password.
     * Its language is read here, before anything changes: what it resolves to cannot fail the answer.
     */
    async securityEmailTo(owner: Owner) {
      const { locale } = await languageAndTimeZoneOf(owner.id, clock.now());
      return (template: 'two_factor_enabled' | 'two_factor_disabled') =>
        sendEmail(
          owner.email,
          template,
          { notMeUrl: `${config.appOrigin}/forgot-password` },
          locale,
        );
    },

    /** Scheduled: a sign-in left at its second step leaves its challenge behind. Returns how many went. */
    purgeExpiredChallenges: () => purgeExpiredLinks(CHALLENGE_PREFIX, clock.now()),
  };
}
