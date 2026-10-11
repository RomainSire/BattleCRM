import { m } from '@battlecrm/i18n';
import { useId } from 'react';

import { Account } from '../shell/account.tsx';
import { NavLink } from '../shell/nav-link.tsx';
import { underMore, underMoreOnDesktop } from '../shell/navigation.ts';
import type { NavigationEntry } from '../shell/navigation.ts';
import { Screen } from './screen.tsx';

/** More, on narrow widths: the rest of the menu, then what is meant for a desktop (spec UX §3.2). */
export function MoreScreen() {
  const onDesktopId = useId();
  return (
    <Screen title={m.more()}>
      <EntryList entries={underMore} />
      <section className="flex flex-col gap-1">
        <h2 id={onDesktopId} className="text-xs tracking-wide text-muted-foreground uppercase">
          {m.on_desktop()}
        </h2>
        <EntryList entries={underMoreOnDesktop} labelledBy={onDesktopId} />
      </section>
      {/* Until Settings has its Account section (spec UX §3.2): a phone must be able to sign out. */}
      <Account className="border-t pt-2" buttonClassName="min-h-11 text-foreground" />
    </Screen>
  );
}

function EntryList({ entries, labelledBy }: { entries: NavigationEntry[]; labelledBy?: string }) {
  return (
    <ul aria-labelledby={labelledBy} className="flex flex-col">
      {entries.map((entry) => (
        <li key={entry.to}>
          <NavLink entry={entry} className="min-h-11 px-2 text-foreground" />
        </li>
      ))}
    </ul>
  );
}
