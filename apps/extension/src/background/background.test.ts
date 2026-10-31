import { describe, expect, test } from 'vitest';

import { fakeApi } from '../../test/fake-api.ts';
import { createBackground, type Storage } from './background.ts';

const APP_ORIGIN = 'https://app.battlecrm.test';
const SESSION = 'GET /api/session';

/** What `browser.storage.local` keeps, in memory: it outlives the background, as in Firefox. */
function memoryStorage(): Storage {
  const items = new Map<string, unknown>();
  return {
    get: async (keys) =>
      Object.fromEntries(keys.filter((key) => items.has(key)).map((key) => [key, items.get(key)])),
    set: async (values) => {
      for (const [key, value] of Object.entries(values)) items.set(key, value);
    },
    remove: async (keys) => {
      for (const key of keys) items.delete(key);
    },
  };
}

/** A background as Firefox wakes it up: a new one each time, on the same storage. */
function wake(api: ReturnType<typeof fakeApi>, storage = memoryStorage()) {
  return createBackground({ appOrigin: APP_ORIGIN, version: '0.7.0', storage, fetch: api.fetch });
}

describe('session', () => {
  test('without a token, asks the API as the extension, without credentials, and is signed out', async () => {
    const api = fakeApi({
      [SESSION]: () => Response.json({ error: 'unauthenticated' }, { status: 401 }),
    });

    expect(await wake(api).handle({ type: 'session' })).toEqual({ status: 'signedOut' });

    const sent = api.last(SESSION);
    expect(sent?.request.url).toBe(`${APP_ORIGIN}/api/session`);
    expect(sent?.request.headers.get('X-Client')).toBe('extension/0.7.0');
    expect(sent?.request.headers.get('Authorization')).toBeNull();
    expect(sent?.init?.credentials).toBe('omit');
  });
});

const SIGN_IN = 'POST /api/auth/sign-in/email';
const TOTP = 'POST /api/auth/two-factor/verify-totp';
const BACKUP_CODE = 'POST /api/auth/two-factor/verify-backup-code';
const SIGN_OUT = 'POST /api/auth/sign-out';
const PASSWORD = 'correct horse battery staple';

/** An API that refuses every sign-in with this error. */
const refusing = (error: string, status: number) =>
  fakeApi({ [SIGN_IN]: () => Response.json({ error }, { status }) });
const verified = () => Response.json({ email: 'jane@example.com', token: 'token-1' });
const outdated = () => Response.json({ error: 'extension_outdated' }, { status: 426 });

/** The API of a signed-in User: a session that answers for the token it gave. */
function signedInApi(handlers: Parameters<typeof fakeApi>[0] = {}) {
  return fakeApi({
    [SIGN_IN]: () => Response.json({ email: 'jane@example.com', token: 'token-1' }),
    [SESSION]: (request) =>
      request.headers.get('Authorization') === 'Bearer token-1'
        ? Response.json({ email: 'jane@example.com' })
        : Response.json({ error: 'unauthenticated' }, { status: 401 }),
    ...handlers,
  });
}

describe('signIn', () => {
  test('keeps the token, which the next wake-up sends as Bearer', async () => {
    const api = signedInApi();
    const storage = memoryStorage();

    expect(
      await wake(api, storage).handle({
        type: 'signIn',
        email: 'jane@example.com',
        password: PASSWORD,
      }),
    ).toEqual({ status: 'signedIn', email: 'jane@example.com' });
    expect(await api.last(SIGN_IN)?.request.json()).toEqual({
      email: 'jane@example.com',
      password: PASSWORD,
    });

    expect(await wake(api, storage).handle({ type: 'session' })).toEqual({
      status: 'signedIn',
      email: 'jane@example.com',
    });
    expect(api.last(SESSION)?.request.headers.get('Authorization')).toBe('Bearer token-1');
  });

  test('a wrong password or too many attempts is refused, nothing kept', async () => {
    const storage = memoryStorage();
    expect(
      await wake(refusing('invalid_credentials', 401), storage).handle({
        type: 'signIn',
        email: 'jane@example.com',
        password: 'wrong',
      }),
    ).toEqual({ status: 'refused', error: 'invalid_credentials' });
    expect(
      await wake(refusing('too_many_attempts', 429), storage).handle({
        type: 'signIn',
        email: 'jane@example.com',
        password: 'wrong',
      }),
    ).toEqual({ status: 'refused', error: 'too_many_attempts' });
    expect(await storage.get(['token'])).toEqual({});
  });

  test('with a second factor, the code goes with the challenge to the endpoint of its kind', async () => {
    const storage = memoryStorage();
    const api = signedInApi({
      [SIGN_IN]: () => Response.json({ twoFactorRequired: true, challenge: 'challenge-1' }),
      [TOTP]: verified,
      [BACKUP_CODE]: verified,
    });

    expect(
      await wake(api, storage).handle({
        type: 'signIn',
        email: 'jane@example.com',
        password: PASSWORD,
      }),
    ).toEqual({ status: 'codeRequired' });
    // Firefox may stop the background while the User looks for the code.
    expect(await wake(api, storage).handle({ type: 'verifyCode', code: '123 456' })).toEqual({
      status: 'signedIn',
      email: 'jane@example.com',
    });
    expect(await api.last(TOTP)?.request.json()).toEqual({
      code: '123 456',
      challenge: 'challenge-1',
    });
    expect(await wake(api, storage).handle({ type: 'session' })).toEqual({
      status: 'signedIn',
      email: 'jane@example.com',
    });

    await wake(api, storage).handle({
      type: 'signIn',
      email: 'jane@example.com',
      password: PASSWORD,
    });
    await wake(api, storage).handle({ type: 'verifyCode', code: 'abcd-efgh' });
    expect(await api.last(BACKUP_CODE)?.request.json()).toEqual({
      code: 'abcd-efgh',
      challenge: 'challenge-1',
    });
  });

  test('a wrong code is refused; an ended challenge says so', async () => {
    const storage = memoryStorage();
    const api = fakeApi({
      [SIGN_IN]: () => Response.json({ twoFactorRequired: true, challenge: 'challenge-1' }),
      [TOTP]: async (request) =>
        Response.json(
          {
            error: (await request.json()).code === '000000' ? 'challenge_expired' : 'invalid_code',
          },
          { status: 401 },
        ),
    });
    await wake(api, storage).handle({
      type: 'signIn',
      email: 'jane@example.com',
      password: PASSWORD,
    });

    expect(await wake(api, storage).handle({ type: 'verifyCode', code: '111111' })).toEqual({
      status: 'refused',
      error: 'invalid_code',
    });
    expect(await wake(api, storage).handle({ type: 'verifyCode', code: '000000' })).toEqual({
      status: 'refused',
      error: 'challenge_expired',
    });
  });
});

describe('the session ends or cannot be told', () => {
  test('a 401 to the token held ends it: expired, with the address, the token gone', async () => {
    const storage = memoryStorage();
    await wake(signedInApi(), storage).handle({
      type: 'signIn',
      email: 'jane@example.com',
      password: PASSWORD,
    });
    // Signed out from “Connected devices” in the app.
    const api = fakeApi({
      [SESSION]: () => Response.json({ error: 'unauthenticated' }, { status: 401 }),
    });

    expect(await wake(api, storage).handle({ type: 'session' })).toEqual({
      status: 'expired',
      email: 'jane@example.com',
    });
    expect(await wake(api, storage).handle({ type: 'session' })).toEqual({
      status: 'expired',
      email: 'jane@example.com',
    });
    expect(api.last(SESSION)?.request.headers.get('Authorization')).toBeNull();
  });

  test('426: the extension is outdated, whatever it asks', async () => {
    const api = fakeApi({ [SESSION]: outdated, [SIGN_IN]: outdated });

    expect(await wake(api).handle({ type: 'session' })).toEqual({ status: 'outdated' });
    expect(
      await wake(api).handle({ type: 'signIn', email: 'jane@example.com', password: PASSWORD }),
    ).toEqual({ status: 'outdated' });
  });

  test('no answer or a 5xx: unreachable, the session kept for later', async () => {
    const storage = memoryStorage();
    await wake(signedInApi(), storage).handle({
      type: 'signIn',
      email: 'jane@example.com',
      password: PASSWORD,
    });
    const failing = fakeApi({ [SESSION]: () => new Response('Bad Gateway', { status: 502 }) });
    const down = signedInApi();
    down.down();

    expect(await wake(failing, storage).handle({ type: 'session' })).toEqual({
      status: 'unreachable',
    });
    expect(await wake(down, storage).handle({ type: 'session' })).toEqual({
      status: 'unreachable',
    });
    expect(await wake(signedInApi(), storage).handle({ type: 'session' })).toEqual({
      status: 'signedIn',
      email: 'jane@example.com',
    });
  });

  test('without a network, a sign-in fails as an error', async () => {
    const api = signedInApi();
    api.down();

    expect(
      await wake(api).handle({ type: 'signIn', email: 'jane@example.com', password: PASSWORD }),
    ).toEqual({ status: 'refused', error: 'error' });
  });
});

describe('signOut', () => {
  test('revokes the session on the API, then forgets the token and the address', async () => {
    const storage = memoryStorage();
    const api = signedInApi({ [SIGN_OUT]: () => new Response(null, { status: 204 }) });
    await wake(api, storage).handle({
      type: 'signIn',
      email: 'jane@example.com',
      password: PASSWORD,
    });

    expect(await wake(api, storage).handle({ type: 'signOut' })).toBeNull();

    expect(api.last(SIGN_OUT)?.request.headers.get('Authorization')).toBe('Bearer token-1');
    expect(await wake(api, storage).handle({ type: 'session' })).toEqual({ status: 'signedOut' });
  });

  test('without a network, the extension forgets the session all the same', async () => {
    const storage = memoryStorage();
    const api = signedInApi();
    await wake(api, storage).handle({
      type: 'signIn',
      email: 'jane@example.com',
      password: PASSWORD,
    });
    api.down();

    expect(await wake(api, storage).handle({ type: 'signOut' })).toBeNull();

    expect(await storage.get(['token', 'email'])).toEqual({});
  });
});
