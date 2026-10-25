// First, before any module builds a Zod schema.
import './zod-config.ts';

import { onlineManager } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import { App } from './app.tsx';
import { appUpdate } from './app-update.tsx';
import { createClientErrorReporter, reportUncaughtErrors } from './client-errors.ts';
import { applyDocumentLanguage } from './i18n.ts';
import { createQueryClient } from './query-client.ts';
import { createAppRouter } from './router.tsx';

import './index.css';

// TanStack Query assumes a network until the browser says otherwise: an app opened offline starts so.
onlineManager.setOnline(navigator.onLine);
const queryClient = createQueryClient();
const router = createAppRouter({ queryClient });

const reportError = createClientErrorReporter(
  router.options.context.api,
  import.meta.env.VITE_APP_VERSION ?? 'dev',
);
reportUncaughtErrors(reportError);

applyDocumentLanguage();

// The service worker of the installed app (ST-01): a new version waits until the User reloads.
const takeUpdate = registerSW({
  onNeedRefresh: () => appUpdate.available(),
  onRegisteredSW: (_url, registration) => {
    if (registration === undefined) return;
    appUpdate.registered({
      lookForUpdate: () => registration.update(),
      takeUpdate: () => takeUpdate(true),
    });
  },
});

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no #root');

createRoot(root, {
  // An error boundary (the router has one per route) shows a fallback: the bug is still worth an alert.
  onCaughtError(error) {
    console.error(error);
    reportError(error);
  },
}).render(
  <StrictMode>
    <App router={router} queryClient={queryClient} />
  </StrictMode>,
);
