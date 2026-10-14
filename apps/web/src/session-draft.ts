import { useState } from 'react';
import type { z } from 'zod';

/** Reads a draft back, if this tab kept one that still has its shape. */
function readDraft<T>(key: string, schema: z.ZodType<T>): T | undefined {
  try {
    const kept = sessionStorage.getItem(key);
    if (kept === null) return undefined;
    const parsed = schema.safeParse(JSON.parse(kept));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The draft of an open panel, kept in `sessionStorage` (ST-70): when the browser drops the tab while
 * the User is in another app, the panel comes back as it was left. `clear` forgets it, once the panel
 * is sent or closed.
 */
export function useSessionDraft<T>(
  key: string,
  initial: T,
  schema: z.ZodType<T>,
): [T, (draft: T) => void, () => void] {
  const [draft, setDraft] = useState(() => readDraft(key, schema) ?? initial);
  const update = (next: T) => {
    setDraft(next);
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage refused (private mode, quota): the panel still works, it only won't come back.
    }
  };
  const clear = () => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Nothing was kept.
    }
  };
  return [draft, update, clear];
}
