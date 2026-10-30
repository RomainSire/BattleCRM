import { m } from '@battlecrm/i18n';
import { Button } from '@battlecrm/ui';
import { Search } from 'lucide-react';

import { usePalette } from '../palette/palette-context.ts';
import { Brand } from './logo.tsx';
import { NavLink } from './nav-link.tsx';
import { useTodayCount } from '../today/today-count.ts';
import { tabs } from './navigation.ts';

/** The narrow-width header: the brand and the magnifier, which opens the palette (spec UX §3.2, ticket 41). */
export function MobileHeader() {
  const { openPalette } = usePalette();
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b bg-background pr-1 pl-4 md:hidden">
      <Brand />
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label={m.search()}
        onPress={openPalette}
      >
        <Search className="size-5" />
      </Button>
    </header>
  );
}

/** The narrow-width bottom tabs: Today, Contacts, Funnel, More (spec UX §3.2). */
export function TabBar() {
  const todayCount = useTodayCount();
  return (
    <nav
      aria-label={m.main_menu()}
      className="fixed inset-x-0 bottom-0 z-10 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {tabs.map((entry) => (
          <li key={entry.to}>
            <NavLink
              entry={entry}
              count={entry.to === '/today' ? todayCount : undefined}
              className="min-h-14 flex-col justify-center gap-0.5 rounded-none text-xs data-current:bg-transparent data-current:text-accent-text"
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
