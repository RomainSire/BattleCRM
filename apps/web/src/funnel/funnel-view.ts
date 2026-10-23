import { useState } from 'react';

/** How the Funnel shows on a wide screen: the kanban, or the table (spec UX §5.2). */
export type FunnelView = 'kanban' | 'table';

/** The last choice is a device preference, not a User one (ST-55). */
const storageKey = 'battlecrm.funnel-view';

export const isFunnelView = (value: unknown): value is FunnelView =>
  value === 'kanban' || value === 'table';

// Storage can throw (private mode, blocked site data): the choice then lives on screen only.
function readView(): FunnelView {
  try {
    const stored = localStorage.getItem(storageKey);
    return isFunnelView(stored) ? stored : 'kanban';
  } catch {
    return 'kanban';
  }
}

function writeView(view: FunnelView) {
  try {
    localStorage.setItem(storageKey, view);
  } catch {
    // Kept in memory only.
  }
}

/** The view of the Funnel, the kanban by default, kept on the device. */
export function useFunnelView(): [FunnelView, (view: FunnelView) => void] {
  const [view, setView] = useState(readView);
  return [
    view,
    (next) => {
      writeView(next);
      setView(next);
    },
  ];
}
