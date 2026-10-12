import { randomInt } from 'node:crypto';

import { testConfig, type testApp } from './app.ts';

type App = ReturnType<typeof testApp>['app'];

/** An address nobody else uses: the limiter by IP counts in the database, which every test shares. */
export const randomIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

/**
 * A JSON POST as the SPA sends it: same origin, with the session cookie if any,
 * through Traefik, which forwards the address of the client (its own by default).
 */
export function postJson(
  app: App,
  path: string,
  body: unknown,
  cookie?: string,
  { ip = randomIp(), userAgent }: { ip?: string; userAgent?: string } = {},
) {
  return app.request(
    path,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: testConfig.appOrigin,
        'X-Forwarded-For': ip,
        ...(cookie === undefined ? {} : { Cookie: cookie }),
        ...(userAgent === undefined ? {} : { 'User-Agent': userAgent }),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    behindTraefik,
  );
}

/** What @hono/node-server binds: the peer is Traefik, inside TRUSTED_PROXIES. */
const behindTraefik = { incoming: { socket: { remoteAddress: '172.18.0.2' } } };

/** The cookie that tells a device from another, as a browser keeps it across sign-outs. */
export const DEVICE_COOKIE = '__Host-battlecrm.device';

/** The device cookie among the `name=value` pairs a browser holds, or `''`. */
export function deviceCookie(cookies: string): string {
  return cookies.split('; ').find((pair) => pair.startsWith(`${DEVICE_COOKIE}=`)) ?? '';
}

/** The `name=value` pairs a browser would send back after this response. */
export function cookiesOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}
