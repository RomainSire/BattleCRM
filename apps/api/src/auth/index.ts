import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@battlecrm/contract';
import { locales } from '@battlecrm/i18n/runtime';
import { Hono, type Context } from 'hono';
import { setSignedCookie } from 'hono/cookie';
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
import { createBetterAuth, SIGN_IN_PATH, SIGN_OUT_PATH, type BetterAuth } from './better-auth.ts';
import type { Hibp } from './hibp.ts';
import { createDevices } from './devices.ts';
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
const verifyRequest = z.object({ token: linkToken });
const signInRequest = z.object({
  email: emailAddress,
  // Not the rule of the sign-up: a password too short is a wrong password like any other.
  password: currentPassword,
});
const passwordResetRequest = z.object({ email: emailAddress });
const passwordResetCompletion = z.object({ token: linkToken, password: chosenPassword });
/** A sensitive request: `password` is the current one, checked every time (ST-20). */
const passwordChangeRequest = z.object({
  password: currentPassword,
  newPassword: chosenPassword,
});

const PASSWORD_REFUSAL_STATUS = {
  password_compromised: 400,
  password_check_unavailable: 503,
} as const;
/** What Better Auth answers a sign-in with; its session token stays out of our own answer. */
const nativeSignIn = z.object({ user: z.object({ id: z.string(), email: z.string() }) });

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

  const passwords = createPasswords({
    config,
    clock,
    random,
    logger,
    hibp,
    sendEmail,
    loginAttempts,
    hashPassword,
  });

  // Tickets 10 and 11 put it in front of their own sensitive routes.
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
  async function native(c: Context<AppEnv>, path: string, body: unknown): Promise<Response> {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    for (const name of ['Origin', 'Cookie', 'User-Agent']) {
      const value = c.req.header(name);
      if (value !== undefined) headers.set(name, value);
    }
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
    .post('/signup/verify', jsonBody(verifyRequest), async (c) => {
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
      const { user } = nativeSignIn.parse(await response.json());
      c.set('userId', user.id);
      await devices.signedIn(c, user);
      return c.json({ email: user.email }, 200);
    })
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
        const status = { invalid_link: 400, ...PASSWORD_REFUSAL_STATUS } as const;
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
        };
        if (Object.values(purged).some((count) => count > 0)) {
          logger.info({ purged }, 'expired sessions and counters purged');
        }
      },
    },
  ];

  return { routes, requireUser, jobs };
}
