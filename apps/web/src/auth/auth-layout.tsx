import { Outlet } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { AppUpdateNotice } from '../app-update.tsx';
import { OfflineNote } from '../components/ui/offline-note.tsx';
import { useLocale } from '../i18n.ts';
import { Brand } from '../shell/logo.tsx';
import { LanguageSelect } from './language-select.tsx';

/** A text link of an authentication screen. */
export const authLinkClass = 'rounded-control font-medium text-accent-text underline focus-ring';

/** The frame of every screen shown without a session: the brand, one card, the language. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <header>
        <Brand />
      </header>
      <AppUpdateNotice className="w-full max-w-sm" />
      <OfflineNote isLive className="w-full max-w-sm" />
      <main id="main" className="w-full max-w-sm rounded-card border p-6">
        <Outlet />
      </main>
      <footer>
        <LanguageSelect />
      </footer>
    </div>
  );
}

/** An authentication screen: its title in the tab and as the page's only h1. */
export function AuthScreen({ title, children }: { title: string; children?: ReactNode }) {
  // Rendered again when the language changes.
  useLocale();
  return (
    <div className="flex flex-col gap-4">
      <title>{`${title} · BattleCRM`}</title>
      <h1 className="text-lg font-semibold">{title}</h1>
      {children}
    </div>
  );
}
