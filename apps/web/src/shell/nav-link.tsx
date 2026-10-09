import { useMatchRoute } from '@tanstack/react-router';
import { cn } from 'cn';
import { Link } from 'react-aria-components';

import type { NavigationEntry } from './navigation.ts';

/** A navigation entry, marked as the current page while its screen (or a page below it) is shown. */
export function NavLink({ entry, className }: { entry: NavigationEntry; className?: string }) {
  const matchRoute = useMatchRoute();
  const isCurrent = [entry.to, ...(entry.alsoCurrentOn ?? [])].some(
    (to) => matchRoute({ to, fuzzy: true }) !== false,
  );
  const Icon = entry.icon;
  return (
    <Link
      href={entry.to}
      aria-current={isCurrent ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-control text-muted-foreground focus-ring hover:bg-surface hover:text-foreground data-current:bg-surface data-current:font-semibold data-current:text-foreground',
        className,
      )}
    >
      <Icon className="size-4 shrink-0" />
      {entry.label()}
    </Link>
  );
}
