import type { AppType } from '@battlecrm/api';
import { isTotpCode } from '@battlecrm/contract';
import { hc } from 'hono/client';

import { profileUrlOf } from '../linkedin/profile.ts';
import type {
  AnswerTo,
  CodeOutcome,
  Message,
  Presence,
  Session,
  SignInOutcome,
} from '../messages.ts';

/** The part of `browser.storage.local` the background uses: it outlives the event page. */
export type Storage = {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
};

/**
 * The badge of a tab's icon (spec extension §2): ✓ a Contact, + not yet one, ! no session or the API in
 * error, nothing off a profile.
 */
export type Badge = '✓' | '+' | '!' | '';

const BADGES: Record<Presence['status'], Badge> = {
  elsewhere: '',
  contact: '✓',
  notContact: '+',
  signedOut: '!',
  error: '!',
  outdated: '!',
};

/**
 * The background (spec extension §9): the only part of the extension that calls the API. Firefox
 * stops it after 30 s of quiet, so it keeps nothing in memory: the token is read from `storage` on
 * every call.
 */
export function createBackground({
  appOrigin,
  version,
  storage,
  fetch,
  setBadge,
}: {
  appOrigin: string;
  /** Of the extension, sent in `X-Client`: the API answers 426 below the oldest it serves. */
  version: string;
  storage: Storage;
  fetch: typeof globalThis.fetch;
  setBadge: (tabId: number, badge: Badge) => Promise<void>;
}) {
  /**
   * The latest address asked about, by tab: an answer to an earlier one leaves the badge alone. Lost
   * when Firefox stops the background, which it never does while a call is under way.
   */
  const latest = new Map<number, string>();
  const api = hc<AppType>(appOrigin, {
    // Every answer passes here first: the one place that learns the session ended or the API moved on.
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, init);
      if (response.status === 426) throw new Outdated();
      // A 401 to the token held: the session ended (signed out from the app, or 90 days without use).
      // The address stays, for the sign-in that follows.
      if (response.status === 401 && new Headers(init?.headers).has('Authorization')) {
        await storage.remove(['token']);
      }
      return response;
    },
    // A function: the token may have changed since the last call.
    headers: async () => {
      const { token } = await storage.get(['token']);
      return {
        'X-Client': `extension/${version}`,
        ...(typeof token === 'string' ? { Authorization: `Bearer ${token}` } : {}),
      };
    },
    // No cookie ever: the token is the session (never `headers` here, it would drop `content-type`).
    init: { credentials: 'omit' },
  }).api;

  async function session(): Promise<Session> {
    let response;
    try {
      response = await api.session.$get();
    } catch (error) {
      // What `fetch` throws without an answer; a 426 is for `handle` to say.
      if (!(error instanceof TypeError)) throw error;
      return { status: 'unreachable' };
    }
    if (response.status === 200)
      return { status: 'signedIn', email: (await response.json()).email };
    if (response.status !== 401) return { status: 'unreachable' };
    // Without a token, a remembered address is a session that ended: signing out forgets it.
    const { email } = await storage.get(['email']);
    return typeof email === 'string' ? { status: 'expired', email } : { status: 'signedOut' };
  }

  /** This device only: the session is revoked on the API if it answers, forgotten here in any case. */
  async function signOut(): Promise<null> {
    try {
      await api.auth['sign-out'].$post();
    } catch {
      // Unreachable or outdated: the extension forgets its session all the same.
    }
    await storage.remove(['token', 'email', 'challenge']);
    return null;
  }

  /** The session is open: kept until the User signs out, or the API answers 401. */
  async function storeSession({ email, token }: { email: string; token?: string }) {
    if (token === undefined)
      throw new Error('The API opened a session and gave the extension no token');
    await storage.set({ token, email });
    await storage.remove(['challenge']);
    return { status: 'signedIn' as const, email };
  }

  async function signIn({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<SignInOutcome> {
    const response = await api.auth['sign-in'].email.$post({ json: { email, password } });
    if (response.status === 401 || response.status === 429) {
      return { status: 'refused', error: (await response.json()).error };
    }
    if (response.status !== 200) return { status: 'refused', error: 'error' };
    const body = await response.json();
    if (!('twoFactorRequired' in body)) return storeSession(body);
    if (!('challenge' in body))
      throw new Error('The API awaits a code and gave the extension no challenge');
    // Brought back with the code: the extension keeps no cookie.
    await storage.set({ challenge: body.challenge });
    return { status: 'codeRequired' };
  }

  async function verifyCode({ code }: { code: string }): Promise<CodeOutcome> {
    const { challenge } = await storage.get(['challenge']);
    if (typeof challenge !== 'string') return { status: 'refused', error: 'challenge_expired' };
    const check = api.auth['two-factor'][isTotpCode(code) ? 'verify-totp' : 'verify-backup-code'];
    const response = await check.$post({ json: { code, challenge } });
    if (response.status === 401 || response.status === 429) {
      return { status: 'refused', error: (await response.json()).error };
    }
    // What is no code at all is a wrong code.
    if (response.status === 400) return { status: 'refused', error: 'invalid_code' };
    if (response.status !== 200) return { status: 'refused', error: 'error' };
    return storeSession(await response.json());
  }

  /** Whether the profile at this address is a Contact: one call with its address only (§13, A3). */
  async function presenceAt(url: string): Promise<Presence> {
    const profileUrl = profileUrlOf(url);
    if (profileUrl === null) return { status: 'elsewhere' };
    const { token } = await storage.get(['token']);
    if (typeof token !== 'string') return { status: 'signedOut' };
    let response;
    try {
      response = await api.contacts.presence.$post({ json: { linkedinUrls: [url] } });
    } catch (error) {
      if (error instanceof Outdated) return { status: 'outdated' };
      if (error instanceof TypeError) return { status: 'error' };
      throw error;
    }
    if (response.status !== 200) {
      // `requireUser` answers 401 before the route, whose types do not know it.
      return (response.status as number) === 401 ? { status: 'signedOut' } : { status: 'error' };
    }
    const [match] = (await response.json()).matches;
    return match === undefined
      ? { status: 'notContact' }
      : { status: 'contact', contactId: match.contactId, contactStatus: match.status };
  }

  async function presence(url: string, tabId: number | undefined): Promise<Presence> {
    if (tabId !== undefined) latest.set(tabId, url);
    const answer = await presenceAt(url);
    if (tabId !== undefined && latest.get(tabId) === url)
      await setBadge(tabId, BADGES[answer.status]);
    return answer;
  }

  function dispatch(message: Message, tabId: number | undefined): Promise<AnswerTo<Message>> {
    if (message.type === 'presence') return presence(message.url, tabId);
    if (message.type === 'session') return session();
    if (message.type === 'signIn') return signIn(message);
    if (message.type === 'verifyCode') return verifyCode(message);
    return signOut();
  }

  return {
    /**
     * Answers a message of the sidebar or of a content script, with what `send()` promises; `tabId` is
     * the tab of the content script that sent it.
     */
    async handle(message: Message, tabId?: number): Promise<AnswerTo<Message>> {
      try {
        return await dispatch(message, tabId);
      } catch (error) {
        if (error instanceof Outdated) return { status: 'outdated' };
        // No answer from the API to a gesture: it failed (the session check says unreachable itself).
        if (error instanceof TypeError) return { status: 'refused', error: 'error' };
        throw error;
      }
    },
  };
}

/** The API answered 426: it no longer serves this version of the extension. */
class Outdated extends Error {}
