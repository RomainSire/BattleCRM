import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@battlecrm/contract';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api';
import { twoFactor as twoFactorPlugin } from 'better-auth/plugins/two-factor';
import type { Logger } from 'pino';

import type { Clock } from '../clock.ts';
import type { Config } from '../config.ts';
import type { Database } from '../db/index.ts';
import type { Random } from '../random.ts';
import { LOGIN_WINDOW_MS, type LoginAttempts } from './login-attempts.ts';
import { account, rateLimit, session, twoFactor, user, verification } from './tables.ts';

const DAY = 24 * 60 * 60;

export const SIGN_IN_PATH = '/sign-in/email';
export const SIGN_OUT_PATH = '/sign-out';
/** The second step of a sign-in: a code of the authenticator app, or a backup code. */
export const VERIFY_TOTP_PATH = '/two-factor/verify-totp';
export const VERIFY_BACKUP_CODE_PATH = '/two-factor/verify-backup-code';
/** Called by our own account routes only, behind a reauthentication: none of them is on the allowlist. */
export const ENABLE_TWO_FACTOR_PATH = '/two-factor/enable';
export const DISABLE_TWO_FACTOR_PATH = '/two-factor/disable';
export const GENERATE_BACKUP_CODES_PATH = '/two-factor/generate-backup-codes';
/** The cookie the plugin leaves between the password and the code: it names the challenge, in `verification`. */
export const TWO_FACTOR_CHALLENGE_COOKIE = 'two_factor';

/**
 * Native Better Auth endpoints reachable from outside, as `METHOD /path` under /api/auth (ADR 0010).
 * Anything else answers 404; opening one means giving it a route in `index.ts`, adding it here
 * and updating the routes snapshot.
 */
export const ALLOWED_NATIVE_ROUTES: readonly string[] = [
  `POST ${SIGN_IN_PATH}`,
  `POST ${SIGN_OUT_PATH}`,
  `POST ${VERIFY_BACKUP_CODE_PATH}`,
  `POST ${VERIFY_TOTP_PATH}`,
];

/** Refused by the limiter of an address (ours) or of an IP address (Better Auth's): both answer 429. */
const TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS';

export type BetterAuthDependencies = {
  config: Config;
  clock: Clock;
  random: Random;
  logger: Logger;
  loginAttempts: LoginAttempts;
};

export type BetterAuth = ReturnType<typeof createBetterAuth>;

/** Better Auth as the core: sessions, sign-in, password hashing and the second factor; the journeys are written around it (ADR 0010). */
export function createBetterAuth(db: Database, dependencies: BetterAuthDependencies) {
  return betterAuth(betterAuthOptions(db, dependencies));
}

/** Apart from `createBetterAuth`, only a test reads them: to prove a hook on an endpoint of its own. */
export function betterAuthOptions(
  db: Database,
  { config, clock, random, logger, loginAttempts }: BetterAuthDependencies,
) {
  return {
    appName: 'BattleCRM',
    baseURL: config.appOrigin,
    basePath: '/api/auth',
    secret: config.authSecret,
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification, rateLimit, twoFactor },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      // Should the native sign-up ever be reached, the account it invents for an address already taken
      // carries an id shaped like a real one (ST-13).
      customSyntheticUser: ({ coreFields, additionalFields }) => ({
        ...coreFields,
        ...additionalFields,
        id: uuidv7(clock.now(), random),
      }),
    },
    session: {
      // Opaque, in the database, sliding: 90 days after the last activity, known to the day (ST-16).
      expiresIn: 90 * DAY,
      updateAge: DAY,
      // A revoked session stops working at once.
      cookieCache: { enabled: false },
    },
    // Better Auth would erase every expired row of `verification` each time it reads one, by the system
    // clock: the scheduled purge does it instead, by ours, and only for the rows it knows.
    verification: { disableCleanup: true },
    // TOTP and 10 single-use backup codes, kept encrypted (ST-18).
    plugins: [twoFactorPlugin()],
    // By IP address, counted in the database: 30 sign-in attempts, and as many codes, per 15 minutes (ST-15).
    // The address is the one `index.ts` hands over, resolved from Traefik's by `client-ip.ts`.
    rateLimit: {
      enabled: true,
      storage: 'database',
      // The plugin's own rule for a code, 3 per 10 seconds, would stop a User on three quick typos:
      // codes get the rule of the sign-in they belong to, next to the counters by address.
      customRules: {
        [SIGN_IN_PATH]: { window: LOGIN_WINDOW_MS / 1000, max: 30 },
        '/two-factor/*': { window: LOGIN_WINDOW_MS / 1000, max: 30 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const body: unknown = ctx.body;
        const email = ctx.path === SIGN_IN_PATH ? emailOf(body) : undefined;
        // By address, before the password is looked at: a blocked address learns nothing more.
        if (email !== undefined && !(await loginAttempts.admit(email))) {
          throw new APIError('TOO_MANY_REQUESTS', { code: TOO_MANY_ATTEMPTS });
        }
        // No server option turns "trust this device" off: a second factor is asked at every sign-in.
        return typeof body === 'object' && body !== null && 'trustDevice' in body
          ? { context: { body: { ...body, trustDevice: false } } }
          : undefined;
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_IN_PATH || isAPIError(ctx.context.returned)) return;
        // A right password proves half of an account with a second factor: its failures stay counted
        // until the code is right too, or every sign-in would give a fresh run at the codes.
        const opened = ctx.context.newSession;
        if (!opened || opened.user['twoFactorEnabled'] === true) return;
        const email = emailOf(ctx.body);
        if (email !== undefined) await loginAttempts.succeeded(email);
      }),
    },
    advanced: {
      // The database generates every id (uuidv7).
      database: { generateId: false },
      // `__Secure-` even on http://localhost, which browsers treat as secure.
      useSecureCookies: true,
      cookiePrefix: 'battlecrm',
      // Lax, not Strict: the User arrives from the link of an e-mail.
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
    // Into the API's own log, one JSON line each. Errors only, and their message alone: a refused sign-in
    // is no event, and the lower levels name addresses.
    logger: {
      level: 'error',
      log: (level, message) => logger[level]({ source: 'better-auth' }, message),
    },
    telemetry: { enabled: false },
  } satisfies BetterAuthOptions;
}

/** The address a sign-in names, as the counters know it: lower case, as Better Auth looks it up. */
function emailOf(body: unknown): string | undefined {
  return typeof body === 'object' &&
    body !== null &&
    'email' in body &&
    typeof body.email === 'string'
    ? body.email.toLowerCase()
    : undefined;
}

/** A UUID v7, as the database generates them. */
function uuidv7(now: Date, random: Random): string {
  const bytes = random.bytes(16);
  bytes.writeUIntBE(now.getTime(), 0, 6);
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x70, 6);
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
