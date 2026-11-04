import { defineContentScript } from '#imports';
import { overwriteGetLocale } from '@battlecrm/i18n/runtime';

import { createProfileWatch } from '../linkedin/presence-element.ts';
import { profileUrlOf, readProfile, readProfileShown } from '../linkedin/profile.ts';
import { send, type TabMessage } from '../messages.ts';
import { browserLocale } from '../sidebar/locale.ts';

export default defineContentScript({
  matches: ['https://www.linkedin.com/*'],
  main() {
    // The browser's language, as the sidebar (spec extension §9).
    const locale = browserLocale(navigator.languages);
    overwriteGetLocale(() => locale);

    /** How long LinkedIn has to show a profile (spec extension §5, §7). */
    const timeoutMs = 10_000;
    const profile = createProfileWatch({ page: document, send, timeoutMs });
    void profile.changed(location.href);
    // LinkedIn moves from page to page without loading one (`pushState`): Firefox keeps the badge of
    // the previous page, so each change of address recalculates it (spec extension §2).
    // A Firefox without the Navigation API: the badge follows the loads of a page only.
    // The background, for the sidebar: what the page shows of a profile, and a Contact added or taken
    // back, which the badge and the element follow.
    browser.runtime.onMessage.addListener((message: TabMessage) => {
      if (message.type === 'readProfile') {
        const { url, timeoutMs: waitMs } = message;
        if (waitMs === 0) return Promise.resolve(readProfile(document, url));
        // The tab moved on to another profile, or off one: the profile waited for is gone.
        const stale = () => profileUrlOf(location.href) !== profileUrlOf(url);
        // The page being left, as a load starts: as if no content script answered, to be asked again.
        if (stale()) return Promise.reject(new Error('This page shows another address'));
        return readProfileShown(document, url, { timeoutMs: waitMs, stale });
      }
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
