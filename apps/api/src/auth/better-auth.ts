import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@battlecrm/contract';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import type { Config } from '../config.ts';
import type { Database } from '../db/index.ts';
import { account, session, user, verification } from './tables.ts';

const DAY = 24 * 60 * 60;

/**
 * Native Better Auth endpoints reachable from outside, as `METHOD /path` under /api/auth (ADR 0010).
 * Anything else answers 404; opening one means adding it here and updating the routes snapshot.
 */
export const ALLOWED_NATIVE_ROUTES: readonly string[] = [];

export type BetterAuth = ReturnType<typeof createBetterAuth>;

/** Better Auth as the core: sessions and password hashing; the journeys are written around it (ADR 0010). */
export function createBetterAuth(db: Database, config: Config) {
  return betterAuth({
    appName: 'BattleCRM',
    baseURL: config.appOrigin,
    basePath: '/api/auth',
    secret: config.authSecret,
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
    },
    session: {
      // Opaque, in the database, sliding: 90 days after the last activity, known to the day (ST-16).
      expiresIn: 90 * DAY,
      updateAge: DAY,
      // A revoked session stops working at once.
      cookieCache: { enabled: false },
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
    telemetry: { enabled: false },
  });
}
