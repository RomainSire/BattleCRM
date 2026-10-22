import { useMatchRoute } from '@tanstack/react-router';
import { cn } from 'cn';
import { Link } from 'react-aria-components';

import type { NavigationEntry } from './navigation.ts';

/**
 * A navigation entry, marked as the current page while its screen (or a page below it) is shown.
 * `dot`, when given, is the label of a teal dot after it (spec UX §3.1: “Battle conclusive”).
 */
export function NavLink({
  entry,
  className,
  dot,
}: {
  entry: NavigationEntry;
  className?: string;
  dot?: string | undefined;
}) {
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
      {dot !== undefined && (
        <>
          <span
            aria-hidden
            title={dot}
            className="ml-auto size-2 shrink-0 rounded-full bg-accent"
          />
          <span className="sr-only"> · {dot}</span>
        </>
      )}
    </Link>
  );
}
