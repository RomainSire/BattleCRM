import { normalizeLinkedInUrl } from '@battlecrm/domain';

import { COMPONENT_KEY, PROFILE_TITLE } from './landmarks.ts';

// What the extension reads on a LinkedIn profile (spec extension §6): from a `Document` and the address
// of its tab, never `document` nor `location`. Never a wrong value: rather nothing.

/** The address of the profile a page belongs to, normalized (ST-93); `null` off a profile. */
export function profileUrlOf(url: string): string | null {
  const normalized = normalizeLinkedInUrl(url);
  return normalized !== null && /\/in\/[^/]+$/.test(normalized) ? normalized : null;
}

const slugOf = (profileUrl: string) => profileUrl.slice(profileUrl.lastIndexOf('/') + 1);

/**
 * The guard: the page shows the profile of its address. During a navigation within LinkedIn, the
 * address changes before the page: a block named after the slug says the new profile is there.
 */
function showsProfile(page: Document, profileUrl: string): boolean {
  const slug = slugOf(profileUrl);
  for (const element of page.querySelectorAll(`[${COMPONENT_KEY}]`)) {
    const key = element.getAttribute(COMPONENT_KEY) ?? '';
    if (key.normalize('NFC').toLowerCase().endsWith(slug)) return true;
  }
  return false;
}

/**
 * The name of the profile shown, as the page title gives it, kept as it is (“Faïza B.” stays so), and
 * the `h2` that shows exactly this text: the anchor of what the extension puts in the page. `null`
 * off a profile, while the page still shows another one, or without that `h2`.
 */
export function profileName(
  page: Document,
  url: string,
): { name: string; heading: HTMLHeadingElement } | null {
  const profileUrl = profileUrlOf(url);
  if (profileUrl === null || !showsProfile(page, profileUrl)) return null;
  const name = PROFILE_TITLE.exec(page.title.trim())?.[1];
  if (name === undefined) return null;
  for (const heading of page.querySelectorAll('h2')) {
    if (heading.textContent.trim() === name) return { name, heading };
  }
  return null;
}
