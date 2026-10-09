import { m } from '@battlecrm/i18n';
import { Keyboard, Plus, Search } from 'lucide-react';
import { useId } from 'react';

import { Button } from '../components/ui/button.tsx';
import { Kbd } from './kbd.tsx';
import { Brand } from './logo.tsx';
import { NavLink } from './nav-link.tsx';
import { experimentation, prospecting, settings } from './navigation.ts';
import type { NavigationEntry } from './navigation.ts';

// The palette, quick add and shortcuts help plug into these buttons with their tickets (41, 13).
// The account's address and the sign-out button arrive with signing in (ticket 07).

/** The desktop navigation (spec UX §3.1). */
export function Sidebar() {
  return (
    <nav
      aria-label={m.main_menu()}
      className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r px-2.5 py-3 md:flex"
    >
      <div className="mb-2 px-2">
        <Brand />
      </div>
      <Button
        variant="outline"
        className="justify-between font-normal text-muted-foreground"
        aria-keyshortcuts="Control+K"
      >
        <span className="flex items-center gap-2">
          <Search />
          {m.search()}
        </span>
        <Kbd>Ctrl K</Kbd>
      </Button>
      <Button variant="ghost" className="justify-between" aria-keyshortcuts="N">
        <span className="flex items-center gap-2">
          <Plus />
          {m.add()}
        </span>
        <Kbd>N</Kbd>
      </Button>
      <NavGroup label={m.prospecting()} entries={prospecting} />
      <NavGroup label={m.experimentation()} entries={experimentation} />
      <div className="mt-auto flex flex-col gap-0.5 border-t pt-2">
        <NavLink entry={settings} className="h-8 px-2" />
        <Button
          variant="ghost"
          className="justify-between font-normal text-muted-foreground"
          aria-keyshortcuts="Shift+?"
        >
          <span className="flex items-center gap-2">
            <Keyboard />
            {m.shortcuts()}
          </span>
          <Kbd>?</Kbd>
        </Button>
      </div>
    </nav>
  );
}

function NavGroup({ label, entries }: { label: string; entries: NavigationEntry[] }) {
  const labelId = useId();
  return (
    <div className="mt-3 flex flex-col gap-0.5">
      <span
        id={labelId}
        className="px-2 pb-1 text-xs tracking-wide text-muted-foreground uppercase"
      >
        {label}
      </span>
      <ul aria-labelledby={labelId} className="flex flex-col gap-0.5">
        {entries.map((entry) => (
          <li key={entry.to}>
            <NavLink entry={entry} className="h-8 px-2" />
          </li>
        ))}
      </ul>
    </div>
  );
}
