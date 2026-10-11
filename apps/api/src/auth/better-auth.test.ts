import { betterAuth } from 'better-auth';
import { createAuthEndpoint } from 'better-auth/api';
import { getAuthTables } from 'better-auth/db';
import { getTableColumns } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { testBetterAuth, testBetterAuthOptions } from '../../test/better-auth.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { ALLOWED_NATIVE_ROUTES } from './better-auth.ts';
import { account, rateLimit, session, user, verification } from './tables.ts';

const tables = { account, rateLimit, session, user, verification };

type Endpoint = { path?: string; options?: { method?: string | string[] } };

/** Every HTTP endpoint the installed Better Auth would serve, as `METHOD /path`. */
async function nativeRoutes() {
  const auth = await testBetterAuth();
  return Object.values(auth.api as Record<string, Endpoint>)
    .filter((endpoint) => endpoint.path !== undefined)
    .flatMap((endpoint) =>
      [endpoint.options?.method ?? 'GET'].flat().map((method) => `${method} ${endpoint.path}`),
    )
    .toSorted();
}

// Reread this list, and the allowlist, at every upgrade of Better Auth (ADR 0010).
test('the native routes of Better Auth are the ones we know', async () => {
  expect(await nativeRoutes()).toMatchInlineSnapshot(`
    [
      "GET /account-info",
      "GET /callback/:id",
      "GET /delete-user/callback",
      "GET /error",
      "GET /get-session",
      "GET /list-accounts",
      "GET /list-sessions",
      "GET /ok",
      "GET /reset-password/:token",
      "GET /verify-email",
      "POST /callback/:id",
      "POST /change-email",
      "POST /change-password",
      "POST /delete-user",
      "POST /get-access-token",
      "POST /get-session",
      "POST /link-social",
      "POST /refresh-token",
      "POST /request-password-reset",
      "POST /reset-password",
      "POST /revoke-other-sessions",
      "POST /revoke-session",
      "POST /revoke-sessions",
      "POST /send-verification-email",
      "POST /sign-in/email",
      "POST /sign-in/social",
      "POST /sign-out",
      "POST /sign-up/email",
      "POST /unlink-account",
      "POST /update-session",
      "POST /update-user",
      "POST /verify-password",
    ]
  `);
});

test('a native route outside the allowlist answers 404, whatever Better Auth would do', async () => {
  const { app } = testApp();
  const routes = await nativeRoutes();
  expect(routes).toContain('POST /sign-up/email');

  for (const route of routes.filter((native) => !ALLOWED_NATIVE_ROUTES.includes(native))) {
    const [method = 'GET', path = ''] = route.split(' ');
    const response = await app.request(`/api/auth${path.replaceAll(/:\w+/g, 'x')}`, {
      method,
      ...(method === 'GET'
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }),
    });

    expect({ route, status: response.status }).toEqual({ route, status: 404 });
  }
});

test('the allowlist is signing in and signing out, which exist and are served', async () => {
  const { app } = testApp();
  const routes = await nativeRoutes();

  expect(ALLOWED_NATIVE_ROUTES).toEqual(['POST /sign-in/email', 'POST /sign-out']);
  for (const allowed of ALLOWED_NATIVE_ROUTES) {
    expect(routes).toContain(allowed);
    const response = await postJson(app, `/api/auth${allowed.replace('POST ', '')}`, {});
    expect({ allowed, status: response.status }).not.toEqual({ allowed, status: 404 });
  }
});

test('the limiter by IP address counts in the database, 30 sign-ins per 15 minutes', async () => {
  const auth = await testBetterAuth();

  expect(auth.options.rateLimit).toEqual({
    enabled: true,
    storage: 'database',
    customRules: { '/sign-in/email': { window: 900, max: 30 } },
  });
});

test('sessions are opaque, read in the database every time, and slide over 90 days', async () => {
  const auth = await testBetterAuth();

  expect(auth.options.session).toEqual({
    expiresIn: 90 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
    cookieCache: { enabled: false },
  });
});

// No server option turns "trust this device" off (spec stack §15): the hook is proved on an endpoint
// that answers the body it received, as the second factor's verifications will read theirs.
test('`trustDevice` is forced to false before any endpoint reads it', async () => {
  const options = await testBetterAuthOptions();
  const auth = betterAuth({
    ...options,
    plugins: [
      {
        id: 'probe',
        endpoints: {
          probe: createAuthEndpoint(
            '/probe',
            { method: 'POST', body: z.object({ code: z.string(), trustDevice: z.boolean() }) },
            async (ctx) => ctx.json(ctx.body),
          ),
        },
      },
    ],
  });
  const probe = (body: unknown) =>
    auth.handler(
      new Request('https://app.battlecrm.test/api/auth/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://app.battlecrm.test' },
        body: JSON.stringify(body),
      }),
    );

  const overHttp = await probe({ code: '123456', trustDevice: true });
  const direct = await auth.api.probe({ body: { code: '123456', trustDevice: true } });

  expect(await overHttp.json()).toEqual({ code: '123456', trustDevice: false });
  expect(direct).toEqual({ code: '123456', trustDevice: false });
});

// The native sign-up is off the allowlist; should it ever be reached, it tells nothing (ST-13).
test('the account Better Auth invents for an address already taken carries an id like a real one', async () => {
  const harness = testApp();
  const { email, password, userId } = await makeUser(harness);
  const auth = await testBetterAuth();

  const answer = await auth.api.signUpEmail({ body: { name: '', email, password } });

  const uuidv7 = /^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/;
  expect(userId).toMatch(uuidv7);
  expect(answer.user.id).toMatch(uuidv7);
  expect(answer.user.id).not.toBe(userId);
  expect(answer.token).toBeNull();
});

test('the Drizzle tables carry exactly the fields Better Auth expects', async () => {
  const auth = await testBetterAuth();
  const expected = getAuthTables(auth.options);

  expect(Object.keys(expected).toSorted()).toEqual(Object.keys(tables));
  for (const [model, table] of Object.entries(tables)) {
    expect({ model, fields: Object.keys(getTableColumns(table)).toSorted() }).toEqual({
      model,
      fields: ['id', ...Object.keys(expected[model]?.fields ?? {})].toSorted(),
    });
  }
});
