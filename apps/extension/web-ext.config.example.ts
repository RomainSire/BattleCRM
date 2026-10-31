import { defineWebExtConfig } from 'wxt';

/**
 * `pnpm --filter @battlecrm/extension dev` opens Firefox on a profile of its own, kept from one run to
 * the next so that LinkedIn stays signed in (spec extension §9). Copy this file to `web-ext.config.ts`
 * (git-ignored) and give the folder of that profile: any folder, empty the first time (`mkdir -p` it).
 */
export default defineWebExtConfig({
  firefoxProfile: '/home/me/.battlecrm/firefox-dev',
  keepProfileChanges: true,
  startUrls: ['https://www.linkedin.com/feed/'],
});
