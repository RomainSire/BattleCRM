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
import { createLoginAttempts } from './login-attempts.ts';
import { purgeExpiredSessionsAndCounters } from './purge.ts';
import { createSignup, type OnAccountCreated } from './signup.ts';

export { haveIBeenPwned, type Hibp } from './hibp.ts';
export type { AccountCreated, OnAccountCreated } from './signup.ts';

const NATIVE_BASE_PATH = '/api/auth';

const signupRequest = z.object({
  // Lower case, as Better Auth looks an address up.
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  // No other rule than the length (spec stack §7).
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  locale: z.enum(locales),
  /** Detected by the browser; one the API does not know falls back to UTC rather than blocking the sign-up. */
  timeZone: z
    .string()
    .max(100)
    .transform((value) => (isTimeZone(value) ? value : 'UTC')),
});
const resendRequest = z.object({ attemptId: z.uuid() });
const verifyRequest = z.object({ token: z.string().min(1).max(200) });
const signInRequest = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  // Not the rule of the sign-up: a password too short is a wrong password like any other.
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
/** What Better Auth answers a sign-in with; its session token stays out of our own answer. */
const nativeSignIn = z.object({ user: z.object({ id: z.string(), email: z.string() }) });

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

  const signup = createSignup({
    config,
    clock,
    random,
    logger,
    hibp,
    sendEmail,
    onAccountCreated,
    hashPassword: async (password) => (await betterAuthContext()).password.hash(password),
  });

  /** The session of a request, read in the database every time; slides its expiry and its cookie. */
  async function readSession(c: Context<AppEnv>) {
    const auth = await betterAuth();
    const { headers, response } = await auth.api.getSession({
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    for (const cookie of headers.getSetCookie()) c.header('Set-Cookie', cookie, { append: true });
    return response?.user;
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

  const requireUser = createMiddleware<AppEnv>(async (c, next) => {
    const user = await readSession(c);
    if (!user) return c.json({ error: 'unauthenticated' }, 401);
    c.set('userId', user.id);
    return next();
  });

  // Chained, so that AppType carries them to the SPA's typed client.
  const routes = new Hono<AppEnv>()
    .get('/config', (c) => c.json({ signupsOpen: config.signupsOpen }))
    .get('/session', async (c) => {
      const user = await readSession(c);
      if (!user) return c.json({ error: 'unauthenticated' as const }, 401);
      c.set('userId', user.id);
      return c.json({ email: user.email }, 200);
    })
    .post('/signup', jsonBody(signupRequest), async (c) => {
      const outcome = await signup.start(c.req.valid('json'));
      if ('attemptId' in outcome) return c.json(outcome, 202);
      const status = {
        signups_closed: 403,
        password_compromised: 400,
        password_check_unavailable: 503,
      } as const;
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
      return c.json({ email: user.email }, 200);
    })
    // This device only, whether it had a session or not.
    .post(`/auth${SIGN_OUT_PATH}`, async (c) => {
      const response = await native(c, SIGN_OUT_PATH, {});
      if (!response.ok) throw new Error(`Better Auth answered ${response.status} to a sign-out`);
      return c.body(null, 204);
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
        };
        if (Object.values(purged).some((count) => count > 0)) {
          logger.info({ purged }, 'expired sessions and counters purged');
        }
      },
    },
  ];

  return { routes, requireUser, jobs };
}
