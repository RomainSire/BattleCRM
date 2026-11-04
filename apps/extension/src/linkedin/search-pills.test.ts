import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import expected from '../../test/linkedin/expected.json';
import { pageOf } from '../../test/linkedin/pages.ts';
import type { Message, SearchMatch, SearchPresence } from '../messages.ts';
import { createSearchWatch, UNREADABLE_SEARCH } from './search-pills.ts';

const APP_ORIGIN = 'https://app.battlecrm.test';
const SEARCH = expected['search-people.html'].url;
const PAGE_2 = expected['search-people-page-2.html'].url;
const PROFILE = expected['profile-contract-type.html'].url;
/** How long the tests wait for LinkedIn to calm down before reading the page: 300 ms in Firefox. */
const DEBOUNCE_MS = 20;

/** Shows an anonymized page in the test's own document, as LinkedIn renders it in the tab. */
function show(fixture: string) {
  const page = pageOf(fixture);
  document.title = page.title;
  document.body.innerHTML = page.body.innerHTML;
}

const pills = () => [...document.querySelectorAll('[data-battlecrm-pill]')];

/** The link of the name of a result, by the text the anonymized page gives it. */
const nameLink = (name: string) =>
  [...document.querySelectorAll('p a[href*="/in/"]')].find(
    (link) => link.textContent.trim() === name,
  );

/** The text of a node a screen reader reads: what is hidden from it left out. */
function read(node: Node): string {
  if (node instanceof Element && (node.tagName === 'STYLE' || node.hasAttribute('aria-hidden')))
    return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  return [...node.childNodes].map(read).join('');
}

const textOf = (pill: Element | undefined) =>
  pill?.shadowRoot ? read(pill.shadowRoot).replaceAll(/\s+/g, ' ').trim() : undefined;

/** A background whose API knows these Contacts; `asked` keeps each batch, `hold` delays the answers. */
function background(contacts: SearchMatch[], answer?: SearchPresence) {
  const asked: string[][] = [];
  let held: Promise<void> | undefined;
  let release: (() => void) | undefined;
  return {
    asked,
    hold() {
      held = new Promise((resolve) => (release = resolve));
    },
    release: () => release?.(),
    send: async (message: Extract<Message, { type: 'searchPresence' }>) => {
      asked.push(message.urls);
      await held;
      return (
        answer ?? {
          status: 'checked' as const,
          matches: contacts.filter(({ profileUrl }) => message.urls.includes(profileUrl)),
        }
      );
    },
  };
}

const MEMBER_1: SearchMatch = {
  profileUrl: 'https://linkedin.com/in/membre-1',
  contactId: 'c-1',
  contactStatus: 'ally',
};
const MEMBER_11: SearchMatch = {
  profileUrl: 'https://linkedin.com/in/membré-11',
  contactId: 'c-11',
  contactStatus: 'prospecting',
};

function watch(send: ReturnType<typeof background>['send'], timeoutMs = 10_000) {
  return createSearchWatch({
    page: document,
    send,
    appOrigin: APP_ORIGIN,
    debounceMs: DEBOUNCE_MS,
    timeoutMs,
  });
}

/** Lets the debounce run out and the background answer. */
const settle = () => new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 5));

let stop: (() => void) | undefined;
beforeEach(() => {
  document.body.removeAttribute('style');
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.restoreAllMocks();
});

/** Starts a watch on this address; stopped after the test. */
function start(search: ReturnType<typeof watch>, url: string) {
  stop = () => void search.changed('https://www.linkedin.com/feed/');
  return search.changed(url);
}

describe('the pills of a search of people', () => {
  test('a pill right after the name of each result that is a Contact, saying its Status in words', async () => {
    show('search-people.html');
    const api = background([MEMBER_1, MEMBER_11]);

    void start(watch(api.send), SEARCH);
    await settle();

    expect(pills()).toHaveLength(2);
    expect(nameLink('Texte 15')?.nextElementSibling).toBe(pills()[0]);
    expect(nameLink('Texte 45')?.nextElementSibling).toBe(pills()[1]);
    expect(textOf(pills()[0])).toBe('BattleCRM : Allié');
    expect(textOf(pills()[1])).toBe('BattleCRM : En prospection');
    // Before the degree of the relation, in the line of the name.
    expect(pills()[0]?.nextElementSibling?.textContent.trim()).toBe('• 2e');
  });

  test('a click opens the page of the Contact in the app, in a new tab', async () => {
    show('search-people.html');

    void start(watch(background([MEMBER_1]).send), SEARCH);
    await settle();

    const link = pills()[0]?.shadowRoot?.querySelector('a');
    expect(link?.href).toBe(`${APP_ORIGIN}/contacts/c-1`);
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toContain('noreferrer');
  });

  test('an Ally shows its ★, which is not read out: the Status is', async () => {
    show('search-people.html');

    void start(watch(background([MEMBER_1]).send), SEARCH);
    await settle();

    const star = [...(pills()[0]?.shadowRoot?.querySelectorAll('*') ?? [])].find(
      (node) => node.textContent === '★',
    );
    expect(star?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  test('one check for the whole page, by the normalized address of each result', async () => {
    show('search-people.html');
    const api = background([]);

    void start(watch(api.send), SEARCH);
    await settle();

    expect(api.asked).toEqual([expected['search-people.html'].results.map(({ url }) => url)]);
    expect(pills()).toEqual([]);
  });

  test('LinkedIn changing the page again and again: read once it calms down, never twice the same result', async () => {
    show('search-people.html');
    const api = background([MEMBER_1]);

    void start(watch(api.send), SEARCH);
    for (let n = 0; n < 5; n++) {
      document.body.append(document.createElement('div'));
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS / 4));
    }
    await settle();
    document.body.append(document.createElement('div'));
    await settle();

    expect(api.asked).toHaveLength(1);
    expect(pills()).toHaveLength(1);
  });

  test('another read while the check is under way: never two pills', async () => {
    show('search-people.html');
    const api = background([MEMBER_1]);
    api.hold();

    void start(watch(api.send), SEARCH);
    await settle();
    document.body.append(document.createElement('div'));
    await settle();
    api.release();
    await settle();

    expect(api.asked).toHaveLength(1);
    expect(pills()).toHaveLength(1);
  });

  test('the next page, without a load: its results checked, their pills put', async () => {
    show('search-people.html');
    const api = background([
      MEMBER_1,
      { ...MEMBER_11, profileUrl: 'https://linkedin.com/in/membre-3' },
    ]);
    const search = watch(api.send);

    void start(search, SEARCH);
    await settle();
    show('search-people-page-2.html');
    void search.changed(PAGE_2);
    await settle();

    expect(api.asked).toHaveLength(2);
    expect(api.asked[1]).toEqual(
      expected['search-people-page-2.html'].results.map(({ url }) => url),
    );
    expect(pills()).toHaveLength(2);
    expect(nameLink('Texte 24')?.nextElementSibling).toBe(pills()[1]);
  });

  test('another page of the search while the check is under way, a result kept in its node: checked again', async () => {
    show('search-people.html');
    const api = background([MEMBER_1]);
    api.hold();
    const search = watch(api.send);

    void start(search, SEARCH);
    await settle();
    // A filter changed: LinkedIn keeps the nodes of the results that stay.
    void search.changed(`${SEARCH}&network=%5B%22S%22%5D`);
    api.release();
    await settle();

    expect(api.asked).toHaveLength(2);
    expect(pills()).toHaveLength(1);
  });

  test('a background that does not answer: the results are asked about again at the next read', async () => {
    show('search-people.html');
    const api = background([MEMBER_1]);
    let failing = true;
    const send: typeof api.send = async (message) => {
      if (failing) {
        failing = false;
        throw new Error('Could not establish connection. Receiving end does not exist.');
      }
      return api.send(message);
    };

    void start(watch(send), SEARCH);
    await settle();
    document.body.append(document.createElement('div'));
    await settle();

    expect(pills()).toHaveLength(1);
  });

  test('a page that never calms down: read all the same, a few debounces later', async () => {
    show('search-people.html');
    const api = background([MEMBER_1]);

    void start(watch(api.send), SEARCH);
    for (let n = 0; n < 40; n++) {
      document.body.append(document.createElement('div'));
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS / 2));
    }

    expect(api.asked.length).toBeGreaterThan(0);
  });

  test('a result LinkedIn shows another LinkedIn member in, its node kept: the pill of the previous one goes', async () => {
    show('search-people.html');
    const api = background([MEMBER_1]);

    void start(watch(api.send), SEARCH);
    await settle();
    const link = nameLink('Texte 15');
    link?.setAttribute('href', 'https://www.linkedin.com/in/membre-99/');
    for (const other of link?.closest('[role="listitem"]')?.querySelectorAll('a') ?? [])
      if (other.getAttribute('href')?.includes('membre-1/'))
        other.setAttribute('href', 'https://www.linkedin.com/in/membre-99/');
    await settle();

    expect(pills()).toEqual([]);
    expect(api.asked.at(-1)).toEqual(['https://linkedin.com/in/membre-99']);
  });

  test('a pill LinkedIn takes away as it renders again: put back, without asking again', async () => {
    show('search-people.html');
    const api = background([MEMBER_1]);

    void start(watch(api.send), SEARCH);
    await settle();
    pills()[0]?.remove();
    await settle();

    expect(pills()).toHaveLength(1);
    expect(nameLink('Texte 15')?.nextElementSibling).toBe(pills()[0]);
    expect(api.asked).toHaveLength(1);
  });

  test.each<[string, SearchPresence]>([
    ['without a session', { status: 'signedOut' }],
    ['the API in error', { status: 'error' }],
    ['the extension outdated', { status: 'outdated' }],
  ])('%s: no pill, and the results are asked about again at the next read', async (_, answer) => {
    show('search-people.html');
    const api = background([], answer);

    void start(watch(api.send), SEARCH);
    await settle();
    document.body.append(document.createElement('div'));
    await settle();

    expect(pills()).toEqual([]);
    expect(api.asked).toHaveLength(2);
  });

  test('off a search: nothing asked, no pill, even as the page changes', async () => {
    show('search-people.html');
    const api = background([MEMBER_1]);

    void start(watch(api.send), PROFILE);
    await settle();
    document.body.append(document.createElement('div'));
    await settle();

    expect(api.asked).toEqual([]);
    expect(pills()).toEqual([]);
  });

  test('leaving the search: its pills go, and the page is no longer watched', async () => {
    show('search-people.html');
    const api = background([MEMBER_1]);
    const search = watch(api.send);

    void start(search, SEARCH);
    await settle();
    await search.changed(PROFILE);
    document.body.append(document.createElement('div'));
    await settle();

    expect(pills()).toEqual([]);
    expect(api.asked).toHaveLength(1);
  });
});

describe('an unreadable search', () => {
  test('listitems emptied: nothing in the page, nothing asked, a warning once the wait is over', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    show('search-people.html');
    for (const item of document.querySelectorAll('[role="listitem"]')) item.replaceChildren();
    const api = background([MEMBER_1]);

    await start(watch(api.send, 200), SEARCH);

    expect(pills()).toEqual([]);
    expect(api.asked).toEqual([]);
    expect(warn.mock.calls).toEqual([[UNREADABLE_SEARCH]]);
  });

  test('a search that shows its results: no warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    show('search-people.html');

    await start(watch(background([]).send, 200), SEARCH);

    expect(warn).not.toHaveBeenCalled();
  });

  test('another address before the wait is over: no warning about the one left', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    document.body.innerHTML = '';
    const search = watch(background([]).send, 200);

    const left = start(search, SEARCH);
    await search.changed(PROFILE);
    await left;

    expect(warn).not.toHaveBeenCalled();
  });
});

/** The relative luminance of an `rgb()` colour (WCAG 2.2). */
function luminance(color: string) {
  const [r = 0, g = 0, b = 0] = (color.match(/\d+(\.\d+)?/g) ?? []).map(Number).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [light = 0, dark = 0] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('their colours, from the background measured on the page', () => {
  test.each([
    ['light', 'rgb(255, 255, 255)'],
    ['dark', 'rgb(27, 31, 35)'],
  ])(
    'LinkedIn %s: every word of a pill readable on the page (4.5:1)',
    async (_, pageBackground) => {
      show('search-people.html');
      document.body.style.backgroundColor = pageBackground;

      void start(
        watch(background([MEMBER_1, { ...MEMBER_11, contactStatus: 'pool' }]).send),
        SEARCH,
      );
      await settle();

      expect(pills()).toHaveLength(2);
      for (const pill of pills()) {
        const words = [...(pill.shadowRoot?.querySelectorAll('span') ?? [])].filter(
          (span) => span.textContent.trim() !== '' && span.closest('[aria-hidden]') === null,
        );
        expect(words.length).toBeGreaterThan(0);
        for (const word of words) {
          expect(
            contrast(getComputedStyle(word).color, pageBackground),
            `${word.textContent} on ${pageBackground}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    },
  );
});
