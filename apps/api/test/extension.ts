import { z } from 'zod';

import { MIN_EXTENSION_VERSION } from '../src/client-version.ts';
import type { testApp } from './app.ts';
import { randomIp } from './http.ts';

type Harness = ReturnType<typeof testApp>;
type App = Harness['app'];

/** The origin Firefox gives the extension in one profile: a uuid of its own drawing. */
export const EXTENSION_ORIGIN = 'moz-extension://0b8e1f3a-6c2d-4f7e-9a1b-2c3d4e5f6a7b';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0';

/**
 * A request as the background of the extension sends it (spec extension §8): `credentials: 'omit'`, so
 * no cookie; its token as `Authorization: Bearer`, `X-Client`, and `Origin` on a POST only, as Firefox does.
 * A body makes it a POST: JSON, or a file joined as the SPA joins one.
 */
export function extensionRequest(
  app: App,
  path: string,
  { token, body, ip = randomIp() }: { token?: string; body?: unknown; ip?: string } = {},
) {
  const post = body !== undefined;
  const form = new FormData();
  if (body instanceof File) form.set('file', body);
  return app.request(
    path,
    {
      method: post ? 'POST' : 'GET',
      headers: {
        'X-Client': `extension/${MIN_EXTENSION_VERSION}`,
        'User-Agent': FIREFOX,
        'X-Forwarded-For': ip,
        ...(post ? { Origin: EXTENSION_ORIGIN } : {}),
        ...(post && !(body instanceof File) ? { 'Content-Type': 'application/json' } : {}),
        ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      },
      ...(post ? { body: body instanceof File ? form : JSON.stringify(body) } : {}),
    },
    { incoming: { socket: { remoteAddress: '172.18.0.2' } } },
  );
}

/** What the extension keeps after its sign-in: the token of a session of its own. */
export async function extensionTokenOf(
  harness: Harness,
  { email, password }: { email: string; password: string },
): Promise<string> {
  const response = await extensionRequest(harness.app, '/api/auth/sign-in/email', {
    body: { email, password },
  });
  if (response.status !== 200)
    throw new Error(`The extension's sign-in answered ${response.status}`);
  return z.object({ token: z.string().min(1) }).parse(await response.json()).token;
}
