import { useEffect, useRef } from 'react';
import { tinykeys, type KeybindingsMap } from 'tinykeys';

/**
 * Global keyboard shortcuts, in the syntax of tinykeys (`n`, `$mod+z`, `g c`). None fires while the
 * User types in a field (ST-65). The keys are read once; their handlers follow each render.
 */
export function useShortcuts(bindings: KeybindingsMap): void {
  const latest = useRef(bindings);
  useEffect(() => {
    latest.current = bindings;
  });
  useEffect(
    () =>
      tinykeys(
        window,
        Object.fromEntries(
          Object.keys(latest.current).map((keys) => [
            keys,
            (event: KeyboardEvent) => latest.current[keys]?.(event),
          ]),
        ),
      ),
    [],
  );
}

/** Whether a modal has the screen: a one-letter shortcut never opens anything over it. */
export const isModalOpen = () => document.querySelector('[role="dialog"]') !== null;
