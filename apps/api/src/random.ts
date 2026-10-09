import { randomInt } from 'node:crypto';

/** The only source of randomness of the API (spec stack §5.3), scripted in tests. */
export type Random = {
  /** An integer in [min, max). */
  int(min: number, max: number): number;
};

export const cryptoRandom: Random = { int: (min, max) => randomInt(min, max) };
