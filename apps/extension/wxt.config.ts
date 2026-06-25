import { resolve } from 'node:path'
import { defineConfig } from 'wxt'

// Chrome public key — kept in a const so the manifest factory stays readable.
// Fixed key keeps the Chrome extension ID stable across dev reloads.
// Generated with: openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
//                 openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A
const CHROME_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzRI4nbltX8DQe/cPPCgL5+wEkNeb+TOmFa1EwXtkHESzn6lgswZKEGlmsUk4YTwvH4av31WpP20/aS9Hw5iUS5HuEJxvPWTEHvD0C8mZPj55MQoZ0Nku67x7Qhel5mKVtYXnCYrcr8NfMtrO6qyiBDAXRakoRjZPyGGiJcExktgMSfFELjxAt+gRcmvzg+KyFUhidRzQ2WzCDPhdjV65IwlXko06wUSsmz0m3aBdXIpbpN3WLiPekFpLLNgKuPc5xxVg051esHYz+Djxg3UD48eLVWB7oXlPPIb6w7qw6Hw39C92BnNS8Ro6NPlJdyCeJHE76ksgrbECc46R+44lQQIDAQAB'

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // Force MV3 on every target. WXT defaults Firefox to MV2, but our code relies on the
  // MV3 `browser.action` API (toolbar badge) — under MV2 that's `browser.browserAction`
  // and the badge logic would break. MV3 is supported by Firefox 115+.
  manifestVersion: 3,
  vite: () => ({
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
  }),
  manifest: ({ browser }) => ({
    name: 'BattleCRM',
    description: 'BattleCRM browser extension — ajoutez des prospects LinkedIn en un clic',
    permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
    host_permissions: ['*://www.linkedin.com/*'],
    icons: {
      16: 'icons/16.png',
      32: 'icons/32.png',
      48: 'icons/48.png',
      128: 'icons/128.png',
    },
    // Per-browser identity:
    // - Chrome reads `key` (deterministic ID for CORS whitelisting / stable dev reloads).
    // - Firefox needs `browser_specific_settings.gecko.id` to be signable by AMO.
    //   (Note: the runtime moz-extension:// origin is still randomized per install — the
    //   backend CORS reflects any extension-scheme origin, so that's handled server-side.)
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'battlecrm@romainsire.com',
              strict_min_version: '115.0',
              // Required by AMO for new extensions (since 2025-11-03). The extension only
              // sends data to the user's own self-hosted BattleCRM instance — no collection
              // by the developer — so we declare "none".
              data_collection_permissions: {
                required: ['none'],
              },
            },
          },
        }
      : { key: CHROME_KEY }),
  }),
})
