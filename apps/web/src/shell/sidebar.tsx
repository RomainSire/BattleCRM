import { m } from '@battlecrm/i18n';
import { useQuery } from '@tanstack/react-query';
import { Keyboard, Plus, Search } from 'lucide-react';
import { useId } from 'react';

import { Button } from '../components/ui/button.tsx';
import { useApi } from '../session.ts';
import { hasConclusiveBattle, summaryQuery } from '../summary.ts';
import { useSettings } from '../settings/use-settings.ts';
import { Account } from './account.tsx';
import { Kbd } from './kbd.tsx';
import { Brand } from './logo.tsx';
import { NavLink } from './nav-link.tsx';
import { experimentation, prospecting, settings } from './navigation.ts';
import type { NavigationEntry } from './navigation.ts';

// The palette and shortcuts help plug into these buttons with their ticket (41).

/** The desktop navigation (spec UX §3.1). `onAdd` opens the quick add of a Contact. */
export function Sidebar({ onAdd }: { onAdd: () => void }) {
  // A key that does nothing is not shown (spec UX §3.3).
  const { singleKeyShortcuts } = useSettings();
  const dots = useDots();
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
      <Button
        variant="ghost"
        className="justify-between"
        {...(singleKeyShortcuts && { 'aria-keyshortcuts': 'N' })}
        onPress={onAdd}
      >
        <span className="flex items-center gap-2">
          <Plus />
          {m.add()}
        </span>
        {singleKeyShortcuts && <Kbd>N</Kbd>}
      </Button>
      <NavGroup label={m.prospecting()} entries={prospecting} />
      <NavGroup label={m.experimentation()} entries={experimentation} dots={dots} />
      <div className="mt-auto flex flex-col gap-0.5 border-t pt-2">
        <NavLink entry={settings} className="h-8 px-2" />
        <Button
          variant="ghost"
          className="justify-between font-normal text-muted-foreground"
          {...(singleKeyShortcuts && { 'aria-keyshortcuts': 'Shift+?' })}
        >
          <span className="flex items-center gap-2">
            <Keyboard />
            {m.shortcuts()}
          </span>
          {singleKeyShortcuts && <Kbd>?</Kbd>}
        </Button>
        <Account />
      </div>
    </nav>
  );
}

/** The dots of the menu (spec UX §3.1): a teal one on Battles while a Battle is conclusive. */
function useDots(): Partial<Record<NavigationEntry['to'], string>> {
  const { data: summary } = useQuery(summaryQuery(useApi()));
  return summary && hasConclusiveBattle(summary) ? { '/battles': m.nav_battle_conclusive() } : {};
}

function NavGroup({
  label,
  entries,
  dots = {},
}: {
  label: string;
  entries: NavigationEntry[];
  dots?: Partial<Record<NavigationEntry['to'], string>>;
}) {
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
            <NavLink entry={entry} className="h-8 px-2" dot={dots[entry.to]} />
          </li>
        ))}
      </ul>
    </div>
  );
}
