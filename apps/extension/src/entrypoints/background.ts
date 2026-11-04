import { defineBackground } from '#imports';

import { createBackground } from '../background/background.ts';
import type { Message, TabMessage } from '../messages.ts';

/** Teal for a Contact, as the app's accent; grey for one to add; amber to sign in or for an error. */
const BADGE_COLORS = { '✓': '#0f766e', '+': '#52525b', '!': '#b45309' } as const;

// An event page (spec extension §9): Firefox stops it after 30 s of quiet and wakes it for an event,
// so every listener is added at once, before anything is awaited.
export default defineBackground(() => {
  // Synchronous: Firefox opens the sidebar only within the click's gesture (spec extension §2).
  browser.action.onClicked.addListener(() => {
    void browser.sidebarAction.toggle();
  });

  const background = createBackground({
    appOrigin: import.meta.env.APP_ORIGIN,
    version: browser.runtime.getManifest().version,
    storage: browser.storage.local,
    fetch: (input, init) => globalThis.fetch(input, init),
    setBadge: async (tabId, badge) => {
      await browser.action.setBadgeText({ tabId, text: badge });
      if (badge !== '')
        await browser.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLORS[badge] });
    },
    // The content script of the tab answers; a tab without one (a page still loading, one loaded
    // before the extension, or off LinkedIn) rejects.
    tabs: {
      read: (tabId, url, timeoutMs) =>
        browser.tabs.sendMessage(tabId, {
          type: 'readProfile',
          url,
          timeoutMs,
        } satisfies TabMessage),
      refresh: async (tabId) => {
        await browser.tabs
          .sendMessage(tabId, { type: 'refresh' } satisfies TabMessage)
          .catch(() => undefined);
      },
    },
    readTimeoutMs: 10_000,
  });

  browser.runtime.onMessage.addListener((message: Message, sender) =>
    // Only the extension's own pages and content scripts.
    sender.id === browser.runtime.id ? background.handle(message, sender.tab?.id) : undefined,
  );
});
