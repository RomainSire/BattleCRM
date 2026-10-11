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
import {
  ALLOWED_NATIVE_ROUTES,
  createBetterAuth,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type BetterAuth,
} from './better-auth.ts';
import type { Hibp } from './hibp.ts';
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
  let instance: Promise<BetterAuth> | undefined;
  const betterAuth = () =>
    (instance ??= withoutIsolation((db) => Promise.resolve(createBetterAuth(db, config))));
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
    // Better Auth's own handler, behind the allowlist: any other native endpoint answers 404.
    .all('/auth/*', async (c) => {
      const route = `${c.req.method} ${c.req.path.slice(NATIVE_BASE_PATH.length)}`;
      if (!ALLOWED_NATIVE_ROUTES.includes(route)) return c.notFound();
      return (await betterAuth()).handler(c.req.raw);
    });

  const jobs: Job[] = [
    {
      name: 'purge unverified sign-ups',
      async run() {
        const purged = await signup.purgeUnverified();
        if (purged > 0) logger.info({ purged }, 'unverified sign-ups purged');
      },
    },
  ];

  return { routes, requireUser, jobs };
}
