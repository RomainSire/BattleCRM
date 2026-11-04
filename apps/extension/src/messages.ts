import type { AddableContactStatus, ContactStatus, OrganizationType } from '@battlecrm/contract';

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
  /**
   * The results of a search of people read in a tab (spec extension §5, §8), by their normalized
   * address: which ones are Contacts. Leaves the badge alone.
   */
  | { type: 'searchPresence'; urls: string[] }
  /** The sidebar on a search of people: whether its tab shows results, 10 s at most (spec extension §7). */
  | { type: 'readSearch'; url: string; tabId: number }
  /**
   * The sidebar reads the profile of the active tab (spec extension §3): once per profile shown, and
   * at each “Read the page again” (§4), which `wait`s for LinkedIn to show the profile, 10 s at most.
   */
  | { type: 'lookup'; url: string; tabId: number; wait?: boolean }
  /** The form of the sidebar adds the Contact of the profile of this tab (spec extension §4). */
  | { type: 'addContact'; tabId: number; contact: NewContact }
  /** “Undo” of the line after an addition, on the profile of this tab. */
  | { type: 'undo'; tabId: number; undoToken: string };

/** What the background asks the content script of a LinkedIn tab (`browser.tabs.sendMessage`). */
export type TabMessage =
  /**
   * What the page shows of the profile at this address, if it shows it; `null` otherwise. Once
   * LinkedIn shows it, `timeoutMs` at most; at once with 0.
   */
  | { type: 'readProfile'; url: string; timeoutMs: number }
  /** Whether the page at this address shows results of a search, once it does, `timeoutMs` at most. */
  | { type: 'readSearch'; url: string; timeoutMs: number }
  /** The Contact of the profile was added or taken back: the badge and the element follow. */
  | { type: 'refresh' };

/** A Contact added from a LinkedIn profile: `POST /contacts` as it is (spec extension §8). */
export type NewContact = {
  name: string;
  status: AddableContactStatus;
  /** Prospecting only. */
  stageId?: string;
  organizationId?: string;
  newOrganization?: { name: string; type: OrganizationType };
  linkedinUrl: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  note?: string;
};

export type AddOutcome =
  | { status: 'added'; undoToken: string }
  /** Another addition took the profile meanwhile, from another tab: its card shows instead. */
  | { status: 'taken' }
  /** The Stage or the Organization changed in the app meanwhile; or the API failed. */
  | { status: 'refused'; error: 'unknown_stage' | 'organization_taken' | 'error' }
  | { status: 'signedOut' }
  | { status: 'outdated' };

export type UndoOutcome =
  | { status: 'undone' }
  /** Too late, or the Contact changed since; or the API failed. */
  | { status: 'refused'; error: 'expired' | 'superseded' | 'error' }
  | { status: 'signedOut' }
  | { status: 'outdated' };

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
  { status: 'elsewhere' } | Unanswered;

/** Why the API gave the background no answer to a question. */
export type Unanswered =
  /** No session, or it ended. */
  | { status: 'signedOut' }
  /** No answer, or a 5xx. */
  | { status: 'error' }
  /** 426. */
  | { status: 'outdated' };

/** A result of a search that is a Contact: its pill shows its Status, and opens its page in the app. */
export type SearchMatch = { profileUrl: string; contactId: string; contactStatus: ContactStatus };

/** Which results of a search are Contacts; the reasons the background cannot tell otherwise. */
export type SearchPresence = { status: 'checked'; matches: SearchMatch[] } | Unanswered;

/**
 * Whether a search of people shows results the extension reads (spec extension §7): `unknown` when the
 * tab has no content script to tell.
 */
export type SearchReading = 'readable' | 'unreadable' | 'unknown';

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

/** What the extension reads on a LinkedIn profile to fill the form (spec extension §6): `null` unread. */
export type ProfileReading = {
  name: string;
  jobTitle: string | null;
  organizationName: string | null;
  email: string | null;
  phone: string | null;
};

/** A Contact of the same name as the one read: worth knowing, never blocking (spec extension §4). */
export type SameNameContact = { id: string; name: string; organizationName: string | null };

/** An Organization of the User, as the form chooses one. */
export type OrganizationChoice = { id: string; name: string; type: OrganizationType };

/** A Stage of the Funnel, not archived, in its order. */
export type StageChoice = { id: string; name: string };

/** What the sidebar learns of the profile of the active tab. */
export type Lookup =
  | { status: 'contact'; contact: ContactCard }
  /** Not a Contact yet: what the form to add one is filled with and chooses from. */
  | {
      status: 'notContact';
      reading: ProfileReading | null;
      /** The Contacts of the name read; none without one. */
      sameName: SameNameContact[];
      organizations: OrganizationChoice[];
      stages: StageChoice[];
    }
  | ProfileUnknown;

type Answers = {
  session: Session;
  signIn: SignInOutcome;
  verifyCode: CodeOutcome;
  signOut: null;
  presence: Presence;
  searchPresence: SearchPresence;
  readSearch: SearchReading;
  lookup: Lookup;
  addContact: AddOutcome;
  undo: UndoOutcome;
};

export type AnswerTo<M extends Message> = Answers[M['type']];

/** Asks the background; the sidebar's tests put a fake background in its place. */
export type Send = <M extends Message>(message: M) => Promise<AnswerTo<M>>;

export const send: Send = (message) => browser.runtime.sendMessage(message);
