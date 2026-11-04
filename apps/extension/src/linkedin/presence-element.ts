import { m } from '@battlecrm/i18n';

import type { Message, Presence } from '../messages.ts';
import { STATUS_LABEL } from '../status.ts';
import { profileName, profileUrlOf } from './profile.ts';

// What the extension puts in a LinkedIn profile, right after the h2 of the name (spec extension §5):
// plain DOM in a shadow root, its own small CSS, the colours of the theme for the page's background.
// It only informs: only the icon opens the sidebar (Firefox refuses it from the page).

/** Marks the element in the page, with the profile it belongs to. */
const MARK = 'data-battlecrm-presence';

/** The colours of the theme (packages/theme) the element needs, light and dark. */
const COLORS = {
  light: { text: '#18181b', accent: '#0f766e', neutral: '#63636b', border: '#d4d4d8' },
  dark: { text: '#fafafa', accent: '#5eead4', neutral: '#a1a1aa', border: '#3f3f46' },
};

const CSS = `
:host { all: initial; display: block; margin-top: 4px; }
.mark {
  display: inline-flex; align-items: center; gap: 4px;
  font: 600 12px/18px system-ui, sans-serif; white-space: nowrap;
  border: 1px solid var(--border); border-radius: 9px; padding: 0 7px 0 3px;
  color: var(--text);
}
.mark svg { width: 14px; height: 14px; flex: none; }
.accent { color: var(--accent); }
.neutral { color: var(--neutral); }
.hidden {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}
`;

/** The logo, in line: a resource by URL would give away the extension's uuid (spec extension §5). */
const LOGO = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" stroke-width="1.5"
  stroke-linecap="round" stroke-linejoin="round"><g transform="matrix(1.14,0,0,1.14,-1.7,-1.7)">
  <path fill="#0f766e" stroke="none" d="m7 2.54c3.4-.41 6.71-.41 9.91 0 2.64.34 4.5 2.16 4.8 4.8.36 3.12.36 6.25 0 9.37-.3 2.64-2.16 4.52-4.8 4.8-3.56.37-6.86.34-9.91 0-2.64-.3-4.58-2.15-4.8-4.8-.26-3.12-.26-6.25 0-9.37.22-2.65 2.16-4.48 4.8-4.8z"/>
  <g transform="translate(0,-.42)"><path d="m18.68 8.29-2.63 2.63m-5.26 5.26-2.63 2.63c-.82.81-2.14.81-2.96 0-.82-.82-.82-2.15 0-2.97l2.63-2.63M13.08 7.95l2.63-2.63M14.97 4.58l4.45 4.45M10.44 16.53H4.89"/>
  <polyline transform="matrix(.74,0,0,.74,3.84,3.57)" points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" stroke-width="2"/>
  <path d="M13.48 17.66l4.45-4.45M15.71 15.43l2.97 2.97M17.93 19.14l1.49-1.48"/></g></g></svg>`;

/** Whether LinkedIn is dark here: the first background behind the name that is no transparency. */
function onDark(heading: Element): boolean {
  const view = heading.ownerDocument.defaultView;
  if (view === null) return false;
  for (let element: Element | null = heading; element !== null; element = element.parentElement) {
    const [r = 255, g = 255, b = 255, alpha = 1] =
      view
        .getComputedStyle(element)
        .backgroundColor.match(/[\d.]+/g)
        ?.map(Number) ?? [];
    if (alpha > 0) return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
  }
  return false;
}

const span = (page: Document, className: string, text: string, hidden = false) => {
  const element = page.createElement('span');
  element.className = className;
  element.textContent = text;
  if (hidden) element.setAttribute('aria-hidden', 'true');
  return element;
};

/** What the element says, in words: never the colour alone. */
function contentOf(page: Document, presence: Presence): Node[] | null {
  if (presence.status === 'contact') {
    const { contactStatus } = presence;
    const tone = contactStatus === 'pool' || contactStatus === 'archived' ? 'neutral' : 'accent';
    return [
      span(page, 'hidden', `${m.extension_presence_of()} `),
      ...(contactStatus === 'ally' ? [span(page, 'accent', '★', true)] : []),
      span(page, tone, STATUS_LABEL[contactStatus]()),
    ];
  }
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
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const colors = COLORS[onDark(heading) ? 'dark' : 'light'];
  const style = page.createElement('style');
  style.textContent = `:host { ${Object.entries(colors)
    .map(([name, value]) => `--${name}: ${value};`)
    .join(' ')} }${CSS}`;
  const mark = page.createElement('span');
  mark.className = 'mark';
  mark.innerHTML = LOGO;
  mark.append(...content);
  root.replaceChildren(style, mark);
  if (heading.nextElementSibling !== host) heading.after(host);
}

/** Removes the elements of the page, but the one of this profile, if any. */
function removeAll(page: Document, but: string | null = null) {
  for (const element of page.querySelectorAll(`[${MARK}]`)) {
    if (element.getAttribute(MARK) !== but) element.remove();
  }
}

/**
 * The name of the profile at this address once LinkedIn shows it, `timeoutMs` at most; `null` past
 * that, or when `stale()` says the tab moved on.
 */
function nameShown(page: Document, url: string, timeoutMs: number, stale: () => boolean) {
  return new Promise<ReturnType<typeof profileName>>((resolve) => {
    /** Whether the wait is over: the tab moved on, or the name shows. */
    const check = () => {
      if (stale()) {
        finish(null);
        return true;
      }
      const named = profileName(page, url);
      if (named !== null) finish(named);
      return named !== null;
    };
    const observer = new MutationObserver(() => void check());
    const timer = setTimeout(() => finish(null), timeoutMs);
    const finish = (named: ReturnType<typeof profileName>) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(named);
    };
    if (check()) return;
    observer.observe(page.documentElement, { childList: true, subtree: true, characterData: true });
  });
}

/**
 * Follows the address of a LinkedIn tab (spec extension §2, §5): at each change, the background
 * recalculates the badge, and the element after the name follows, put only once the name of the right
 * profile shows, never twice.
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
      const content = profileUrl === null ? null : contentOf(page, presence);
      if (profileUrl === null || content === null) return removeAll(page);
      const named = await nameShown(page, url, timeoutMs, stale);
      if (named === null) {
        if (!stale()) removeAll(page);
        return;
      }
      place(named.heading, profileUrl, content);
    },
  };
}
