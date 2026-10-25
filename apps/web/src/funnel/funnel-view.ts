import { useSyncExternalStore } from 'react';

/** How the Funnel shows on a wide screen: the kanban, or the table (spec UX §5.2). */
export type FunnelView = 'kanban' | 'table';

/** The last choice is a device preference, not a User one (ST-55). */
const storageKey = 'battlecrm.funnel-view';

export const isFunnelView = (value: unknown): value is FunnelView =>
  value === 'kanban' || value === 'table';

// Storage can throw (private mode, blocked site data): the choice then lives in memory only.
let inMemory: FunnelView = 'kanban';

function readView(): FunnelView {
  try {
    const stored = localStorage.getItem(storageKey);
    return isFunnelView(stored) ? stored : 'kanban';
  } catch {
    return inMemory;
  }
}

function writeView(view: FunnelView) {
  inMemory = view;
  try {
    localStorage.setItem(storageKey, view);
  } catch {
    // Kept in memory only.
  }
}

/** Who shows the view: the Funnel, and anything that changes it (the palette, spec UX §3.3). */
const listeners = new Set<() => void>();

/** Changes the view of the Funnel, kept on the device, wherever it is shown. */
export function setFunnelView(view: FunnelView) {
  writeView(view);
  for (const listener of listeners) listener();
}

/** The view of the Funnel, the kanban by default, kept on the device. */
export function useFunnelView(): [FunnelView, (view: FunnelView) => void] {
  const view = useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, readView);
  return [view, setFunnelView];
}

/** The other view than the one shown. */
export const otherFunnelView = (): FunnelView => (readView() === 'table' ? 'kanban' : 'table');
