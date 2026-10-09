/** "Now" for every domain timestamp: the app writes it, never a `DEFAULT now()` (spec stack §6). */
export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };
