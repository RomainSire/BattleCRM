import { describe, expect, test } from 'vitest';

import { fakeApi } from '../../test/fake-api.ts';
import type { NewContact, ProfileReading } from '../messages.ts';
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

/**
 * The LinkedIn tabs, as their content scripts answer: what each one reads of its profile, and the
 * tabs told to show their profile again. `loading`: how many reads find no content script yet, as
 * while a page loads.
 */
function fakeTabs(readings: Record<number, ProfileReading | null> = {}, { loading = 0 } = {}) {
  const read: { tabId: number; url: string; timeoutMs: number }[] = [];
  const refreshed: number[] = [];
  let unanswered = loading;
  return {
    read,
    refreshed,
    port: {
      read: async (tabId: number, url: string, timeoutMs: number) => {
        read.push({ tabId, url, timeoutMs });
        if (unanswered-- > 0)
          throw new Error('Could not establish connection. Receiving end does not exist.');
        return readings[tabId] ?? null;
      },
      refresh: async (tabId: number) => {
        refreshed.push(tabId);
      },
    },
  };
}

/** How long the tests' LinkedIn has to show a profile: 10 s in Firefox. */
const READ_TIMEOUT_MS = 1_000;

/** A background as Firefox wakes it up: a new one each time, on the same storage. */
function wake(
  api: ReturnType<typeof fakeApi>,
  storage = memoryStorage(),
  badges: Badges = new Map(),
  tabs = fakeTabs(),
) {
  return createBackground({
    appOrigin: APP_ORIGIN,
    version: '0.7.0',
    storage,
    fetch: api.fetch,
    setBadge: async (tabId, badge) => {
      badges.set(tabId, badge);
    },
    tabs: tabs.port,
    readTimeoutMs: READ_TIMEOUT_MS,
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
async function signedIn(api: ReturnType<typeof fakeApi>, badges: Badges, tabs = fakeTabs()) {
  const storage = memoryStorage();
  await storage.set({ token: 'token-1', email: 'jane@example.com' });
  return wake(api, storage, badges, tabs);
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

/** What the tab reads of the profile. */
const READING: ProfileReading = {
  name: 'Gaëtan Lefèvre',
  jobTitle: 'Gérant',
  organizationName: 'VOLTÉO',
  email: null,
  phone: null,
};

/** A profile that is no Contact, nothing else known. */
const NOT_CONTACT = () =>
  Response.json({ contact: null, sameName: [], organizations: [], stages: [] });

describe('lookup', () => {
  test('a profile that is a Contact: its card, asked once with the address of the tab', async () => {
    const api = fakeApi({ [LOOKUP]: () => Response.json({ contact: CARD }) });

    expect(
      await (await signedIn(api, new Map())).handle({ type: 'lookup', url: PROFILE, tabId: TAB }),
    ).toEqual({ status: 'contact', contact: CARD });
    const sent = api.last(LOOKUP);
    expect(new URL(sent?.request.url ?? '').searchParams.get('url')).toBe(PROFILE);
    expect(sent?.request.headers.get('Authorization')).toBe('Bearer token-1');
  });

  test('another profile: what the form needs, and what the tab reads of it, its name sent', async () => {
    const answer = {
      contact: null,
      sameName: [{ id: 'c-2', name: 'Gaetan Lefevre', organizationName: 'Acme' }],
      organizations: [{ id: 'o-1', name: 'VOLTÉO', type: 'end_client' }],
      stages: [{ id: 's-1', name: 'Premier message' }],
    } as const;
    const api = fakeApi({ [LOOKUP]: () => Response.json(answer) });
    const tabs = fakeTabs({ [TAB]: READING });

    expect(
      await (
        await signedIn(api, new Map(), tabs)
      ).handle({ type: 'lookup', url: PROFILE, tabId: TAB }),
    ).toEqual({
      status: 'notContact',
      reading: READING,
      sameName: answer.sameName,
      organizations: answer.organizations,
      stages: answer.stages,
    });
    // Read at once: the sidebar shows what the page shows now.
    expect(tabs.read).toEqual([{ tabId: TAB, url: PROFILE, timeoutMs: 0 }]);
    expect(new URL(api.last(LOOKUP)?.request.url ?? '').searchParams.get('name')).toBe(
      READING.name,
    );
  });

  test('no name read: none sent; “Read the page again” waits for the profile', async () => {
    const api = fakeApi({
      [LOOKUP]: () => Response.json({ contact: null, sameName: [], organizations: [], stages: [] }),
    });
    const tabs = fakeTabs();
    const background = await signedIn(api, new Map(), tabs);

    expect(
      await background.handle({ type: 'lookup', url: PROFILE, tabId: TAB, wait: true }),
    ).toMatchObject({ status: 'notContact', reading: null, sameName: [] });
    expect(tabs.read).toEqual([{ tabId: TAB, url: PROFILE, timeoutMs: expect.any(Number) }]);
    expect(tabs.read[0]?.timeoutMs).toBeGreaterThan(READ_TIMEOUT_MS - 100);
    expect(tabs.read[0]?.timeoutMs).toBeLessThanOrEqual(READ_TIMEOUT_MS);
    expect(new URL(api.last(LOOKUP)?.request.url ?? '').searchParams.has('name')).toBe(false);
  });

  test('“Read the page again” on a page still loading: read once its content script answers', async () => {
    const tabs = fakeTabs({ [TAB]: READING }, { loading: 2 });
    const background = await signedIn(fakeApi({ [LOOKUP]: NOT_CONTACT }), new Map(), tabs);

    expect(
      await background.handle({ type: 'lookup', url: PROFILE, tabId: TAB, wait: true }),
    ).toMatchObject({ status: 'notContact', reading: READING });
    expect(tabs.read).toHaveLength(3);
    // What is left of the wait, never more: 10 s in all.
    const [first, , last] = tabs.read;
    expect(last?.timeoutMs).toBeLessThan(first?.timeoutMs ?? 0);
  });

  test('a content script that never answers: nothing read once the wait is over; at once without it', async () => {
    const waited = fakeTabs({ [TAB]: READING }, { loading: Infinity });
    const background = await signedIn(fakeApi({ [LOOKUP]: NOT_CONTACT }), new Map(), waited);
    const started = Date.now();

    expect(
      await background.handle({ type: 'lookup', url: PROFILE, tabId: TAB, wait: true }),
    ).toMatchObject({ status: 'notContact', reading: null });
    expect(Date.now() - started).toBeGreaterThanOrEqual(READ_TIMEOUT_MS - 50);
    expect(Date.now() - started).toBeLessThan(READ_TIMEOUT_MS + 500);

    const atOnce = fakeTabs({ [TAB]: READING }, { loading: Infinity });
    await (
      await signedIn(fakeApi({ [LOOKUP]: NOT_CONTACT }), new Map(), atOnce)
    ).handle({ type: 'lookup', url: PROFILE, tabId: TAB });
    expect(atOnce.read).toHaveLength(1);
  });

  test('off a profile: the API is not asked', async () => {
    const api = fakeApi();

    expect(
      await (
        await signedIn(api, new Map())
      ).handle({ type: 'lookup', url: 'https://www.linkedin.com/feed/', tabId: TAB }),
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

    const lookup = { type: 'lookup', url: PROFILE, tabId: TAB } as const;
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

const ADD = 'POST /api/contacts';
const NEW_CONTACT: NewContact = {
  name: 'Gaëtan Lefèvre',
  status: 'prospecting',
  stageId: '0190a000-0000-7000-8000-000000000001',
  newOrganization: { name: 'VOLTÉO', type: 'end_client' },
  linkedinUrl: 'https://linkedin.com/in/gaëtan-lefèvre-b7c41e2d',
  jobTitle: 'Gérant',
};

describe('addContact', () => {
  test('sent to the API as it is; its token to undo it, the tab told to show its Contact', async () => {
    let sent: unknown;
    const api = fakeApi({
      [ADD]: async (request) => {
        sent = await request.json();
        return Response.json({ changes: {}, undoToken: 'g-1' }, { status: 201 });
      },
    });
    const tabs = fakeTabs();

    expect(
      await (
        await signedIn(api, new Map(), tabs)
      ).handle({ type: 'addContact', tabId: TAB, contact: NEW_CONTACT }),
    ).toEqual({ status: 'added', undoToken: 'g-1' });
    expect(sent).toEqual(NEW_CONTACT);
    expect(api.last(ADD)?.request.headers.get('Authorization')).toBe('Bearer token-1');
    expect(tabs.refreshed).toEqual([TAB]);
  });

  test('the profile taken meanwhile (from another tab): said so, the tab told', async () => {
    const api = fakeApi({
      [ADD]: () =>
        Response.json({ error: 'linkedin_url_taken', contactId: 'c-1' }, { status: 409 }),
    });
    const tabs = fakeTabs();

    expect(
      await (
        await signedIn(api, new Map(), tabs)
      ).handle({ type: 'addContact', tabId: TAB, contact: NEW_CONTACT }),
    ).toEqual({ status: 'taken' });
    expect(tabs.refreshed).toEqual([TAB]);
  });

  test('refused for data changed in the app meanwhile, or in error: said as such, nothing told', async () => {
    const answering = (body: object | null, status: number) =>
      fakeApi({
        [ADD]: () => (body ? Response.json(body, { status }) : new Response(null, { status })),
      });
    const add = { type: 'addContact', tabId: TAB, contact: NEW_CONTACT } as const;
    const tabs = fakeTabs();
    const down = fakeApi();
    down.down();

    for (const error of ['unknown_stage', 'organization_taken'] as const) {
      expect(
        await (await signedIn(answering({ error }, 400), new Map(), tabs)).handle(add),
      ).toEqual({ status: 'refused', error });
    }
    expect(
      await (await signedIn(answering({ error: 'invalid' }, 400), new Map(), tabs)).handle(add),
    ).toEqual({ status: 'refused', error: 'error' });
    expect(await (await signedIn(answering(null, 503), new Map(), tabs)).handle(add)).toEqual({
      status: 'refused',
      error: 'error',
    });
    expect(await (await signedIn(down, new Map(), tabs)).handle(add)).toEqual({
      status: 'refused',
      error: 'error',
    });
    expect(
      await (
        await signedIn(answering({ error: 'unauthenticated' }, 401), new Map(), tabs)
      ).handle(add),
    ).toEqual({ status: 'signedOut' });
    expect(
      await (await signedIn(fakeApi({ [ADD]: outdated }), new Map(), tabs)).handle(add),
    ).toEqual({ status: 'outdated' });
    expect(tabs.refreshed).toEqual([]);
  });
});

const UNDO = 'POST /api/gestures/g-1/undo';

describe('undo', () => {
  test('the addition undone on the API; the tab told to show the profile to add again', async () => {
    const api = fakeApi({ [UNDO]: () => Response.json({ changes: {} }) });
    const tabs = fakeTabs();

    expect(
      await (
        await signedIn(api, new Map(), tabs)
      ).handle({ type: 'undo', tabId: TAB, undoToken: 'g-1' }),
    ).toEqual({ status: 'undone' });
    expect(api.last(UNDO)?.request.headers.get('Authorization')).toBe('Bearer token-1');
    expect(tabs.refreshed).toEqual([TAB]);
  });

  test('too late, or the Contact changed since in the app: refused, nothing told', async () => {
    const tabs = fakeTabs();
    const undo = { type: 'undo', tabId: TAB, undoToken: 'g-1' } as const;

    for (const error of ['expired', 'superseded'] as const) {
      const api = fakeApi({ [UNDO]: () => Response.json({ error }, { status: 409 }) });
      expect(await (await signedIn(api, new Map(), tabs)).handle(undo)).toEqual({
        status: 'refused',
        error,
      });
    }
    const gone = fakeApi({ [UNDO]: () => Response.json({ error: 'not_found' }, { status: 404 }) });
    expect(await (await signedIn(gone, new Map(), tabs)).handle(undo)).toEqual({
      status: 'refused',
      error: 'error',
    });
    expect(tabs.refreshed).toEqual([]);
  });
});
