import { and, like, lt } from 'drizzle-orm';

import { withoutIsolation } from '../db/index.ts';
import { LOGIN_WINDOW_MS } from './login-attempts.ts';
import { rateLimit, session, verification } from './tables.ts';

/**
 * Scheduled (spec stack §10.6): Better Auth refuses an expired session but only erases it when its cookie
 * comes back, and prunes its limiter when an address returns. Returns how many rows went.
 */
export async function purgeExpiredSessionsAndCounters(now: Date) {
  // The longest window of the limiter by IP address is the sign-in's.
  const countedSince = now.getTime() - LOGIN_WINDOW_MS;
  return withoutIsolation(async (db) => {
    const sessions = await db
      .delete(session)
      .where(lt(session.expiresAt, now))
      .returning({ id: session.id });
    const rateLimits = await db
      .delete(rateLimit)
      .where(lt(rateLimit.lastRequest, countedSince))
      .returning({ id: rateLimit.id });
    return { sessions: sessions.length, rateLimits: rateLimits.length };
  });
}

/**
 * Scheduled: an expired row of `verification`, told by the prefix of its identifier, is refused but never
 * erased by a click: a link of ours, or the challenge of a sign-in left at its code. Any other row
 * Better Auth writes in the same table is left alone. Returns how many went.
 */
export async function purgeExpiredLinks(prefix: string, now: Date): Promise<number> {
  const purged = await withoutIsolation((db) =>
    db
      .delete(verification)
      .where(and(like(verification.identifier, `${prefix}%`), lt(verification.expiresAt, now)))
      .returning({ id: verification.id }),
  );
  return purged.length;
}
