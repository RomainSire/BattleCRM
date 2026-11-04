import type { AppType } from '@battlecrm/api';
import { isTotpCode } from '@battlecrm/contract';
import { hc, type ClientResponse } from 'hono/client';

import { profileUrlOf } from '../linkedin/profile.ts';
import type {
  AddOutcome,
  AnswerTo,
  CodeOutcome,
  Lookup,
  Message,
  NewContact,
  ProfileReading,
  Presence,
  ProfileUnknown,
  Session,
  SignInOutcome,
  UndoOutcome,
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

/** The LinkedIn tabs, through their content scripts: a tab without one reads nothing. */
export type Tabs = {
  /**
   * What the tab shows of the profile at this address, once it shows it, `timeoutMs` at most (at once
   * with 0); `null` when it shows none it can read. Rejects while the tab has no content script to
   * answer: a page that is still loading, or no LinkedIn page.
   */
  read(tabId: number, url: string, timeoutMs: number): Promise<ProfileReading | null>;
  /** The Contact of its profile changed: the badge and the element after the name follow. */
  refresh(tabId: number): Promise<void>;
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
  tabs,
  readTimeoutMs,
}: {
  appOrigin: string;
  /** Of the extension, sent in `X-Client`: the API answers 426 below the oldest it serves. */
  version: string;
  storage: Storage;
  fetch: typeof globalThis.fetch;
  setBadge: (tabId: number, badge: Badge) => Promise<void>;
  tabs: Tabs;
  /** How long LinkedIn has to show a profile when the sidebar reads it again: 10 s (§4). */
  readTimeoutMs: number;
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

  /**
   * Asks the API about the profile at this address, if it is one and the extension holds a session:
   * `read` answers from a 200; every other answer and every failure is said here, once.
   */
  async function aboutProfile<Sent extends ClientResponse<unknown>, Answer>(
    url: string,
    call: () => Promise<Sent>,
    read: (response: Extract<Sent, { status: 200 }>) => Promise<Answer>,
  ): Promise<Answer | ProfileUnknown> {
    if (profileUrlOf(url) === null) return { status: 'elsewhere' };
    const { token } = await storage.get(['token']);
    if (typeof token !== 'string') return { status: 'signedOut' };
    let response;
    try {
      response = await call();
    } catch (error) {
      if (error instanceof Outdated) return { status: 'outdated' };
      if (error instanceof TypeError) return { status: 'error' };
      throw error;
    }
    // `requireUser` answers 401 before the route.
    if (response.status === 401) return { status: 'signedOut' };
    if (response.status !== 200) return { status: 'error' };
    // A 200 is the answer of that status: TypeScript cannot narrow a generic union by it.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return read(response as Extract<Sent, { status: 200 }>);
  }

  /** Whether the profile at this address is a Contact: one call with its address only (§13, A3). */
  function presenceAt(url: string): Promise<Presence> {
    return aboutProfile(
      url,
      () => api.contacts.presence.$post({ json: { linkedinUrls: [url] } }),
      async (response) => {
        const [match] = (await response.json()).matches;
        return match === undefined
          ? { status: 'notContact' }
          : { status: 'contact', contactId: match.contactId, contactStatus: match.status };
      },
    );
  }

  /**
   * What the tab shows of the profile at this address, `timeoutMs` at most. A page that loads has no
   * content script until it is ready: asked again until one answers, within the same wait.
   */
  async function readTab(tabId: number, url: string, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      try {
        return await tabs.read(tabId, url, Math.max(deadline - Date.now(), 0));
      } catch {
        if (Date.now() >= deadline) return null;
        await new Promise((resolve) => setTimeout(resolve, READ_RETRY_MS));
      }
    }
  }

  /**
   * The card of the Contact at this address, for the sidebar: one call per profile shown (§3). Not a
   * Contact, what the tab reads of the profile, and what the form needs: the Contacts of the name read
   * among them.
   */
  function lookup(url: string, tabId: number, wait: boolean): Promise<Lookup> {
    let reading: ProfileReading | null = null;
    return aboutProfile(
      url,
      async () => {
        reading = await readTab(tabId, url, wait ? readTimeoutMs : 0);
        const name = reading?.name;
        return api.contacts['linkedin-profile'].$get({
          query: { url, ...(name !== undefined && { name }) },
        });
      },
      async (response) => {
        const answer = await response.json();
        if (answer.contact !== null) return { status: 'contact', contact: answer.contact };
        if (!('organizations' in answer)) throw new Error('The API gave no Organization to choose');
        return {
          status: 'notContact',
          reading,
          sameName: answer.sameName,
          organizations: answer.organizations,
          stages: answer.stages,
        };
      },
    );
  }

  /** `POST /contacts` as it is (§8); the tab then shows its Contact. */
  async function addContact(contact: NewContact, tabId: number): Promise<AddOutcome> {
    const response = await api.contacts.$post({ json: contact });
    // `requireUser` answers 401 before the route, which does not type it.
    if ((response.status as number) === 401) return { status: 'signedOut' };
    if (response.status === 201) {
      await tabs.refresh(tabId);
      return { status: 'added', undoToken: (await response.json()).undoToken };
    }
    if (response.status !== 400 && response.status !== 409) {
      return { status: 'refused', error: 'error' };
    }
    const refused = await response.json();
    if (refused.error === 'linkedin_url_taken') {
      await tabs.refresh(tabId);
      return { status: 'taken' };
    }
    if (refused.error === 'unknown_stage' || refused.error === 'organization_taken')
      return { status: 'refused', error: refused.error };
    return { status: 'refused', error: 'error' };
  }

  /** “Undo” of an addition (`POST /gestures/:id/undo`); the tab then shows the profile to add again. */
  async function undo(undoToken: string, tabId: number): Promise<UndoOutcome> {
    const response = await api.gestures[':id'].undo.$post({ param: { id: undoToken } });
    if ((response.status as number) === 401) return { status: 'signedOut' };
    if (response.status === 200) {
      await tabs.refresh(tabId);
      return { status: 'undone' };
    }
    if (response.status !== 409) return { status: 'refused', error: 'error' };
    const { error } = await response.json();
    return error === 'expired' || error === 'superseded'
      ? { status: 'refused', error }
      : { status: 'refused', error: 'error' };
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
    if (message.type === 'lookup') return lookup(message.url, message.tabId, message.wait ?? false);
    if (message.type === 'addContact') return addContact(message.contact, message.tabId);
    if (message.type === 'undo') return undo(message.undoToken, message.tabId);
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

/** How often a tab is asked again while its page loads. */
const READ_RETRY_MS = 250;

/** The API answered 426: it no longer serves this version of the extension. */
class Outdated extends Error {}
