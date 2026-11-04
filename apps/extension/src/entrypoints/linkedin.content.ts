import { defineContentScript } from '#imports';
import { overwriteGetLocale } from '@battlecrm/i18n/runtime';

import { createProfileWatch } from '../linkedin/presence-element.ts';
import { readProfile } from '../linkedin/profile.ts';
import { send, type TabMessage } from '../messages.ts';
import { browserLocale } from '../sidebar/locale.ts';

export default defineContentScript({
  matches: ['https://www.linkedin.com/*'],
  main() {
    // The browser's language, as the sidebar (spec extension §9).
    const locale = browserLocale(navigator.languages);
    overwriteGetLocale(() => locale);

    const profile = createProfileWatch({ page: document, send, timeoutMs: 10_000 });
    void profile.changed(location.href);
    // LinkedIn moves from page to page without loading one (`pushState`): Firefox keeps the badge of
    // the previous page, so each change of address recalculates it (spec extension §2).
    // A Firefox without the Navigation API: the badge follows the loads of a page only.
    // The background, for the sidebar: what the page shows of a profile, and a Contact added or taken
    // back, which the badge and the element follow.
    browser.runtime.onMessage.addListener((message: TabMessage) => {
      if (message.type === 'readProfile')
        return Promise.resolve(readProfile(document, message.url));
      void profile.changed(location.href);
      return undefined;
    });
    if ('navigation' in window) {
      window.navigation.addEventListener('currententrychange', () => {
        void profile.changed(location.href);
      });
    }
  },
});
