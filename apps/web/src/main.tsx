import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.tsx';
import { applyDocumentLanguage } from './i18n.ts';
import { createQueryClient } from './query-client.ts';
import { createAppRouter } from './router.tsx';

import './index.css';

applyDocumentLanguage();

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no #root');

createRoot(root).render(
  <StrictMode>
    <App router={createAppRouter()} queryClient={createQueryClient()} />
  </StrictMode>,
);
