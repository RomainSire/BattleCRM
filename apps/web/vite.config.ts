import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installed on a phone's home screen (ST-01); offline, the shell opens from the precache and reads
    // the summary kept in IndexedDB (ADR 0004).
    VitePWA({
      // A new version waits for the User to reload: never forced (spec stack §3).
      registerType: 'prompt',
      // Registered by main.tsx, which hears of new versions.
      injectRegister: false,
      manifest: {
        name: 'BattleCRM',
        short_name: 'BattleCRM',
        lang: 'fr',
        start_url: '/today',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0f766e',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The shell alone: no response of the API is ever cached, so the only copy of a User's data
        // is the one IndexedDB keeps, erased in one place (ST-04).
        // The manifest's icons come on their own.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // Above Workbox's 2 MiB, the bundle would silently leave the precache and the app would not
        // open offline.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    // The API runs on its own port in dev; production serves both on the same origin (spec stack §1).
    proxy: { '/api': 'http://localhost:3000' },
  },
});
