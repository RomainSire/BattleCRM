import { expect, test } from 'vitest';

import { testApp } from '../test/app.ts';
import { MIN_EXTENSION_VERSION } from './client-version.ts';

/** Every route the app serves, as `METHOD /path`; a middleware (`ALL` on a wildcard) is no route. */
function inventory() {
  const { app } = testApp();
  const routes = app.routes
    .filter((route) => !(route.method === 'ALL' && route.path.endsWith('*')))
    .map((route) => `${route.method} ${route.path}`);
  return { app, routes: [...new Set(routes)].toSorted() };
}

/** What a visitor may reach: a route joins this list on purpose, never by forgetting `requireUser`. */
const PUBLIC_ROUTES = [
  'GET /api/config',
  'GET /api/health',
  'POST /api/auth/sign-in/email',
  'POST /api/auth/sign-out',
  'POST /api/auth/two-factor/verify-backup-code',
  'POST /api/auth/two-factor/verify-totp',
  'POST /api/password-reset',
  'POST /api/password-reset/complete',
  'POST /api/signup',
  'POST /api/signup/resend',
  'POST /api/signup/verify',
  'POST /api/two-factor-recovery',
  'POST /api/two-factor-recovery/cancel',
];

test('the public routes all exist', () => {
  const { routes } = inventory();

  for (const route of PUBLIC_ROUTES) expect(routes).toContain(route);
});

/**
 * A session nobody opened, as each of the two ways a session travels would carry it (ST-90): the SPA's
 * cookie, or the Firefox extension's token, without any cookie.
 */
const FORGED = {
  cookie: {
    Origin: 'https://app.battlecrm.test',
    Cookie: '__Secure-battlecrm.session_token=forged.forged',
  },
  bearer: {
    Origin: 'moz-extension://0b8e1f3a-6c2d-4f7e-9a1b-2c3d4e5f6a7b',
    'X-Client': `extension/${MIN_EXTENSION_VERSION}`,
    Authorization: 'Bearer forged.forged',
  },
};

// Generated from the app itself: a new route is covered the day it is written (spec stack §13).
test.each(['cookie', 'bearer'] as const)(
  'without a session, every other route answers 401 or 404, with nothing set (%s)',
  async (mode) => {
    const { app, routes } = inventory();
    const guarded = routes.filter((route) => !PUBLIC_ROUTES.includes(route));
    expect(guarded).toContain('GET /api/session');
    expect(guarded).toContain('POST /api/client-errors');

    for (const route of guarded) {
      const [verb = 'GET', path = ''] = route.split(' ');
      const method = verb === 'ALL' ? 'GET' : verb;
      const response = await app.request(
        path.replaceAll(/:\w+/g, '00000000-0000-7000-8000-000000000000'),
        {
          method,
          headers: {
            ...FORGED[mode],
            ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }),
          },
          ...(method === 'GET' ? {} : { body: JSON.stringify({}) }),
        },
      );

      expect([401, 404], `${route} answered ${response.status}`).toContain(response.status);
      expect(response.headers.getSetCookie().join('\n')).not.toMatch(/session_token=[^;]/);
      expect(response.headers.get('set-auth-token')).toBeNull();
    }
  },
);
