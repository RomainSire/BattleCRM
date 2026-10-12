import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@battlecrm/contract';
import { locales } from '@battlecrm/i18n/runtime';
import { Hono, type Context } from 'hono';
import { getSignedCookie, setSignedCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { Logger } from 'pino';
import { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { Clock } from '../clock.ts';
import type { Config } from '../config.ts';
import { withoutIsolation } from '../db/index.ts';
import type { SendEmail } from '../email/index.ts';
import type { Job } from '../jobs/index.ts';
import { jsonBody } from '../json-body.ts';
import type { Random } from '../random.ts';
import { isTimeZone } from '../settings/index.ts';
import {
  createBetterAuth,
  DISABLE_TWO_FACTOR_PATH,
  ENABLE_TWO_FACTOR_PATH,
  GENERATE_BACKUP_CODES_PATH,
  SIGN_IN_PATH,
  SIGN_OUT_PATH,
  TWO_FACTOR_CHALLENGE_COOKIE,
  VERIFY_BACKUP_CODE_PATH,
  VERIFY_TOTP_PATH,
  type BetterAuth,
} from './better-auth.ts';
import type { Hibp } from './hibp.ts';
import { createDevices } from './devices.ts';
import { createEmailChange } from './email-change.ts';
import { createLoginAttempts } from './login-attempts.ts';
import { createPasswords } from './passwords.ts';
import { purgeExpiredSessionsAndCounters } from './purge.ts';
import {
  createReauthentication,
  currentPassword,
  REAUTHENTICATION_STATUS,
} from './reauthentication.ts';
import { listSessions, revokeOtherSessions, revokeSession } from './sessions.ts';
import { createSignup, type OnAccountCreated } from './signup.ts';
import { createTwoFactor, secondFactorCode } from './two-factor.ts';

export { haveIBeenPwned, type Hibp } from './hibp.ts';
export type { AccountCreated, OnAccountCreated } from './signup.ts';

const NATIVE_BASE_PATH = '/api/auth';

// Lower case, as Better Auth looks an address up.
const emailAddress = z.string().trim().toLowerCase().pipe(z.email().max(254));
// No other rule than the length (spec stack §7).
const chosenPassword = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);
const linkToken = z.string().min(1).max(200);

const signupRequest = z.object({
  email: emailAddress,
  password: chosenPassword,
  locale: z.enum(locales),
  /** Detected by the browser; one the API does not know falls back to UTC rather than blocking the sign-up. */
  timeZone: z
    .string()
    .max(100)
    .transform((value) => (isTimeZone(value) ? value : 'UTC')),
});
const resendRequest = z.object({ attemptId: z.uuid() });
const linkRequest = z.object({ token: linkToken });
const signInRequest = z.object({
  email: emailAddress,
  // Not the rule of the sign-up: a password too short is a wrong password like any other.
  password: currentPassword,
});
const passwordResetRequest = z.object({ email: emailAddress });
const passwordResetCompletion = z.object({
  token: linkToken,
  password: chosenPassword,
  /** Of the second factor, for an account that has one. */
  code: secondFactorCode.optional(),
});
/** A sensitive request: `password` is the current one, checked every time (ST-20). */
const passwordChangeRequest = z.object({
  password: currentPassword,
  newPassword: chosenPassword,
});

const emailChangeRequest = z.object({ password: currentPassword, email: emailAddress });
/** Turning the second factor on or off, and making new backup codes: sensitive too (ST-20). */
const passwordRequest = z.object({ password: currentPassword });
const codeRequest = z.object({ code: secondFactorCode });
const confirmation = z.object({ password: currentPassword, code: secondFactorCode });

const PASSWORD_REFUSAL_STATUS = {
  password_compromised: 400,
  password_check_unavailable: 503,
} as const;
/**
 * What Better Auth answers a sign-in with, or its second step; its session token stays out of our own
 * answer. With a second factor, the password opens nothing yet: a challenge cookie awaits the code.
 */
const nativeSignIn = z.union([
  z.object({ twoFactorRedirect: z.literal(true) }),
  z.object({ user: z.object({ id: z.string(), email: z.string() }) }),
]);
const nativeError = z.object({ code: z.string() });
const nativeTotpUri = z.object({ totpURI: z.string() });
const nativeBackupCodes = z.object({ backupCodes: z.array(z.string()) });

/** What `requireUser` leaves behind it: the User of the request and the session that proved it. */
type SignedInEnv = AppEnv & { Variables: { userId: string; sessionId: string } };

/**
 * The only module that knows Better Auth and the auth tables (ADR 0010). To the others it only
 * says who the User of a request is: `requireUser` sets `c.var.userId` or answers 401.
 */
export function createAuth({
  config,
  clock,
  random,
  logger,
  hibp,
  sendEmail,
  onAccountCreated,
}: {
  config: Config;
  clock: Clock;
  random: Random;
  logger: Logger;
  hibp: Hibp;
  sendEmail: SendEmail;
  onAccountCreated: OnAccountCreated[];
}) {
  // Built at the first use: the database is open by then. Better Auth keeps the connection it is given:
  // it is the reason why this module alone may work outside row level security (ADR 0009, 0010).
  const loginAttempts = createLoginAttempts({ clock });
  let instance: Promise<BetterAuth> | undefined;
  const betterAuth = () =>
    (instance ??= withoutIsolation((db) =>
      Promise.resolve(createBetterAuth(db, { config, clock, random, logger, loginAttempts })),
    ));
  const betterAuthContext = async () => (await betterAuth()).$context;

  const devices = createDevices({ config, clock, random, sendEmail });

  const hashPassword = async (password: string) =>
    (await betterAuthContext()).password.hash(password);

  const twoFactor = createTwoFactor({
    config,
    clock,
    sendEmail,
    loginAttempts,
    secretKey: async () => (await betterAuthContext()).secretConfig,
  });

  const passwords = createPasswords({
    config,
    clock,
    random,
    logger,
    hibp,
    sendEmail,
    loginAttempts,
    twoFactor,
    hashPassword,
  });

  const emailChange = createEmailChange({ config, clock, random, sendEmail });

  const reauthenticate = createReauthentication({
    loginAttempts,
    verifyPassword: async (hash, password) =>
      (await betterAuthContext()).password.verify({ hash, password }),
  });

  const signup = createSignup({
    config,
    clock,
    random,
    logger,
    hibp,
    sendEmail,
    onAccountCreated,
    hashPassword,
  });

  /** The session of a request, read in the database every time; slides its expiry and its cookie. */
  async function readSession(c: Context) {
    const auth = await betterAuth();
    const { headers, response } = await auth.api.getSession({
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    for (const cookie of headers.getSetCookie()) c.header('Set-Cookie', cookie, { append: true });
    return response ?? undefined;
  }

  /** Opens a session on this device, as Better Auth would: same table, same signed cookie. */
  async function openSession(c: Context<AppEnv>, userId: string) {
    const context = await betterAuthContext();
    const session = await context.internalAdapter.createSession(userId, false, {
      ipAddress: c.var.clientIp ?? '',
      userAgent: c.req.header('User-Agent') ?? '',
    });
    await setSignedCookie(c, context.authCookies.sessionToken.name, session.token, context.secret, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: context.sessionConfig.expiresIn,
    });
  }

  /**
   * Calls an endpoint of Better Auth with a request of our own making: only what the endpoint needs,
   * and the address of the client as `client-ip.ts` resolved it, which is the one its limiter counts.
   */
  async function native<Env extends AppEnv>(
    c: Context<Env>,
    path: string,
    body: unknown,
    /** Instead of every cookie of the request. */
    cookies = c.req.header('Cookie'),
  ): Promise<Response> {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    for (const name of ['Origin', 'User-Agent']) {
      const value = c.req.header(name);
      if (value !== undefined) headers.set(name, value);
    }
    if (cookies !== undefined) headers.set('Cookie', cookies);
    if (c.var.clientIp !== undefined) headers.set('X-Forwarded-For', c.var.clientIp);
    const auth = await betterAuth();
    const response = await auth.handler(
      new Request(`${config.appOrigin}${NATIVE_BASE_PATH}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }),
    );
    for (const cookie of response.headers.getSetCookie()) {
      c.header('Set-Cookie', cookie, { append: true });
    }
    return response;
  }

  /**
   * The User whose sign-in awaits its code, told by the challenge cookie the password left, and that
   * cookie alone, as the request sent it.
   */
  async function challengeOf(c: Context<AppEnv>) {
    const context = await betterAuthContext();
    const { name } = context.createAuthCookie(TWO_FACTOR_CHALLENGE_COOKIE);
    const identifier = await getSignedCookie(c, context.secret, name);
    const cookie = (c.req.header('Cookie') ?? '')
      .split(/;\s*/)
      .find((pair) => pair.startsWith(`${name}=`));
    if (!identifier || cookie === undefined) return undefined;
    // Expired or not, Better Auth says: here it only names the address the attempt counts for.
    const challenge = await context.internalAdapter.findVerificationValue(identifier);
    const awaited = challenge && (await twoFactor.ownerOf(challenge.value));
    return awaited && { awaited, cookie };
  }

  /**
   * The second step of a sign-in: a code, checked by Better Auth against the challenge of the first.
   * Counted with the failed sign-ins of the address before it is looked at (spec stack §7).
   */
  async function secondStep(c: Context<AppEnv>, path: string, code: string) {
    const challenge = await challengeOf(c);
    if (!challenge) return c.json({ error: 'challenge_expired' as const }, 401);
    const { awaited } = challenge;
    if (!(await loginAttempts.admit(awaited.email))) {
      return c.json({ error: 'too_many_attempts' as const }, 429);
    }
    // The challenge and nothing else: with a session next to it, Better Auth would check the code
    // of that session's User, and a right one would pass for the awaited User's.
    const response = await native(c, path, { code }, challenge.cookie);
    if (response.status === 429) return c.json({ error: 'too_many_attempts' as const }, 429);
    if (response.status === 401 || response.status === 400) {
      const refusal = nativeError.parse(await response.json()).code;
      const wrong = refusal === 'INVALID_CODE' || refusal === 'INVALID_BACKUP_CODE';
      // Anything else ended the challenge: used, expired, or worn out by wrong codes.
      return c.json(
        { error: wrong ? ('invalid_code' as const) : ('challenge_expired' as const) },
        401,
      );
    }
    if (!response.ok) throw new Error(`Better Auth answered ${response.status} to a code`);
    const answer = nativeSignIn.parse(await response.json());
    if (!('user' in answer) || answer.user.id !== awaited.id) {
      throw new Error('Better Auth took the code of another User than the one awaited');
    }
    await loginAttempts.succeeded(awaited.email);
    c.set('userId', awaited.id);
    await devices.signedIn(c, awaited);
    return c.json({ email: awaited.email }, 200);
  }

  // A session ended from another device stops here at once: nothing caches it (ST-16).
  const requireUser = createMiddleware<SignedInEnv>(async (c, next) => {
    const signedIn = await readSession(c);
    if (!signedIn) return c.json({ error: 'unauthenticated' as const }, 401);
    c.set('userId', signedIn.user.id);
    c.set('sessionId', signedIn.session.id);
    return next();
  });

  // Chained, so that AppType carries them to the SPA's typed client.
  const routes = new Hono<AppEnv>()
    .get('/config', (c) => c.json({ signupsOpen: config.signupsOpen }))
    .get('/session', async (c) => {
      const signedIn = await readSession(c);
      if (!signedIn) return c.json({ error: 'unauthenticated' as const }, 401);
      c.set('userId', signedIn.user.id);
      return c.json({ email: signedIn.user.email }, 200);
    })
    .post('/signup', jsonBody(signupRequest), async (c) => {
      const outcome = await signup.start(c.req.valid('json'));
      if ('attemptId' in outcome) return c.json(outcome, 202);
      const status = { signups_closed: 403, ...PASSWORD_REFUSAL_STATUS } as const;
      return c.json({ error: outcome.refused }, status[outcome.refused]);
    })
    .post('/signup/resend', jsonBody(resendRequest), async (c) => {
      const outcome = await signup.resend(c.req.valid('json').attemptId);
      if (outcome === 'sent') return c.body(null, 204);
      return c.json({ error: 'too_soon' as const, ...outcome }, 429);
    })
    .post('/signup/verify', jsonBody(linkRequest), async (c) => {
      const account = await signup.verify(c.req.valid('json').token);
      if (!account) return c.json({ error: 'invalid_link' as const }, 400);
      c.set('userId', account.userId);
      await openSession(c, account.userId);
      // The first device of the account: remembered, and worth no e-mail.
      await devices.signedIn(c, { id: account.userId, email: account.email });
      return c.json({ email: account.email }, 200);
    })
    // The allowlist (ADR 0010): only the native endpoints that have a route here, under their own path,
    // reach Better Auth; any other answers 404, like a path nobody serves.
    // Each takes the fields we chose and answers in our own words.
    .post(`/auth${SIGN_IN_PATH}`, jsonBody(signInRequest), async (c) => {
      const response = await native(c, SIGN_IN_PATH, c.req.valid('json'));
      // One answer for a wrong password and an unknown address (ST-13).
      if (response.status === 401) return c.json({ error: 'invalid_credentials' as const }, 401);
      // The limiter of the address or of the IP address: the screen says the same of both (ST-15).
      if (response.status === 429) return c.json({ error: 'too_many_attempts' as const }, 429);
      // Nothing else is expected: every account is verified before it exists, so never a 403.
      if (!response.ok) throw new Error(`Better Auth answered ${response.status} to a sign-in`);
      const answer = nativeSignIn.parse(await response.json());
      // The password was right and proves half: no session, no device, until the code (ST-18).
      if ('twoFactorRedirect' in answer) return c.json({ twoFactorRequired: true as const }, 200);
      const { user } = answer;
      c.set('userId', user.id);
      await devices.signedIn(c, user);
      return c.json({ email: user.email }, 200);
    })
    .post(`/auth${VERIFY_TOTP_PATH}`, jsonBody(codeRequest), (c) =>
      secondStep(c, VERIFY_TOTP_PATH, c.req.valid('json').code),
    )
    .post(`/auth${VERIFY_BACKUP_CODE_PATH}`, jsonBody(codeRequest), (c) =>
      secondStep(c, VERIFY_BACKUP_CODE_PATH, c.req.valid('json').code),
    )
    // This device only, whether it had a session or not.
    .post(`/auth${SIGN_OUT_PATH}`, async (c) => {
      const response = await native(c, SIGN_OUT_PATH, {});
      if (!response.ok) throw new Error(`Better Auth answered ${response.status} to a sign-out`);
      return c.body(null, 204);
    })
    // Forgot your password (spec UX §5.9): the same answer whether the address has an account or not (ST-13).
    .post('/password-reset', jsonBody(passwordResetRequest), async (c) => {
      await passwords.requestReset(c.req.valid('json').email);
      return c.body(null, 204);
    })
    // The home-made end of a reset (ADR 0010): the native `/reset-password` stays off the allowlist.
    .post('/password-reset/complete', jsonBody(passwordResetCompletion), async (c) => {
      const outcome = await passwords.completeReset(c.req.valid('json'));
      if ('refused' in outcome) {
        const status = {
          invalid_link: 400,
          two_factor_required: 403,
          invalid_code: 403,
          too_many_attempts: 429,
          ...PASSWORD_REFUSAL_STATUS,
        } as const;
        return c.json({ error: outcome.refused }, status[outcome.refused]);
      }
      c.set('userId', outcome.id);
      await openSession(c, outcome.id);
      // Remembered without the “new device” e-mail: the User was just told the password changed.
      await devices.signedIn(c, outcome, { announce: false });
      return c.json({ email: outcome.email }, 200);
    })
    .post('/account/password', requireUser, jsonBody(passwordChangeRequest), async (c) => {
      const { password, newPassword } = c.req.valid('json');
      const denied = await reauthenticate(c.var.userId, password);
      if (denied) return c.json({ error: denied }, REAUTHENTICATION_STATUS[denied]);
      const refused = await passwords.change(c.var.userId, c.var.sessionId, newPassword);
      if (refused) return c.json({ error: refused }, PASSWORD_REFUSAL_STATUS[refused]);
      return c.body(null, 204);
    })
    // The home-made change of address (ADR 0010): the native `/change-email` stays off the allowlist.
    // The same answer whether the new address is free or taken.
    .post('/account/email', requireUser, jsonBody(emailChangeRequest), async (c) => {
      const { password, email } = c.req.valid('json');
      const denied = await reauthenticate(c.var.userId, password);
      if (denied) return c.json({ error: denied }, REAUTHENTICATION_STATUS[denied]);
      await emailChange.request(c.var.userId, email);
      return c.body(null, 204);
    })
    // The link sent to the new address. It opens no session: it needs the one of the User who asked.
    .post('/account/email/confirm', requireUser, jsonBody(linkRequest), async (c) => {
      const changed = await emailChange.confirm(c.var.userId, c.req.valid('json').token);
      if (!changed) return c.json({ error: 'invalid_link' as const }, 400);
      return c.json(changed, 200);
    })
    // The second factor (spec UX §5.9, ST-18). The plugin's own endpoints do the work, behind our
    // reauthentication; none of them is reachable under its native path.
    .get('/account/two-factor', requireUser, async (c) => {
      const backupCodes = await twoFactor.backupCodes(c.var.userId);
      return backupCodes
        ? c.json({ enabled: true as const, backupCodesLeft: backupCodes.length }, 200)
        : c.json({ enabled: false as const }, 200);
    })
    // The key of the authenticator app. Nothing is on until a first code confirms it.
    .post('/account/two-factor', requireUser, jsonBody(passwordRequest), async (c) => {
      const { password } = c.req.valid('json');
      const denied = await reauthenticate(c.var.userId, password);
      if (denied) return c.json({ error: denied }, REAUTHENTICATION_STATUS[denied]);
      if (await twoFactor.isEnabled(c.var.userId)) {
        return c.json({ error: 'already_enabled' as const }, 409);
      }
      const response = await native(c, ENABLE_TWO_FACTOR_PATH, { password });
      if (response.status === 429) return c.json({ error: 'too_many_attempts' as const }, 429);
      if (!response.ok) throw new Error(`Better Auth answered ${response.status} to a key request`);
      return c.json({ totpUri: nativeTotpUri.parse(await response.json()).totpURI }, 200);
    })
    // The first code: it turns the second factor on and shows the backup codes, once.
    // It is the request that turns it on: the password comes with it too (ST-20).
    .post('/account/two-factor/confirm', requireUser, jsonBody(confirmation), async (c) => {
      const { password, code } = c.req.valid('json');
      const denied = await reauthenticate(c.var.userId, password);
      if (denied) return c.json({ error: denied }, REAUTHENTICATION_STATUS[denied]);
      const owner = await twoFactor.ownerOf(c.var.userId);
      if (!owner) throw new Error('A signed-in User has no account');
      if (await twoFactor.isEnabled(owner.id)) {
        return c.json({ error: 'already_enabled' as const }, 409);
      }
      const sendSecurityEmail = await twoFactor.securityEmailTo(owner);
      const response = await native(c, VERIFY_TOTP_PATH, { code });
      if (response.status === 429) return c.json({ error: 'too_many_attempts' as const }, 429);
      // Never 401, which the SPA reads as a session ended from elsewhere.
      if (response.status === 401) return c.json({ error: 'invalid_code' as const }, 400);
      if (response.status === 400) return c.json({ error: 'not_started' as const }, 409);
      if (!response.ok) throw new Error(`Better Auth answered ${response.status} to a first code`);
      sendSecurityEmail('two_factor_enabled');
      const backupCodes = await twoFactor.backupCodes(owner.id);
      if (!backupCodes) throw new Error('A confirmed second factor has no backup codes');
      return c.json({ backupCodes }, 200);
    })
    .post('/account/two-factor/backup-codes', requireUser, jsonBody(passwordRequest), async (c) => {
      const { password } = c.req.valid('json');
      const denied = await reauthenticate(c.var.userId, password);
      if (denied) return c.json({ error: denied }, REAUTHENTICATION_STATUS[denied]);
      if (!(await twoFactor.isEnabled(c.var.userId))) {
        return c.json({ error: 'not_enabled' as const }, 409);
      }
      const response = await native(c, GENERATE_BACKUP_CODES_PATH, { password });
      if (response.status === 429) return c.json({ error: 'too_many_attempts' as const }, 429);
      if (!response.ok)
        throw new Error(`Better Auth answered ${response.status} to new backup codes`);
      return c.json(
        { backupCodes: nativeBackupCodes.parse(await response.json()).backupCodes },
        200,
      );
    })
    .post('/account/two-factor/disable', requireUser, jsonBody(passwordRequest), async (c) => {
      const { password } = c.req.valid('json');
      const denied = await reauthenticate(c.var.userId, password);
      if (denied) return c.json({ error: denied }, REAUTHENTICATION_STATUS[denied]);
      const owner = await twoFactor.ownerOf(c.var.userId);
      if (!owner) throw new Error('A signed-in User has no account');
      if (!(await twoFactor.isEnabled(owner.id))) {
        return c.json({ error: 'not_enabled' as const }, 409);
      }
      const sendSecurityEmail = await twoFactor.securityEmailTo(owner);
      const response = await native(c, DISABLE_TWO_FACTOR_PATH, { password });
      if (response.status === 429) return c.json({ error: 'too_many_attempts' as const }, 429);
      if (!response.ok)
        throw new Error(`Better Auth answered ${response.status} to turning it off`);
      sendSecurityEmail('two_factor_disabled');
      return c.body(null, 204);
    })
    // Connected devices (spec UX §5.9). Ending a session is not a sensitive action: no password is asked.
    .get('/sessions', requireUser, async (c) =>
      c.json({ sessions: await listSessions(c.var.userId, c.var.sessionId, clock.now()) }, 200),
    )
    .post('/sessions/revoke-others', requireUser, async (c) => {
      await revokeOtherSessions(c.var.userId, c.var.sessionId);
      return c.body(null, 204);
    })
    .post('/sessions/:id/revoke', requireUser, async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'invalid' as const }, 400);
      // Another User's session, the current one and an unknown id answer alike.
      return (await revokeSession(c.var.userId, c.var.sessionId, id.data))
        ? c.body(null, 204)
        : c.json({ error: 'not_found' as const }, 404);
    });

  const jobs: Job[] = [
    {
      name: 'purge unverified sign-ups',
      async run() {
        const purged = await signup.purgeUnverified();
        if (purged > 0) logger.info({ purged }, 'unverified sign-ups purged');
      },
    },
    {
      name: 'purge expired sessions and counters',
      async run() {
        const purged = {
          ...(await purgeExpiredSessionsAndCounters(clock.now())),
          loginAttempts: await loginAttempts.purgeExpired(),
          resetLinks: await passwords.purgeExpiredLinks(),
          emailChangeLinks: await emailChange.purgeExpiredLinks(),
          secondFactorChallenges: await twoFactor.purgeExpiredChallenges(),
        };
        if (Object.values(purged).some((count) => count > 0)) {
          logger.info({ purged }, 'expired sessions and counters purged');
        }
      },
    },
  ];

  return { routes, requireUser, jobs };
}
