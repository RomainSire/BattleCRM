import { overwriteGetLocale } from '@battlecrm/i18n/runtime';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { send } from '../../messages.ts';
import { watchActiveTab } from '../../sidebar/active-tab.ts';
import { browserLocale } from '../../sidebar/locale.ts';
import { Sidebar } from '../../sidebar/sidebar.tsx';

import '../../sidebar/sidebar.css';

// The browser's language, never a choice kept in storage (spec extension §9).
const locale = browserLocale(navigator.languages);
overwriteGetLocale(() => locale);
document.documentElement.lang = locale;

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no #root');

createRoot(root).render(
  <StrictMode>
    <Sidebar send={send} appOrigin={import.meta.env.APP_ORIGIN} watchActiveTab={watchActiveTab} />
  </StrictMode>,
);
