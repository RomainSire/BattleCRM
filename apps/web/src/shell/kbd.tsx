import type { ReactNode } from 'react';

/** A visible shortcut hint; the shortcut itself is announced through `aria-keyshortcuts`. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      aria-hidden="true"
      className="rounded-sm border px-1 font-sans text-xs font-normal text-muted-foreground"
    >
      {children}
    </kbd>
  );
}
