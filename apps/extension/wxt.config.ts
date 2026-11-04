import { readFileSync } from 'node:fs';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'wxt';

/**
 * The one instance the extension talks to, fixed at build (spec extension §9): `APP_ORIGIN` in the
 * environment, the SPA's dev server otherwise. Whatever builds a release sets it.
 */
const appUrl = new URL(process.env['APP_ORIGIN'] ?? 'http://localhost:5173');
const appOrigin = appUrl.origin;
/**
 * The app's host for `host_permissions`, without its port: Firefox lists `http://localhost:5173/*` as
 * granted, yet still holds the background to CORS on it (checked in Firefox 159).
 */
const appHosts = `${appUrl.protocol}//${appUrl.hostname}/*`;

/** The extension carries the version of the app it ships with (spec extension §11). */
const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);

export default defineConfig({
  srcDir: 'src',
  // Explicit imports from `#imports`, never globals (spec extension §9).
  imports: false,
  browser: 'firefox',
  targetBrowsers: ['firefox'],
  manifestVersion: 3,
  // The API holds 3000 in dev.
  dev: { server: { port: 3010 } },
  vite: () => ({
    plugins: [react(), tailwindcss()],
    define: { 'import.meta.env.APP_ORIGIN': JSON.stringify(appOrigin) },
  }),
  manifest: {
    name: 'BattleCRM',
    description: 'Retrouve et ajoute tes Contacts BattleCRM depuis LinkedIn.',
    version,
    icons: { 48: 'icon.svg', 96: 'icon.svg' },
    // No popup: a click on the icon opens and closes the sidebar (spec extension §2).
    action: { default_title: 'BattleCRM', default_icon: 'icon.svg' },
    // The background reaches these without CORS; nothing else, not even `tabs` (spec extension §9).
    host_permissions: ['https://www.linkedin.com/*', appHosts],
    permissions: ['storage'],
    browser_specific_settings: {
      gecko: {
        // Fixed once and for all: AMO knows the extension by it.
        id: 'battlecrm@battlecrm.romainsire.com',
        strict_min_version: '140.0',
        // Firefox refuses to install an extension whose updates come over plain HTTP (with a misleading
        // “not compatible with application version”): the dev build, on localhost, has none.
        ...(appOrigin.startsWith('https://')
          ? { update_url: `${appOrigin}/extension/updates.json` }
          : {}),
        data_collection_permissions: { required: ['none'] },
      },
    },
  },
});
