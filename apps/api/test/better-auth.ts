import { pino } from 'pino';

import { betterAuthOptions, createBetterAuth } from '../src/auth/better-auth.ts';
import { createLoginAttempts } from '../src/auth/login-attempts.ts';
import { withoutIsolation, type Database } from '../src/db/index.ts';
import { testConfig } from './app.ts';
import { scriptedRandom, testClock } from './doubles.ts';

/** What Better Auth is built from in a test: the test configuration, a clock of its own, no log. */
function dependencies() {
  const clock = testClock();
  return {
    config: testConfig,
    clock,
    random: scriptedRandom(),
    logger: pino({ enabled: false }),
    loginAttempts: createLoginAttempts({ clock }),
  };
}

/**
 * Better Auth as the API configures it, on the test database: what a test asks to know
 * what Better Auth itself makes of a cookie or a password. The app never hands its own out.
 */
export const testBetterAuth = () =>
  withoutIsolation((db) => Promise.resolve(createBetterAuth(db, dependencies())));

/** The options of that Better Auth, for a test that adds an endpoint of its own to them. */
export const testBetterAuthOptions = () =>
  withoutIsolation((db: Database) => Promise.resolve(betterAuthOptions(db, dependencies())));
