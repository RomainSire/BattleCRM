import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import expected from '../../test/linkedin/expected.json';
import { pageOf } from '../../test/linkedin/pages.ts';
import type { Message, Presence } from '../messages.ts';
import { createProfileWatch } from './presence-element.ts';

const CAMILLE = expected['profile-contract-type.html'].url;
const JULIEN = expected['profile-out-of-network.html'].url;

/** Shows an anonymized page in the test's own document, as LinkedIn renders it in the tab. */
function show(fixture: string) {
  const page = pageOf(fixture);
  document.title = page.title;
  document.body.innerHTML = page.body.innerHTML;
}

/** The heading of the name, and what follows it. */
const headingOf = (name: string) =>
  [...document.querySelectorAll('h2')].find((h2) => h2.textContent.trim() === name);
const elements = () => [...document.querySelectorAll('[data-battlecrm-presence]')];
/** The text of a node a screen reader reads: what is hidden from it left out. */
function read(node: Node): string {
  if (node instanceof Element && (node.tagName === 'STYLE' || node.hasAttribute('aria-hidden')))
    return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  return [...node.childNodes].map(read).join('');
}

/** What the element says to a screen reader, from its shadow root. */
function textOf(element: Element | undefined) {
  return element?.shadowRoot ? read(element.shadowRoot).replaceAll(/\s+/g, ' ').trim() : undefined;
}

/** A background that answers every change of address with this presence; `asked` keeps the messages. */
function background(answer: Presence | ((url: string) => Presence)) {
  const asked: Message[] = [];
  return {
    asked,
    send: async (message: Extract<Message, { type: 'presence' }>) => {
      asked.push(message);
      return typeof answer === 'function' ? answer(message.url) : answer;
    },
  };
}

const watch = (send: ReturnType<typeof background>['send'], timeoutMs = 10_000) =>
  createProfileWatch({ page: document, send, timeoutMs });

beforeEach(() => {
  document.body.removeAttribute('style');
});

afterEach(() => {
  vi.restoreAllMocks();
});

const UNREADABLE = 'BattleCRM: unreadable profile, LinkedIn may have changed its layout';

describe('the element after the name', () => {
  test.each<[string, Presence, string]>([
    [
      'an Ally',
      { status: 'contact', contactId: 'c-1', contactStatus: 'ally' },
      'BattleCRM : Allié',
    ],
    [
      'a Contact Prospecting',
      { status: 'contact', contactId: 'c-1', contactStatus: 'prospecting' },
      'BattleCRM : En prospection',
    ],
    ['a profile to add', { status: 'notContact' }, '+ Ajouter à BattleCRM'],
    ['without a session', { status: 'signedOut' }, 'BattleCRM : se connecter'],
  ])('%s: right after the h2 of the name, once, saying so in words', async (_, presence, text) => {
    show('profile-contract-type.html');
    const { send } = background(presence);

    await watch(send).changed(CAMILLE);

    expect(elements()).toHaveLength(1);
    expect(headingOf('Camille Durand')?.nextElementSibling).toBe(elements()[0]);
    expect(textOf(elements()[0])).toBe(text);
    // It only informs: nothing to press, nothing to tab to.
    expect(elements()[0]?.shadowRoot?.querySelector('button, a, [tabindex]')).toBeNull();
  });

  test('an Ally shows its ★, which is not read out: the Status is', async () => {
    show('profile-contract-type.html');

    await watch(
      background({ status: 'contact', contactId: 'c-1', contactStatus: 'ally' }).send,
    ).changed(CAMILLE);

    const star = [...(elements()[0]?.shadowRoot?.querySelectorAll('*') ?? [])].find(
      (node) => node.textContent === '★',
    );
    expect(star?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  test.each<[string, Presence]>([
    ['the API in error', { status: 'error' }],
    ['the extension outdated', { status: 'outdated' }],
  ])('%s: nothing in the page', async (_, presence) => {
    show('profile-contract-type.html');

    await watch(background(presence).send).changed(CAMILLE);

    expect(elements()).toEqual([]);
  });

  test('the same address twice, or a navigation back to it: still one element', async () => {
    show('profile-contract-type.html');
    const profile = watch(background({ status: 'notContact' }).send);

    await profile.changed(CAMILLE);
    await profile.changed(CAMILLE);

    expect(elements()).toHaveLength(1);
  });

  test.each<[string, Presence]>([
    ['a profile to add', { status: 'notContact' }],
    ['a Contact', { status: 'contact', contactId: 'c-1', contactStatus: 'pool' }],
    ['the API in error', { status: 'error' }],
  ])(
    'without the h2 of the name (%s): no element, and a warning in the console once the wait is over',
    async (_, presence) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      show('profile-contract-type.html');
      headingOf('Camille Durand')?.remove();

      await watch(background(presence).send, 200).changed(CAMILLE);

      expect(elements()).toEqual([]);
      expect(warn.mock.calls).toEqual([[UNREADABLE]]);
    },
  );

  test('a page that never shows the profile of its address: the same warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    show('profile-out-of-network.html');

    await watch(background({ status: 'notContact' }).send, 200).changed(CAMILLE);

    expect(warn.mock.calls).toEqual([[UNREADABLE]]);
  });

  test('another address before the wait is over: no warning about the one left', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    show('profile-out-of-network.html');
    const profile = watch(background({ status: 'notContact' }).send, 200);

    const left = profile.changed(CAMILLE);
    await profile.changed(JULIEN);
    await left;

    expect(warn).not.toHaveBeenCalled();
  });

  test('a profile LinkedIn renders late: the element waits for its name', async () => {
    show('profile-out-of-network.html');
    const profile = watch(background({ status: 'notContact' }).send);

    // The address changed; the page still shows the previous profile.
    const shown = profile.changed(CAMILLE);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(elements()).toEqual([]);
    show('profile-contract-type.html');
    await shown;

    expect(elements()).toHaveLength(1);
    expect(headingOf('Camille Durand')?.nextElementSibling).toBe(elements()[0]);
  });

  test('a profile that shows: no warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    show('profile-contract-type.html');

    await watch(background({ status: 'notContact' }).send).changed(CAMILLE);

    expect(warn).not.toHaveBeenCalled();
  });

  test('another profile: the element of the previous one goes, the new one comes after its name', async () => {
    show('profile-contract-type.html');
    const profile = watch(
      background((url) =>
        url === CAMILLE
          ? { status: 'contact', contactId: 'c-1', contactStatus: 'pool' }
          : { status: 'notContact' },
      ).send,
    );
    await profile.changed(CAMILLE);

    const leaving = profile.changed(JULIEN);
    // LinkedIn keeps the page of the previous profile a moment.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(elements()).toEqual([]);
    show('profile-out-of-network.html');
    await leaving;

    expect(elements()).toHaveLength(1);
    expect(headingOf('Julien Moreau')?.nextElementSibling).toBe(elements()[0]);
    expect(textOf(elements()[0])).toBe('+ Ajouter à BattleCRM');
  });

  test('off a profile: nothing is asked about the page, and no element stays', async () => {
    show('profile-contract-type.html');
    const { send, asked } = background({ status: 'elsewhere' });
    const profile = watch(send);

    await profile.changed('https://www.linkedin.com/feed/');

    expect(asked).toEqual([{ type: 'presence', url: 'https://www.linkedin.com/feed/' }]);
    expect(elements()).toEqual([]);
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

/** The contrast of two `rgb()` colours (WCAG 2.2). */
function contrast(a: string, b: string) {
  const [light = 0, dark = 0] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('its colours, from the background measured on the page', () => {
  test.each([
    ['light', 'rgb(255, 255, 255)'],
    ['dark', 'rgb(27, 31, 35)'],
  ])('LinkedIn %s: every word of it readable on the page (4.5:1)', async (_, pageBackground) => {
    show('profile-contract-type.html');
    document.body.style.backgroundColor = pageBackground;

    for (const presence of [
      { status: 'contact', contactId: 'c-1', contactStatus: 'ally' },
      { status: 'contact', contactId: 'c-1', contactStatus: 'pool' },
      { status: 'notContact' },
      { status: 'signedOut' },
    ] satisfies Presence[]) {
      await watch(background(presence).send).changed(CAMILLE);
      const root = elements()[0]?.shadowRoot;
      const words = [...(root?.querySelectorAll('span') ?? [])].filter(
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
  });
});
