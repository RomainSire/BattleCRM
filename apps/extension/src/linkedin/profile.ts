import { normalizeLinkedInUrl } from '@battlecrm/domain';

import type { ProfileReading } from '../messages.ts';
import {
  COMPONENT_KEY,
  CONTACT_INFO_TITLE,
  CONTRACT_TYPES,
  CURRENT_DATES,
  DEGREE,
  EXPERIENCE_KEY,
  ITEM_KEY,
  PHONE_LABEL,
  PROFILE_TITLE,
} from './landmarks.ts';
import { shownWithin, type PageWait } from './wait.ts';

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
  return keyedBlock(page, slugOf(profileUrl)) !== undefined;
}

/** The first block whose key ends with the slug, compared once normalized, and holds `name` if given. */
function keyedBlock(page: Document, slug: string, name?: string): Element | undefined {
  const selector = name === undefined ? `[${COMPONENT_KEY}]` : `[${COMPONENT_KEY}*="${name}"]`;
  for (const element of page.querySelectorAll(selector)) {
    const key = element.getAttribute(COMPONENT_KEY) ?? '';
    if (key.normalize('NFC').toLowerCase().endsWith(slug)) return element;
  }
  return undefined;
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

/**
 * The name of the profile at this address once LinkedIn shows it, `timeoutMs` at most (spec extension
 * §5, §7); `null` past that, or as soon as `stale()` says the tab moved on.
 */
export const profileShown = (page: Document, url: string, wait: PageWait) =>
  shownWithin(page, () => profileName(page, url), wait);

/** The text of an element as it reads, its spaces folded. */
const textOf = (element: Element) => element.textContent.replace(/\s+/g, ' ').trim();

/**
 * Everything the form to add a Contact is filled with (spec extension §6), each field read on its
 * own and left empty when unsure; `null` when the name cannot be read: the page then shows no
 * profile the extension can tell (spec extension §7).
 */
export function readProfile(page: Document, url: string): ProfileReading | null {
  const named = profileName(page, url);
  const profileUrl = profileUrlOf(url);
  if (named === null || profileUrl === null) return null;
  const post = currentPost(page, slugOf(profileUrl));
  return {
    name: named.name,
    jobTitle: post?.jobTitle ?? headlineOf(named.heading),
    organizationName: post?.organizationName ?? null,
    ...contactInfoOf(page, profileUrl),
  };
}

/**
 * `readProfile` once LinkedIn shows the profile at this address, `timeoutMs` at most: “Read the page
 * again” (spec extension §4). `null` when it never shows, or the tab moved on.
 */
export async function readProfileShown(
  page: Document,
  url: string,
  wait: PageWait,
): Promise<ProfileReading | null> {
  const named = await profileShown(page, url, wait);
  return named === null || wait.stale() ? null : readProfile(page, url);
}

/** The name of an Organization without the contract type after it; `null` for a type unknown. */
function withoutContractType(text: string): string | null {
  const [name, type, ...more] = text.split(' · ');
  if (name === undefined || name === '' || more.length > 0) return null;
  if (type === undefined) return name;
  return CONTRACT_TYPES.has(type) ? name : null;
}

/**
 * The post held now: the first item of Experience, if its dates run until today. Its Organization is
 * the one its `/company/` link names: after the title for a single post (“Altémis Conseil · CDI”),
 * before the posts for several in the same Organization.
 */
function currentPost(page: Document, slug: string) {
  // The items are beside the block named after the slug, in its section.
  const first = keyedBlock(page, slug, EXPERIENCE_KEY)
    ?.closest('section')
    ?.querySelector(`[${COMPONENT_KEY}^="${ITEM_KEY}"]`);
  if (first === null || first === undefined) return null;
  const links = [...first.querySelectorAll('a[href*="/company/"]')].filter(
    (link) => link.querySelector('p') !== null,
  );
  for (const link of links) {
    const texts = [...link.querySelectorAll('p')].map(textOf);
    const datesAt = texts.findIndex((text) => CURRENT_DATES.test(text));
    if (datesAt === -1) continue;
    const [jobTitle, organizationLine] = texts.slice(0, datesAt);
    if (jobTitle === undefined || jobTitle === '') return null;
    if (link === links[0])
      return {
        jobTitle,
        organizationName:
          datesAt === 2 && organizationLine ? withoutContractType(organizationLine) : null,
      };
    const group = links[0]?.querySelector('p');
    return { jobTitle, organizationName: group ? withoutContractType(textOf(group)) : null };
  }
  return null;
}

/** The headline: in the section of the name, the first line after the degree of the relation. */
function headlineOf(heading: HTMLHeadingElement): string | null {
  const after = [...(heading.closest('section')?.querySelectorAll('p') ?? [])]
    .filter((line) => heading.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING)
    .map(textOf);
  // No degree before it: rather nothing than another line.
  const headline = after.findIndex((text) => !DEGREE.test(text));
  return headline > 0 ? (after[headline] ?? null) || null : null;
}

/**
 * The e-mail and the phone, only from the window “Coordonnées” already open on this profile: the
 * extension never opens it.
 */
function contactInfoOf(page: Document, profileUrl: string) {
  const dialog = [...page.querySelectorAll('dialog[open], [role="dialog"]')].find(
    (candidate) =>
      [...candidate.querySelectorAll('*')].some(
        (element) => element.childElementCount === 0 && textOf(element) === CONTACT_INFO_TITLE,
      ) &&
      [...candidate.querySelectorAll('a[href]')].some(
        (link) => profileUrlOf(link.getAttribute('href') ?? '') === profileUrl,
      ),
  );
  if (dialog === undefined) return { email: null, phone: null };
  return { email: emailOf(dialog), phone: phoneOf(dialog) };
}

function emailOf(dialog: Element): string | null {
  const href = dialog.querySelector('a[href^="mailto:"]')?.getAttribute('href');
  if (href === null || href === undefined) return null;
  try {
    return decodeURIComponent(href.slice('mailto:'.length).split('?')[0] ?? '').trim() || null;
  } catch {
    return null;
  }
}

/** The number after its label, without its type: “0611223344 (Mobile)”. */
function phoneOf(dialog: Element): string | null {
  const label = [...dialog.querySelectorAll('p')].find((line) => textOf(line) === PHONE_LABEL);
  const value = label?.nextElementSibling;
  if (value === null || value === undefined) return null;
  return textOf(value).replace(/\s*\([^)]*\)$/, '') || null;
}
