import { getAuthTables } from 'better-auth/db';
import { getTableColumns } from 'drizzle-orm';
import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { testBetterAuth } from '../../test/better-auth.ts';
import { ALLOWED_NATIVE_ROUTES } from './better-auth.ts';
import { account, session, user, verification } from './tables.ts';

const tables = { account, session, user, verification };

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

test('the allowlist only names routes that exist', async () => {
  const routes = await nativeRoutes();

  for (const allowed of ALLOWED_NATIVE_ROUTES) expect(routes).toContain(allowed);
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
