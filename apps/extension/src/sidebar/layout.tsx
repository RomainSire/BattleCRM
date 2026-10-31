import type { ReactNode } from 'react';

/** The title of a screen of the sidebar: the page's only h1. */
export function ScreenTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-lg font-semibold">{children}</h1>;
}

/** A text link of the sidebar. */
export const linkClass = 'rounded-control font-medium text-accent-text underline focus-ring';
