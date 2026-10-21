import { cn } from 'cn';
import { Crown } from 'lucide-react';
import type { ReactNode } from 'react';

export type RolePillKind = 'champion' | 'challenger';

/**
 * The pill of a side of a Battle, wherever it shows (Battles, the workshop): the Champion in neutral
 * with a crown, the Challenger in the accent. What it holds says which, never the colour alone.
 */
export function RolePill({ kind, children }: { kind: RolePillKind; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-base font-semibold md:text-sm',
        kind === 'champion'
          ? 'border-neutral-text/60 bg-surface text-foreground'
          : 'border-accent-text bg-accent/10 text-accent-text',
      )}
    >
      {kind === 'champion' && <Crown aria-hidden className="size-4 shrink-0 text-neutral-text" />}
      <span className="truncate">{children}</span>
    </span>
  );
}
