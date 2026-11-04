import type { ContactStatus } from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';

import { STATUS_LABEL } from '../status.ts';

// What the extension puts in a LinkedIn page (spec extension §5): plain DOM in a shadow root, its own
// small CSS, the colours of the theme for the page's background. The element after the name of a
// profile and the pills of a search share the look.

/** The colours of the theme (packages/theme) the marks need, light and dark. */
const COLORS = {
  light: { text: '#18181b', accent: '#0f766e', neutral: '#63636b', border: '#d4d4d8' },
  dark: { text: '#fafafa', accent: '#5eead4', neutral: '#a1a1aa', border: '#3f3f46' },
};

const CSS = `
.mark {
  display: inline-flex; align-items: center; gap: 4px;
  font: 600 12px/18px system-ui, sans-serif; white-space: nowrap;
  border: 1px solid var(--border); border-radius: 9px; padding: 0 7px 0 3px;
  color: var(--text); text-decoration: none;
}
a.mark:hover { border-color: var(--accent); }
a.mark:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
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

/** Whether LinkedIn is dark here: the first background behind this element that is no transparency. */
function onDark(near: Element): boolean {
  const view = near.ownerDocument.defaultView;
  if (view === null) return false;
  for (let element: Element | null = near; element !== null; element = element.parentElement) {
    const [r = 255, g = 255, b = 255, alpha = 1] =
      view
        .getComputedStyle(element)
        .backgroundColor.match(/[\d.]+/g)
        ?.map(Number) ?? [];
    if (alpha > 0) return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
  }
  return false;
}

/** A word of a mark, in its tone; `hidden` from screen readers, for a sign the words already say. */
export const span = (page: Document, className: string, text: string, hidden = false) => {
  const element = page.createElement('span');
  element.className = className;
  element.textContent = text;
  if (hidden) element.setAttribute('aria-hidden', 'true');
  return element;
};

/** The Status of a Contact in words, never the colour alone: “BattleCRM : Allié”, ★ unread. */
export function statusContent(page: Document, status: ContactStatus): Node[] {
  const tone = status === 'pool' || status === 'archived' ? 'neutral' : 'accent';
  return [
    span(page, 'hidden', `${m.extension_presence_of()} `),
    ...(status === 'ally' ? [span(page, 'accent', '★', true)] : []),
    span(page, tone, STATUS_LABEL[status]()),
  ];
}

/**
 * Draws the mark in the shadow root of `host`: the logo, then `content`, in the colours for the
 * background behind `near`. A link to `href`, in a new tab, when given; otherwise it only informs.
 */
export function renderMark(
  host: Element,
  {
    near,
    hostCss,
    content,
    href,
  }: { near: Element; hostCss: string; content: Node[]; href?: string },
) {
  const page = host.ownerDocument;
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const colors = COLORS[onDark(near) ? 'dark' : 'light'];
  const style = page.createElement('style');
  style.textContent = `:host { all: initial; ${hostCss} ${Object.entries(colors)
    .map(([name, value]) => `--${name}: ${value};`)
    .join(' ')} }${CSS}`;
  const mark = page.createElement(href === undefined ? 'span' : 'a');
  mark.className = 'mark';
  if (mark instanceof HTMLAnchorElement && href !== undefined) {
    mark.href = href;
    mark.target = '_blank';
    mark.rel = 'noreferrer';
  }
  mark.innerHTML = LOGO;
  mark.append(...content);
  root.replaceChildren(style, mark);
}
