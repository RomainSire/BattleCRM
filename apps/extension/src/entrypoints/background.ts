import { defineBackground } from '#imports';

import { createBackground } from '../background/background.ts';
import type { Message } from '../messages.ts';

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
  });

  browser.runtime.onMessage.addListener((message: Message, sender) =>
    // Only the extension's own pages and content scripts.
    sender.id === browser.runtime.id ? background.handle(message) : undefined,
  );
});
