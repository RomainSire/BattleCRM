import { and, desc, eq, gt, ne } from 'drizzle-orm';

import { withoutIsolation } from '../db/index.ts';
import { session } from './tables.ts';
import { describeUserAgent } from './user-agent.ts';

/** A session of the User, as “Connected devices” shows it: named by its id, never by its token. */
export type ConnectedDevice = {
  id: string;
  browser: string | null;
  os: string | null;
  /** Known to the day: a session in use is written once a day (ST-16). */
  lastActiveAt: string;
  current: boolean;
};

/** The live sessions of a User, the one of this request first, then the latest used. */
export async function listSessions(
  userId: string,
  currentSessionId: string,
  now: Date,
): Promise<ConnectedDevice[]> {
  const sessions = await withoutIsolation((db) =>
    db
      .select({ id: session.id, userAgent: session.userAgent, updatedAt: session.updatedAt })
      .from(session)
      .where(and(eq(session.userId, userId), gt(session.expiresAt, now)))
      // Ids are UUID v7: the latest opened first among those used at the same time.
      .orderBy(desc(session.updatedAt), desc(session.id)),
  );
  return sessions
    .map(({ id, userAgent, updatedAt }) => ({
      id,
      ...describeUserAgent(userAgent),
      lastActiveAt: updatedAt.toISOString(),
      current: id === currentSessionId,
    }))
    .toSorted((a, b) => Number(b.current) - Number(a.current));
}

/**
 * Ends another session of the User: its device answers 401 at its next request, since no session is
 * cached in a cookie. False when there is no such session; the current one ends by signing out.
 */
export async function revokeSession(
  userId: string,
  currentSessionId: string,
  id: string,
): Promise<boolean> {
  if (id === currentSessionId) return false;
  const revoked = await withoutIsolation((db) =>
    db
      .delete(session)
      .where(and(eq(session.userId, userId), eq(session.id, id)))
      .returning({ id: session.id }),
  );
  return revoked.length > 0;
}

/** Ends every session of the User but the one of this request. */
export async function revokeOtherSessions(userId: string, currentSessionId: string): Promise<void> {
  await withoutIsolation((db) =>
    db.delete(session).where(and(eq(session.userId, userId), ne(session.id, currentSessionId))),
  );
}
