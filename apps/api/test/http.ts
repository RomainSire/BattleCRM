import { testConfig, type testApp } from './app.ts';

type App = ReturnType<typeof testApp>['app'];

/** A JSON POST as the SPA sends it: same origin, with the session cookie if any. */
export function postJson(app: App, path: string, body: unknown, cookie?: string) {
  return app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: testConfig.appOrigin,
      ...(cookie === undefined ? {} : { Cookie: cookie }),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** The `name=value` pairs a browser would send back after this response. */
export function cookiesOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}
