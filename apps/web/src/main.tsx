import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.tsx';
import { createClientErrorReporter, reportUncaughtErrors } from './client-errors.ts';
import { applyDocumentLanguage } from './i18n.ts';
import { createQueryClient } from './query-client.ts';
import { createAppRouter } from './router.tsx';

import './index.css';

const queryClient = createQueryClient();
const router = createAppRouter({ queryClient });

const reportError = createClientErrorReporter(
  router.options.context.api,
  import.meta.env.VITE_APP_VERSION ?? 'dev',
);
reportUncaughtErrors(reportError);

applyDocumentLanguage();

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
