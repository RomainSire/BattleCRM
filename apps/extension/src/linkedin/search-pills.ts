import type { Message, SearchMatch, SearchPresence } from '../messages.ts';
import { renderMark, statusContent } from './mark.ts';
import { isSearchPage, readSearch, searchShown, type SearchResult } from './search.ts';

/** What the console says when a search of people shows no result the extension can read (§7). */
export const UNREADABLE_SEARCH =
  'BattleCRM: unreadable search, LinkedIn may have changed its layout';

/** Marks a result read, with the profile it showed then: never checked twice, never two pills. */
const READ = 'data-battlecrm-result';
/** Marks a pill, with the profile it belongs to. */
const PILL = 'data-battlecrm-pill';

/** The pill of a result, if it has one. */
const pillOf = (item: Element) => item.querySelector(`[${PILL}]`);

/** The pill of a result that is a Contact: right after the link of its name, before the degree. */
function place(result: SearchResult, match: SearchMatch, appOrigin: string) {
  const { item, nameLink, profileUrl } = result;
  if (nameLink === null || pillOf(item) !== null) return;
  const page = item.ownerDocument;
  const host = page.createElement('span');
  host.setAttribute(PILL, profileUrl);
  renderMark(host, {
    near: nameLink,
    hostCss: 'display: inline-block; margin-inline-start: 4px; vertical-align: middle;',
    content: statusContent(page, match.contactStatus),
    href: `${appOrigin}/contacts/${match.contactId}`,
  });
  // LinkedIn's own handlers on the result never see the click: the link opens the app, nothing else.
  host.addEventListener('click', (event) => event.stopPropagation());
  nameLink.after(host);
}

/** How many debounces at most a page that never calms down waits before it is read all the same. */
const MAX_DEBOUNCES = 4;

/**
 * The pills of a search of people (spec extension §5, ST-106): each result that is a Contact gets one,
 * with its Status, linked to its page in the app. Read when LinkedIn calms down (pagination without a
 * load included), each result marked before it is checked, so that two reads never put two pills. A
 * search that never shows a result is said in the console (§7).
 */
export function createSearchWatch({
  page,
  send,
  appOrigin,
  debounceMs,
  timeoutMs,
}: {
  page: Document;
  /** Asks the background which results are Contacts. */
  send: (message: Extract<Message, { type: 'searchPresence' }>) => Promise<SearchPresence>;
  /** Where the page of a Contact opens. */
  appOrigin: string;
  /** How quiet LinkedIn must be before the page is read. */
  debounceMs: number;
  /** How long LinkedIn has to show the results: 10 s (spec extension §7). */
  timeoutMs: number;
}) {
  /** The address watched; `null` off a search. */
  let current: string | null = null;
  /** The Contacts among the results checked on this search, by profile: their pills put back if gone. */
  let contacts = new Map<string, SearchMatch>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** When the read waited for was first asked for: LinkedIn changing the page never delays it forever. */
  let waitingSince: number | undefined;
  const observer = new MutationObserver(() => schedule());

  function schedule() {
    waitingSince ??= Date.now();
    clearTimeout(timer);
    const left = waitingSince + debounceMs * MAX_DEBOUNCES - Date.now();
    timer = setTimeout(
      () => {
        waitingSince = undefined;
        void read();
      },
      Math.max(Math.min(debounceMs, left), 0),
    );
  }

  /** One read of the page: the results new since the last one checked in one go. */
  async function read() {
    const watched = current;
    const fresh: SearchResult[] = [];
    for (const result of readSearch(page)) {
      const { item, profileUrl } = result;
      if (item.getAttribute(READ) !== profileUrl) {
        // A new result, or LinkedIn showing another LinkedIn member in the node of a previous one.
        pillOf(item)?.remove();
        item.setAttribute(READ, profileUrl);
        fresh.push(result);
      }
    }
    if (fresh.length > 0) {
      const answer = await send({
        type: 'searchPresence',
        urls: fresh.map((r) => r.profileUrl),
      }).catch(() => ({ status: 'error' as const }));
      // Another address meanwhile: its own read checks the page again.
      if (watched !== current) return;
      if (answer.status !== 'checked') {
        // No session, or the API failing: asked again at the next read.
        for (const { item, profileUrl } of fresh)
          if (item.getAttribute(READ) === profileUrl) item.removeAttribute(READ);
        return;
      }
      for (const match of answer.matches) contacts.set(match.profileUrl, match);
    }
    // Each Contact read gets its pill, put back if LinkedIn took it away as it rendered again.
    for (const result of readSearch(page)) {
      const match = contacts.get(result.profileUrl);
      if (match !== undefined && result.item.getAttribute(READ) === result.profileUrl)
        place(result, match, appOrigin);
    }
  }

  /** Forgets what was read on the page: its pills go, and every result is checked again. */
  function forget() {
    clearTimeout(timer);
    waitingSince = undefined;
    for (const pill of page.querySelectorAll(`[${PILL}]`)) pill.remove();
    for (const item of page.querySelectorAll(`[${READ}]`)) item.removeAttribute(READ);
    contacts = new Map();
  }

  return {
    /** The tab moved to this address: off a search, nothing; on one, its results watched. */
    async changed(url: string) {
      if (url === current) return;
      const wasSearch = current !== null;
      current = isSearchPage(url) ? url : null;
      // Each address is read afresh: the Status of a Contact may have changed in the app meanwhile.
      forget();
      if (current === null) return observer.disconnect();
      if (!wasSearch) {
        // `href` too: LinkedIn may show another LinkedIn member in a result's node, its links changed.
        observer.observe(page.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['href'],
        });
      }
      schedule();
      const watched = current;
      const shows = await searchShown(page, { timeoutMs, stale: () => current !== watched });
      // For Romain, never for the API (spec extension §7, §13 A8).
      if (!shows && current === watched) console.warn(UNREADABLE_SEARCH);
    },
  };
}
