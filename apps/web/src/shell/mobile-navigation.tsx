import { m } from '@battlecrm/i18n';
import { Search } from 'lucide-react';

import { Button } from '../components/ui/button.tsx';
import { Brand } from './logo.tsx';
import { NavLink } from './nav-link.tsx';
import { tabs } from './navigation.ts';

/** The narrow-width header: the brand and the magnifier, which opens the palette (spec UX §3.2, ticket 41). */
export function MobileHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b bg-background pr-1 pl-4 md:hidden">
      <Brand />
      <Button variant="ghost" size="icon" className="size-11" aria-label={m.search()}>
        <Search className="size-5" />
      </Button>
    </header>
  );
}

/** The narrow-width bottom tabs: Today, Contacts, Funnel, More (spec UX §3.2). */
export function TabBar() {
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
              className="min-h-14 flex-col justify-center gap-0.5 rounded-none text-xs data-current:bg-transparent data-current:text-accent-text"
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
