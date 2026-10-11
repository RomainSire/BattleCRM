import { createBetterAuth } from '../src/auth/better-auth.ts';
import { withoutIsolation } from '../src/db/index.ts';
import { testConfig } from './app.ts';

/**
 * Better Auth as the API configures it, on the test database: what a test asks to know
 * what Better Auth itself makes of a cookie or a password. The app never hands its own out.
 */
export const testBetterAuth = () =>
  withoutIsolation((db) => Promise.resolve(createBetterAuth(db, testConfig)));
