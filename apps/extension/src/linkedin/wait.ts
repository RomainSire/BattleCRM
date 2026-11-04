/** How long to wait for LinkedIn to show a page, and whether the tab moved on meanwhile. */
export type PageWait = { timeoutMs: number; stale: () => boolean };

/**
 * What `read` finds in the page once LinkedIn shows it, `timeoutMs` at most (spec extension §5, §7);
 * `null` past that, or as soon as `stale()` says the tab moved on. Read again at each change of the page.
 */
export function shownWithin<T>(
  page: Document,
  read: () => T | null,
  { timeoutMs, stale }: PageWait,
): Promise<T | null> {
  return new Promise((resolve) => {
    /** Whether the wait is over: the tab moved on, or the page shows what is read. */
    const check = () => {
      if (stale()) {
        finish(null);
        return true;
      }
      const found = read();
      if (found !== null) finish(found);
      return found !== null;
    };
    const observer = new MutationObserver(() => void check());
    const timer = setTimeout(() => finish(null), timeoutMs);
    const finish = (found: T | null) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(found);
    };
    if (check()) return;
    observer.observe(page.documentElement, { childList: true, subtree: true, characterData: true });
  });
}
