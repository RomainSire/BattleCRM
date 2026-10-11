import { m } from '@battlecrm/i18n';
import { Outlet } from '@tanstack/react-router';

import { MobileHeader, TabBar } from './mobile-navigation.tsx';
import { Sidebar } from './sidebar.tsx';

/** The frame of every signed-in screen; desktop or mobile navigation is chosen by width alone (ST-02). */
export function AppShell() {
  return (
    <>
      {/* A plain in-page anchor, which also moves focus. */}
      <a
        href="#main"
        className="sr-only z-20 rounded-control bg-background px-3 py-2 font-medium focus-ring focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {m.skip_to_content()}
      </a>
      <div className="flex min-h-dvh flex-col md:flex-row">
        <MobileHeader />
        <Sidebar />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-20 outline-none md:pb-0">
          <Outlet />
        </main>
        <TabBar />
      </div>
    </>
  );
}
