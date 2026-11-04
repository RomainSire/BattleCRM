import { m } from '@battlecrm/i18n';

import type { Message, Presence } from '../messages.ts';
import { renderMark, span, statusContent } from './mark.ts';
import { profileShown, profileUrlOf } from './profile.ts';

// What the extension puts in a LinkedIn profile, right after the h2 of the name (spec extension §5).
// It only informs: only the icon opens the sidebar (Firefox refuses it from the page).

/** What the console says when LinkedIn shows no profile the extension can read (spec extension §7). */
export const UNREADABLE = 'BattleCRM: unreadable profile, LinkedIn may have changed its layout';

/** Marks the element in the page, with the profile it belongs to. */
const MARK = 'data-battlecrm-presence';

/** What the element says, in words: never the colour alone. */
function contentOf(page: Document, presence: Presence): Node[] | null {
  if (presence.status === 'contact') return statusContent(page, presence.contactStatus);
  if (presence.status === 'notContact') return [span(page, 'neutral', m.extension_presence_add())];
  if (presence.status === 'signedOut')
    return [span(page, 'neutral', m.extension_presence_sign_in())];
  // The API in error or the extension outdated: the badge says it, the page shows nothing.
  return null;
}

/** Puts the element right after the heading of the name, or brings the one there up to date. */
function place(heading: HTMLHeadingElement, profileUrl: string, content: Node[]) {
  const page = heading.ownerDocument;
  // The one of this profile, wherever LinkedIn left it, is moved back after the name: never two.
  const host =
    [...page.querySelectorAll(`[${MARK}]`)].find(
      (element) => element.getAttribute(MARK) === profileUrl,
    ) ?? page.createElement('span');
  host.setAttribute(MARK, profileUrl);
  renderMark(host, { near: heading, hostCss: 'display: block; margin-top: 4px;', content });
  if (heading.nextElementSibling !== host) heading.after(host);
}

/** Removes the elements of the page, but the one of this profile, if any. */
function removeAll(page: Document, but: string | null = null) {
  for (const element of page.querySelectorAll(`[${MARK}]`)) {
    if (element.getAttribute(MARK) !== but) element.remove();
  }
}

/**
 * Follows the address of a LinkedIn tab (spec extension §2, §5): at each change, the background
 * recalculates the badge, and the element after the name follows, put only once the name of the right
 * profile shows, never twice. A profile that never shows its name is said in the console (§7).
 */
export function createProfileWatch({
  page,
  send,
  timeoutMs,
}: {
  page: Document;
  /** Asks the background, which sets the badge of the tab. */
  send: (message: Extract<Message, { type: 'presence' }>) => Promise<Presence>;
  /** How long LinkedIn has to show the profile: 10 s (spec extension §5). */
  timeoutMs: number;
}) {
  let latest = 0;
  return {
    async changed(url: string) {
      const run = ++latest;
      const stale = () => run !== latest;
      const profileUrl = profileUrlOf(url);
      removeAll(page, profileUrl);
      const presence = await send({ type: 'presence', url });
      if (stale()) return;
      if (profileUrl === null) return removeAll(page);
      // The API in error or the extension outdated: no element, the profile still checked.
      const content = contentOf(page, presence);
      if (content === null) removeAll(page);
      const named = await profileShown(page, url, { timeoutMs, stale });
      if (stale()) return;
      if (named === null) {
        removeAll(page);
        // For Romain, never for the API (spec extension §7, §13 A8): only the DOM can tell.
        console.warn(UNREADABLE);
        return;
      }
      if (content !== null) place(named.heading, profileUrl, content);
    },
  };
}
