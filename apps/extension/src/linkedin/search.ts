import { profileUrlOf } from './profile.ts';
import { shownWithin, type PageWait } from './wait.ts';

// What the extension reads on a LinkedIn search of people (spec extension §6): from a `Document`, never
// `document`. Neither the title nor “Poste actuel” is read: only who each result is.

/** A result of the search: who it is, and the link of its name, which its pill follows. */
export type SearchResult = {
  /** The `role="listitem"` of the result. */
  item: Element;
  /** The address of its profile, normalized (ST-93): never LinkedIn's own `ACoAA…` identifier. */
  profileUrl: string;
  /** The `/in/` link in the line of its name (a `p`); `null` when that line cannot be told. */
  nameLink: HTMLAnchorElement | null;
};

/** Whether this address is a search of people on LinkedIn. */
export function isSearchPage(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return /(^|\.)linkedin\.com$/.test(hostname) && pathname.startsWith('/search/results/people');
  } catch {
    return false;
  }
}

/** The profile a link leads to, normalized; `null` for any other link. */
const profileOf = (link: Element) => profileUrlOf(link.getAttribute('href') ?? '');

/**
 * Each result of the search, in the order of the page: a `role="listitem"` holding a `/in/` link,
 * known by the profile its first one leads to. None: the search shows nothing the extension can read
 * (spec extension §7).
 */
export function readSearch(page: Document): SearchResult[] {
  return [...page.querySelectorAll('[role="listitem"]')].flatMap((item) => {
    const profileUrl = [...item.querySelectorAll('a[href*="/in/"]')]
      .map(profileOf)
      .find((url) => url !== null);
    if (profileUrl === undefined) return [];
    return [{ item, profileUrl, nameLink: nameLinkOf(item, profileUrl) }];
  });
}

/**
 * The link of the name: in a line (a `p`), the one with a text that leads to the result's profile. Not
 * the first `/in/` link of the result (its photo), nor the links of relations in common.
 */
function nameLinkOf(item: Element, profileUrl: string): HTMLAnchorElement | null {
  for (const link of item.querySelectorAll<HTMLAnchorElement>('p a[href*="/in/"]')) {
    if (profileOf(link) === profileUrl && link.textContent.trim() !== '') return link;
  }
  return null;
}

/**
 * Whether the search shows results once LinkedIn renders them, `timeoutMs` at most; `false` past that,
 * or as soon as `stale()` says the tab moved on (spec extension §7).
 */
export async function searchShown(page: Document, wait: PageWait): Promise<boolean> {
  const results = await shownWithin(page, () => (readSearch(page).length > 0 ? true : null), wait);
  return results === true;
}
