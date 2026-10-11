import { setTimeout as wait } from 'node:timers/promises';

/** "Now" for every domain timestamp: the app writes it, never a `DEFAULT now()` (spec stack §6). */
export type Clock = {
  now(): Date;
  /** Resolves once that much time has passed: a test moves its clock instead of waiting. */
  sleep(milliseconds: number): Promise<void>;
};

export const systemClock: Clock = {
  now: () => new Date(),
  sleep: async (milliseconds) => {
    await wait(milliseconds);
  },
};
