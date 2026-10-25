import { m } from '@battlecrm/i18n';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { useSingleKeyShortcuts } from '../settings/use-settings.ts';
import { isModalOpen } from '../shortcuts.ts';
import type { NavigationEntry } from './navigation.ts';

/** `G` then a letter (spec UX §3.3). */
export const GO_TO_KEYS: Record<string, NavigationEntry['to']> = {
  a: '/today',
  e: '/circle',
  c: '/contacts',
  f: '/funnel',
  b: '/battles',
  p: '/positionings',
  i: '/insights',
  r: '/settings',
};

/** How long `G` waits for its letter. */
const GO_TO_TIMEOUT_MS = 1500;

/**
 * `G` then a letter goes to a screen (spec UX §3.3), with the hint “G …” shown while it waits. The
 * letter goes to `G` alone: no other shortcut of that key fires (the `F` of a record, say).
 */
export function GoToShortcuts() {
  const navigate = useNavigate();
  const [isWaiting, setWaiting] = useState(false);
  useSingleKeyShortcuts({
    g: (event) => {
      if (isModalOpen()) return;
      event.preventDefault();
      setWaiting(true);
    },
  });
  useEffect(() => {
    if (!isWaiting) return undefined;
    const timer = setTimeout(() => setWaiting(false), GO_TO_TIMEOUT_MS);
    const onKeyDown = (event: KeyboardEvent) => {
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
      setWaiting(false);
      const to = GO_TO_KEYS[event.key.toLowerCase()];
      if (to === undefined || event.ctrlKey || event.metaKey || event.altKey) return;
      // Before the shortcuts of the page: the letter belongs to `G`.
      event.preventDefault();
      event.stopImmediatePropagation();
      void navigate({ to });
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [isWaiting, navigate]);
  // Shown while it waits only: no notification stays behind.
  return isWaiting ? (
    <output className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-control border bg-background px-2 py-1 text-sm shadow-md">
      <span aria-hidden="true">G …</span>
      <span className="sr-only">{m.go_to_waiting()}</span>
    </output>
  ) : null;
}
