import type { ReactNode } from 'react';

/** A screen's frame: its title in the tab and as the page's only h1. */
export function Screen({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
      <title>{`${title} · BattleCRM`}</title>
      <h1 className="text-lg font-semibold">{title}</h1>
      {children}
    </div>
  );
}
