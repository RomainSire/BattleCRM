import { m } from '@battlecrm/i18n';
import { useQuery } from '@tanstack/react-query';
import { Outlet } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AppUpdateNotice } from '../app-update.tsx';
import { OfflineNote } from '../components/ui/offline-note.tsx';
import { AddContactContext, type QuickAddStart } from '../contacts/add-contact-context.ts';
import { QuickAdd } from '../contacts/quick-add.tsx';
import { changeLocale, useLocale, type Locale } from '../i18n.ts';
import { useApi } from '../session.ts';
import { settingsOf, useSingleKeyShortcuts } from '../settings/use-settings.ts';
import { CommandPalette } from '../palette/command-palette.tsx';
import { PaletteContext } from '../palette/palette-context.ts';
import { isModalOpen } from '../shortcuts.ts';
import { summaryQuery } from '../summary.ts';
import { Celebration } from '../today/celebration.tsx';
import { UndoToasts } from '../undo.tsx';
import { FloatingAdd } from './floating-add.tsx';
import { GoToShortcuts } from './go-to.tsx';
import { MobileHeader, TabBar } from './mobile-navigation.tsx';
import { ShortcutsHelp } from './shortcuts-help.tsx';
import { Sidebar } from './sidebar.tsx';

/** The frame of every signed-in screen; desktop or mobile navigation is chosen by width alone (ST-02). */
export function AppShell() {
  const api = useApi();
  // Read here, once for every screen (ADR 0012).
  const { data: summary } = useQuery(summaryQuery(api));
  useUserLanguage(settingsOf(summary).locale);
  const [isAdding, setAdding] = useState(false);
  const [start, setStart] = useState<QuickAddStart>();
  const openQuickAdd = useCallback((opening?: QuickAddStart) => {
    setStart(opening);
    setAdding(true);
  }, []);
  useSingleKeyShortcuts({
    n: (event) => {
      if (isModalOpen()) return;
      // Or the letter would be typed into the field that takes the focus.
      event.preventDefault();
      openQuickAdd();
    },
  });
  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const [isHelpOpen, setHelpOpen] = useState(false);
  const palette = useMemo(
    () => ({ openPalette: () => setPaletteOpen(true), openShortcuts: () => setHelpOpen(true) }),
    [],
  );
  usePaletteShortcuts(palette);
  return (
    <AddContactContext value={openQuickAdd}>
      <PaletteContext value={palette}>
        {/* A plain in-page anchor, which also moves focus. */}
        <a
          href="#main"
          className="sr-only z-20 rounded-control bg-background px-3 py-2 font-medium focus-ring focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          {m.skip_to_content()}
        </a>
        <div className="flex min-h-dvh flex-col md:flex-row">
          <MobileHeader />
          <Sidebar onAdd={() => openQuickAdd()} />
          {/* On a phone, room for the + button above the tabs. */}
          <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-36 outline-none md:pb-0">
            <AppUpdateNotice className="border-b px-4 py-2 md:px-6" />
            <OfflineNote isLive className="border-b px-4 py-2 md:px-6" />
            <Outlet />
          </main>
          <FloatingAdd onAdd={() => openQuickAdd()} />
          <TabBar />
        </div>
        <QuickAdd isOpen={isAdding} onOpenChange={setAdding} start={start} />
        <CommandPalette
          isOpen={isPaletteOpen}
          onOpenChange={setPaletteOpen}
          onShortcuts={() => setHelpOpen(true)}
        />
        <ShortcutsHelp isOpen={isHelpOpen} onOpenChange={setHelpOpen} />
        <GoToShortcuts />
        <UndoToasts />
        <Celebration />
      </PaletteContext>
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

/**
 * `Ctrl K` opens the palette always, even from a field; `/` opens it and `?` the help of the
 * shortcuts, both single-key shortcuts (spec UX §3.3). None opens over another window.
 */
function usePaletteShortcuts({
  openPalette,
  openShortcuts,
}: {
  openPalette: () => void;
  openShortcuts: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return;
      if (event.altKey || event.shiftKey) return;
      // Or the browser would take it for its own search, the palette open or not.
      event.preventDefault();
      if (!isModalOpen()) openPalette();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openPalette]);
  useSingleKeyShortcuts({
    // Shift is how some keyboards type them (`/` and `?` on AZERTY).
    '[Shift]+/': (event) => {
      if (isModalOpen()) return;
      // Or the slash would be typed into the field of the palette.
      event.preventDefault();
      openPalette();
    },
    '[Shift]+?': (event) => {
      if (isModalOpen()) return;
      event.preventDefault();
      openShortcuts();
    },
  });
}
