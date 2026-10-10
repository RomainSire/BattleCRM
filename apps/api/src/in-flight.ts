/** The sends started after a commit and never awaited (alert pings, e-mails): tracked so that a shutdown can wait for them. */
export type InFlight = ReturnType<typeof createInFlight>;

export function createInFlight() {
  const pending = new Set<Promise<unknown>>();
  return {
    track(send: Promise<unknown>): void {
      const done = () => pending.delete(send);
      pending.add(send);
      send.then(done, done);
    },
    /** Resolves once every send has ended, or after `timeoutMs`. */
    async settle(timeoutMs: number): Promise<void> {
      let timer: NodeJS.Timeout | undefined;
      await Promise.race([
        Promise.allSettled(pending),
        new Promise((resolve) => (timer = setTimeout(resolve, timeoutMs))),
      ]);
      clearTimeout(timer);
    },
  };
}
