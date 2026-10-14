import { m } from '@battlecrm/i18n';
import { useQuery } from '@tanstack/react-query';
import { Outlet } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';

import { AddContactContext } from '../contacts/add-contact-context.ts';
import { QuickAdd } from '../contacts/quick-add.tsx';
import { changeLocale, useLocale, type Locale } from '../i18n.ts';
import { useApi } from '../session.ts';
import { settingsOf, useSingleKeyShortcuts } from '../settings/use-settings.ts';
import { isModalOpen } from '../shortcuts.ts';
import { summaryQuery } from '../summary.ts';
import { UndoToasts } from '../undo.tsx';
import { MobileHeader, TabBar } from './mobile-navigation.tsx';
import { Sidebar } from './sidebar.tsx';

/** The frame of every signed-in screen; desktop or mobile navigation is chosen by width alone (ST-02). */
export function AppShell() {
  const api = useApi();
  // Read here, once for every screen (ADR 0012).
  const { data: summary } = useQuery(summaryQuery(api));
  useUserLanguage(settingsOf(summary).locale);
  const [isAdding, setAdding] = useState(false);
  const openQuickAdd = useCallback(() => setAdding(true), []);
  useSingleKeyShortcuts({
    n: (event) => {
      if (isModalOpen()) return;
      // Or the letter would be typed into the field that takes the focus.
      event.preventDefault();
      setAdding(true);
    },
  });
  return (
    <AddContactContext value={openQuickAdd}>
      {/* A plain in-page anchor, which also moves focus. */}
      <a
        href="#main"
        className="sr-only z-20 rounded-control bg-background px-3 py-2 font-medium focus-ring focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {m.skip_to_content()}
      </a>
      <div className="flex min-h-dvh flex-col md:flex-row">
        <MobileHeader />
        <Sidebar onAdd={openQuickAdd} />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-20 outline-none md:pb-0">
          <Outlet />
        </main>
        <TabBar />
      </div>
      <QuickAdd isOpen={isAdding} onOpenChange={setAdding} />
      <UndoToasts />
    </AddContactContext>
  );
}

/**
 * The language of the User is the one of the app, on every device it signs in on (ST-05, ST-50);
 * before sign-in, the device chose it.
 */
function useUserLanguage(language: Locale | undefined) {
  const current = useLocale();
  useEffect(() => {
    if (language && language !== current) void changeLocale(language);
  }, [language, current]);
}
