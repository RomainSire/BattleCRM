import { describe, expect, test } from 'vitest';

import { fakeApi } from '../../test/fake-api.ts';
import { createBackground, type Badge, type Storage } from './background.ts';

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

/** The badge of each tab, as the icon shows it. */
type Badges = Map<number, Badge>;

/** A background as Firefox wakes it up: a new one each time, on the same storage. */
function wake(
  api: ReturnType<typeof fakeApi>,
  storage = memoryStorage(),
  badges: Badges = new Map(),
) {
  return createBackground({
    appOrigin: APP_ORIGIN,
    version: '0.7.0',
    storage,
    fetch: api.fetch,
    setBadge: async (tabId, badge) => {
      badges.set(tabId, badge);
    },
  });
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

const PRESENCE = 'POST /api/contacts/presence';
const PROFILE = 'https://www.linkedin.com/in/ga%C3%ABtan-lef%C3%A8vre-b7c41e2d/';
const TAB = 7;

/** A signed-in background, its storage holding the token. */
async function signedIn(api: ReturnType<typeof fakeApi>, badges: Badges) {
  const storage = memoryStorage();
  await storage.set({ token: 'token-1', email: 'jane@example.com' });
  return wake(api, storage, badges);
}

describe('presence', () => {
  test('a profile that is a Contact: ✓ on the tab, and its Status, asked with the address of the tab only', async () => {
    const badges: Badges = new Map();
    let asked: unknown;
    const api = fakeApi({
      [PRESENCE]: async (request) => {
        const body: { linkedinUrls: string[] } = await request.json();
        asked = body;
        const { linkedinUrls } = body;
        return Response.json({
          matches: [{ linkedinUrl: linkedinUrls[0], contactId: 'c-1', status: 'ally' }],
        });
      },
    });

    expect(
      await (await signedIn(api, badges)).handle({ type: 'presence', url: PROFILE }, TAB),
    ).toEqual({ status: 'contact', contactId: 'c-1', contactStatus: 'ally' });
    expect(badges.get(TAB)).toBe('✓');
    expect(asked).toEqual({ linkedinUrls: [PROFILE] });
    expect(api.last(PRESENCE)?.request.headers.get('Authorization')).toBe('Bearer token-1');
  });

  test('another profile: + on the tab', async () => {
    const badges: Badges = new Map();
    const api = fakeApi({ [PRESENCE]: () => Response.json({ matches: [] }) });

    expect(
      await (await signedIn(api, badges)).handle({ type: 'presence', url: PROFILE }, TAB),
    ).toEqual({ status: 'notContact' });
    expect(badges.get(TAB)).toBe('+');
  });

  test('off a profile: no badge, and the API is not asked', async () => {
    const badges: Badges = new Map([[TAB, '✓']]);
    const api = fakeApi();

    expect(
      await (
        await signedIn(api, badges)
      ).handle({ type: 'presence', url: 'https://www.linkedin.com/feed/' }, TAB),
    ).toEqual({ status: 'elsewhere' });
    expect(badges.get(TAB)).toBe('');
    expect(api.last(PRESENCE)).toBeUndefined();
  });

  test('without a session, or once it ended: ! on the tab, to sign in', async () => {
    const badges: Badges = new Map();
    const api = fakeApi({
      [PRESENCE]: () => Response.json({ error: 'unauthenticated' }, { status: 401 }),
    });

    expect(
      await wake(api, memoryStorage(), badges).handle({ type: 'presence', url: PROFILE }, TAB),
    ).toEqual({
      status: 'signedOut',
    });
    expect(api.last(PRESENCE)).toBeUndefined();
    expect(badges.get(TAB)).toBe('!');

    badges.clear();
    expect(
      await (await signedIn(api, badges)).handle({ type: 'presence', url: PROFILE }, TAB),
    ).toEqual({ status: 'signedOut' });
    expect(badges.get(TAB)).toBe('!');
  });

  test.each([
    ['no answer', (api: ReturnType<typeof fakeApi>) => api.down()],
    ['a 5xx', () => {}],
  ])('the API in error (%s): ! on the tab', async (_, cut) => {
    const badges: Badges = new Map();
    const api = fakeApi({ [PRESENCE]: () => new Response(null, { status: 503 }) });
    cut(api);

    expect(
      await (await signedIn(api, badges)).handle({ type: 'presence', url: PROFILE }, TAB),
    ).toEqual({ status: 'error' });
    expect(badges.get(TAB)).toBe('!');
  });

  test('426: ! on the tab, the extension outdated', async () => {
    const badges: Badges = new Map();
    const api = fakeApi({ [PRESENCE]: outdated });

    expect(
      await (await signedIn(api, badges)).handle({ type: 'presence', url: PROFILE }, TAB),
    ).toEqual({ status: 'outdated' });
    expect(badges.get(TAB)).toBe('!');
  });

  test('two changes of profile in a row: the badge is the one of the latest, whichever answers last', async () => {
    const badges: Badges = new Map();
    let answerFirst: (() => void) | undefined;
    const api = fakeApi({
      [PRESENCE]: async (request) => {
        const { linkedinUrls } = await request.json();
        if (linkedinUrls[0] !== PROFILE) return Response.json({ matches: [] });
        await new Promise<void>((resolve) => (answerFirst = resolve));
        return Response.json({
          matches: [{ linkedinUrl: PROFILE, contactId: 'c-1', status: 'pool' }],
        });
      },
    });
    const background = await signedIn(api, badges);

    const first = background.handle({ type: 'presence', url: PROFILE }, TAB);
    await expect.poll(() => api.last(PRESENCE)).toBeDefined();
    await background.handle(
      { type: 'presence', url: 'https://www.linkedin.com/in/julien-moreau-482915307/' },
      TAB,
    );
    answerFirst?.();
    await first;

    expect(badges.get(TAB)).toBe('+');
  });
});

const LOOKUP = 'GET /api/contacts/linkedin-profile';
const CARD = {
  id: 'c-1',
  name: 'Gaëtan Lefèvre',
  status: 'prospecting',
  stageName: 'Premier message',
  organizationName: 'Acme',
  jobTitle: 'Directeur technique',
  lastDoneInteractionOn: '2026-09-12',
} as const;

describe('lookup', () => {
  test('a profile that is a Contact: its card, asked once with the address of the tab', async () => {
    const api = fakeApi({ [LOOKUP]: () => Response.json({ contact: CARD }) });

    expect(await (await signedIn(api, new Map())).handle({ type: 'lookup', url: PROFILE })).toEqual(
      { status: 'contact', contact: CARD },
    );
    const sent = api.last(LOOKUP);
    expect(new URL(sent?.request.url ?? '').searchParams.get('url')).toBe(PROFILE);
    expect(sent?.request.headers.get('Authorization')).toBe('Bearer token-1');
  });

  test('another profile: no Contact', async () => {
    const api = fakeApi({ [LOOKUP]: () => Response.json({ contact: null }) });

    expect(await (await signedIn(api, new Map())).handle({ type: 'lookup', url: PROFILE })).toEqual(
      { status: 'notContact' },
    );
  });

  test('off a profile: the API is not asked', async () => {
    const api = fakeApi();

    expect(
      await (
        await signedIn(api, new Map())
      ).handle({ type: 'lookup', url: 'https://www.linkedin.com/feed/' }),
    ).toEqual({ status: 'elsewhere' });
    expect(api.last(LOOKUP)).toBeUndefined();
  });

  test('a session that ended, an API in error, a 426: each said as such', async () => {
    const ended = fakeApi({
      [LOOKUP]: () => Response.json({ error: 'unauthenticated' }, { status: 401 }),
    });
    const failing = fakeApi({ [LOOKUP]: () => new Response(null, { status: 503 }) });
    const down = fakeApi();
    down.down();

    const lookup = { type: 'lookup', url: PROFILE } as const;
    expect(await (await signedIn(ended, new Map())).handle(lookup)).toEqual({
      status: 'signedOut',
    });
    expect(await (await signedIn(failing, new Map())).handle(lookup)).toEqual({ status: 'error' });
    expect(await (await signedIn(down, new Map())).handle(lookup)).toEqual({ status: 'error' });
    expect(
      await (await signedIn(fakeApi({ [LOOKUP]: outdated }), new Map())).handle(lookup),
    ).toEqual({ status: 'outdated' });
  });
});
