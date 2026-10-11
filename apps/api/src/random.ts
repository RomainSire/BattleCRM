import { randomBytes, randomInt } from 'node:crypto';

/** The only source of randomness of the API (spec stack §5.3), scripted in tests. */
export type Random = {
  /** An integer in [min, max). */
  int(min: number, max: number): number;
  /** An unguessable, URL-safe secret for a single-use link. */
  token(): string;
  /** That many unguessable bytes. */
  bytes(length: number): Buffer;
};

export const cryptoRandom: Random = {
  int: (min, max) => randomInt(min, max),
  token: () => randomBytes(32).toString('base64url'),
  bytes: (length) => randomBytes(length),
};
