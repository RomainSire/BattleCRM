import { and, eq, gt, lt, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { RequireUser } from '../auth/index.ts';
import type { Clock } from '../clock.ts';
import { withUser, type Transaction } from '../db/index.ts';
import { gesture, POSITIONING_GESTURE_KINDS, type GESTURE_KINDS } from './tables.ts';

export type GestureKind = (typeof GESTURE_KINDS)[number];
export type PositioningGestureKind = (typeof POSITIONING_GESTURE_KINDS)[number];

const isPositioningKind = (kind: string): kind is PositioningGestureKind =>
  POSITIONING_GESTURE_KINDS.some((positioningKind) => positioningKind === kind);

/** How long the server takes a gesture back (ADR 0011); the toast itself may stay longer. */
export const UNDO_WINDOW_MS = 15 * 60_000;

/** The rows of the working summary a gesture, or its inverse, changed: what its answer carries. */
export type Touched = {
  contactIds: string[];
  removedContactIds: string[];
  organizationIds: string[];
  removedOrganizationIds: string[];
  /** Left out by the gestures on a Contact, which touch no Positioning. */
  positioningIds?: string[];
  removedPositioningIds?: string[];
};

/**
 * The inverse of a kind of gesture, written by its module next to the gesture: it deletes what the
 * gesture created and restores what it changed, in the transaction of the undo. `superseded` when a
 * later gesture, on another Contact, left nothing to restore to; it then writes nothing.
 */
export type Inverse = (
  tx: Transaction,
  made: { userId: string; contactId: string; payload: unknown },
) => Promise<Touched | 'superseded'>;

/** The inverse of a kind of gesture on a Positioning, as `Inverse` is for a Contact. */
export type PositioningInverse = (
  tx: Transaction,
  made: { userId: string; positioningId: string; payload: unknown },
) => Promise<Touched | 'superseded'>;

/** The rows of the summary as a gesture, or its inverse, left them: read by `views`, in the same transaction. */
export type ChangesOf<Changes> = (
  tx: Transaction,
  userId: string,
  touched: Touched,
) => Promise<Changes>;

/** One inverse per kind: a gesture without one does not compile. */
export type Inverses = Record<GestureKind, Inverse>;
export type PositioningInverses = Record<PositioningGestureKind, PositioningInverse>;

/** One at a time per Contact or Positioning, until the transaction ends. */
const lockSubject = (tx: Transaction, subjectId: string) =>
  tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${subjectId}, 0))`);

/**
 * One at a time per Contact, until the transaction ends: an undo and a gesture on the same Contact
 * never cross, so the undo always sees the gesture that closes its way back. A gesture that reads the
 * Contact before it writes takes it first, before any row lock, as the undo does.
 */
export const lockContact = lockSubject;

/** As `lockContact`, for a gesture on a Positioning. */
export const lockPositioning = lockSubject;

/** What a gesture touched: a Contact, or a Positioning of the workshop. */
type Subject =
  | { kind: GestureKind; contactId: string }
  | { kind: PositioningGestureKind; positioningId: string };

/**
 * Remembers a gesture in its own transaction, and returns the token that undoes it.
 * Gestures too old to be undone are forgotten on the way: no job could, under row level security.
 */
export async function recordGesture(
  tx: Transaction,
  made: { userId: string; payload: unknown; now: Date } & Subject,
): Promise<string> {
  const { userId, kind, payload, now } = made;
  const subject =
    'contactId' in made
      ? { contactId: made.contactId, positioningId: null }
      : { contactId: null, positioningId: made.positioningId };
  await lockSubject(tx, subject.contactId ?? subject.positioningId);
  await tx
    .delete(gesture)
    .where(
      and(
        eq(gesture.userId, userId),
        lt(gesture.performedAt, new Date(now.getTime() - UNDO_WINDOW_MS)),
      ),
    );
  const [recorded] = await tx
    .insert(gesture)
    .values({ userId, kind, ...subject, payload, performedAt: now })
    .returning({ id: gesture.id });
  if (!recorded) throw new Error('A gesture was not recorded');
  return recorded.id;
}

const REFUSAL_STATUS = { not_found: 404, expired: 409, superseded: 409 } as const;

/** “Undo” (ADR 0011, spec stack §5.4). */
export function createGestures<Changes>({
  clock,
  requireUser,
  inverses,
  positioningInverses,
  changesOf,
}: {
  clock: Clock;
  requireUser: RequireUser;
  inverses: Inverses;
  positioningInverses: PositioningInverses;
  changesOf: ChangesOf<Changes>;
}) {
  const routes = new Hono<AppEnv>().post('/gestures/:id/undo', requireUser, async (c) => {
    const { userId } = c.var;
    const id = z.uuid().safeParse(c.req.param('id'));
    // Another User's gesture, one already undone and an unknown id answer alike.
    if (!id.success) return c.json({ error: 'not_found' as const }, 404);
    const outcome = await withUser(userId, async (tx) => {
      const [made] = await tx
        .select()
        .from(gesture)
        .where(and(eq(gesture.userId, userId), eq(gesture.id, id.data)))
        .for('update');
      if (!made) return { refused: 'not_found' as const };
      if (clock.now().getTime() - made.performedAt.getTime() > UNDO_WINDOW_MS) {
        return { refused: 'expired' as const };
      }
      const subjectId = made.contactId ?? made.positioningId;
      if (subjectId === null) throw new Error('A gesture touched nothing');
      await lockSubject(tx, subjectId);
      // Later by the clock of the app, like the 15 minutes; made at the same instant, by its id (uuidv7).
      const [later] = await tx
        .select({ id: gesture.id })
        .from(gesture)
        .where(
          and(
            eq(gesture.userId, userId),
            made.contactId === null
              ? eq(gesture.positioningId, subjectId)
              : eq(gesture.contactId, subjectId),
            or(
              gt(gesture.performedAt, made.performedAt),
              and(eq(gesture.performedAt, made.performedAt), gt(gesture.id, made.id)),
            ),
          ),
        )
        .limit(1);
      if (later) return { refused: 'superseded' as const };
      const { kind, payload } = made;
      const touched = isPositioningKind(kind)
        ? await positioningInverses[kind](tx, { userId, positioningId: subjectId, payload })
        : await inverses[kind](tx, { userId, contactId: subjectId, payload });
      if (touched === 'superseded') return { refused: touched };
      await tx.delete(gesture).where(and(eq(gesture.userId, userId), eq(gesture.id, made.id)));
      return { changes: await changesOf(tx, userId, touched) };
    });
    if ('refused' in outcome) {
      return c.json({ error: outcome.refused }, REFUSAL_STATUS[outcome.refused]);
    }
    return c.json(outcome, 200);
  });
  return { routes };
}
