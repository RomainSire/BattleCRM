import { PASSWORD_MAX_LENGTH } from '@battlecrm/contract';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { withoutIsolation } from '../db/index.ts';
import type { LoginAttempts } from './login-attempts.ts';
import { account, user } from './tables.ts';

/** The field every sensitive request carries: the current password, judged like the one of a sign-in. */
export const currentPassword = z.string().min(1).max(PASSWORD_MAX_LENGTH);

/**
 * What a refusal answers. Never 401, which the SPA reads as a session ended from elsewhere:
 * a wrong password leaves the device signed in.
 */
export const REAUTHENTICATION_STATUS = { wrong_password: 403, too_many_attempts: 429 } as const;

/**
 * Reauthentication (ST-20, spec stack §7): the password comes with every sensitive request and is checked
 * each time, with no window during which a session alone would do. Wrong passwords count with the failed
 * sign-ins of the address: a stolen session does not get to guess the password at leisure.
 */
export function createReauthentication({
  loginAttempts,
  verifyPassword,
}: {
  loginAttempts: LoginAttempts;
  verifyPassword: (hash: string, password: string) => Promise<boolean>;
}) {
  /** Resolves to nothing when the password is the User's, to the refusal otherwise. */
  return async function reauthenticate(
    userId: string,
    password: string,
  ): Promise<keyof typeof REAUTHENTICATION_STATUS | undefined> {
    const [credential] = await withoutIsolation((db) =>
      db
        .select({ email: user.email, hash: account.password })
        .from(account)
        .innerJoin(user, eq(user.id, account.userId))
        .where(and(eq(account.userId, userId), eq(account.providerId, 'credential'))),
    );
    if (!credential?.hash) throw new Error('A User has no password');
    if (!(await loginAttempts.admit(credential.email))) return 'too_many_attempts';
    if (!(await verifyPassword(credential.hash, password))) return 'wrong_password';
    await loginAttempts.succeeded(credential.email);
    return undefined;
  };
}
