import type { ContactStatus } from '@battlecrm/contract';

/**
 * What the sidebar and the content scripts ask the background, the only part of the extension that
 * calls the API (spec extension §9): one type per gesture, written by hand, no library.
 */
export type Message =
  | { type: 'session' }
  | { type: 'signIn'; email: string; password: string }
  | { type: 'verifyCode'; code: string }
  | { type: 'signOut' }
  /** The tab moved to this address (spec extension §2): its badge, and what the page shows after the name. */
  | { type: 'presence'; url: string }
  /** The sidebar reads the profile of the active tab (spec extension §3): once per profile shown. */
  | { type: 'lookup'; url: string };

/** What the sidebar shows first, before any page (spec extension §3). */
export type Session =
  | { status: 'signedIn'; email: string }
  | { status: 'signedOut' }
  /** The API answered 401 to a session the extension held: its address stays, to sign in again. */
  | { status: 'expired'; email: string }
  /** 426: the API no longer serves this version. */
  | { status: 'outdated' }
  /** No answer, or a 5xx. */
  | { status: 'unreachable' };

export type SignInOutcome =
  | { status: 'signedIn'; email: string }
  /** The password was right; a code of the second factor is awaited. */
  | { status: 'codeRequired' }
  | { status: 'refused'; error: 'invalid_credentials' | 'too_many_attempts' | 'error' }
  | { status: 'outdated' };

export type CodeOutcome =
  | { status: 'signedIn'; email: string }
  | {
      status: 'refused';
      error: 'invalid_code' | 'challenge_expired' | 'too_many_attempts' | 'error';
    }
  | { status: 'outdated' };

/** Whether the profile of a tab is a Contact, as its badge shows it (spec extension §2, §13 A3). */
export type Presence =
  | { status: 'contact'; contactId: string; contactStatus: ContactStatus }
  | { status: 'notContact' }
  | ProfileUnknown;

/** Why the background cannot tell about the profile at an address. */
export type ProfileUnknown =
  /** No profile at this address: no badge. */
  | { status: 'elsewhere' }
  /** No session, or it ended. */
  | { status: 'signedOut' }
  /** No answer, or a 5xx. */
  | { status: 'error' }
  /** 426. */
  | { status: 'outdated' };

/** The card of a Contact, as the sidebar shows it (spec extension §3). */
export type ContactCard = {
  id: string;
  name: string;
  status: ContactStatus;
  /** Prospecting only. */
  stageName: string | null;
  organizationName: string | null;
  jobTitle: string | null;
  /** The local day of the latest Interaction done, outbound or inbound (`YYYY-MM-DD`). */
  lastDoneInteractionOn: string | null;
};

/** What the sidebar learns of the profile of the active tab. */
export type Lookup =
  { status: 'contact'; contact: ContactCard } | { status: 'notContact' } | ProfileUnknown;

type Answers = {
  session: Session;
  signIn: SignInOutcome;
  verifyCode: CodeOutcome;
  signOut: null;
  presence: Presence;
  lookup: Lookup;
};

export type AnswerTo<M extends Message> = Answers[M['type']];

/** Asks the background; the sidebar's tests put a fake background in its place. */
export type Send = <M extends Message>(message: M) => Promise<AnswerTo<M>>;

export const send: Send = (message) => browser.runtime.sendMessage(message);
