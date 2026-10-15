import { and, eq, gt, lt, or, sql } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { RequireUser, SignedInEnv } from '../auth/index.ts';
import type { Clock } from '../clock.ts';
import { withUser, type Transaction } from '../db/index.ts';
import { answerRefusal, refusal, type Refusal, type RefusalCode } from '../refusals.ts';
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
  positioningIds: string[];
  removedPositioningIds: string[];
};

/** The rows a gesture touched, every kind it names nothing of left empty. */
export const touched = (rows: Partial<Touched>): Touched => ({
  contactIds: [],
  removedContactIds: [],
  organizationIds: [],
  removedOrganizationIds: [],
  positioningIds: [],
  removedPositioningIds: [],
  ...rows,
});

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
 * One at a time per Positioning, until the transaction ends: an undo and a gesture on the same one
 * never cross, so the undo always sees the gesture that closes its way back. A gesture that reads it
 * before it writes takes it first, before any row lock, as the undo does.
 */
export const lockPositioning = lockSubject;

/** The column of `gesture` that names what a gesture touched: a later one on it closes the way back. */
type SubjectColumn = 'contactId' | 'positioningId';

/** What a gesture touched, as the old circuit names it: a Contact, or a Positioning of the workshop. */
type Subject =
  | { kind: GestureKind; contactId: string }
  | { kind: PositioningGestureKind; positioningId: string };

/**
 * Remembers a gesture in its own transaction, and returns the token that undoes it.
 * Gestures too old to be undone are forgotten on the way: no job could, under row level security.
 */
export function recordGesture(
  tx: Transaction,
  made: { userId: string; payload: unknown; now: Date } & Subject,
): Promise<string> {
  return 'contactId' in made
    ? record(tx, { ...made, column: 'contactId', subjectId: made.contactId })
    : record(tx, { ...made, column: 'positioningId', subjectId: made.positioningId });
}

/** Records a gesture on the subject its column names, whatever the circuit that made it. */
async function record(
  tx: Transaction,
  made: {
    userId: string;
    kind: GestureKind | PositioningGestureKind;
    column: SubjectColumn;
    subjectId: string;
    payload: unknown;
    now: Date;
  },
): Promise<string> {
  const { userId, kind, column, subjectId, payload, now } = made;
  await lockSubject(tx, subjectId);
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
    .values({ userId, kind, [column]: subjectId, payload, performedAt: now })
    .returning({ id: gesture.id });
  if (!recorded) throw new Error('A gesture was not recorded');
  return recorded.id;
}

/**
 * What gestures act on, one at a time (ADR 0011): a Contact, a Positioning… A new one, the Battle,
 * comes with its column in `gesture` and its own loader, never a branch of the circuit.
 */
export type GestureSubject<Row> = {
  column: SubjectColumn;
  /** Reads it, already locked; `undefined` when the User has none by this id. */
  load: (tx: Transaction, userId: string, id: string) => Promise<Row | undefined>;
};

/** What the writes of a gesture are given: what the User sent, and when. */
export type Made<Input> = { tx: Transaction; userId: string; input: Input; now: Date };

/** What each step of a gesture is given: the subject as it stood once locked, and what the User sent. */
export type Performed<Row, Input> = Made<Input> & { subjectId: string; subject: Row };

/** What the writes of a gesture leave: what its inverse needs, and the summary rows they changed. */
export type Written<Retained> = { retained: Retained; touched: Touched };

/** What every undoable gesture declares (ADR 0011): its kind, its subject, what it retains, its inverse. */
type Undoable<Kind extends GestureKind | PositioningGestureKind, Retained> = {
  kind: Kind;
  subject: { column: SubjectColumn };
  /** What it retains to be undone, as `gesture` keeps it. */
  retained: z.ZodType<Retained>;
  /**
   * Its inverse, in the transaction of the undo, the subject locked: it deletes what the gesture
   * created and restores what it changed. `superseded` when a later gesture, on another subject, left
   * nothing to restore to; it then writes nothing.
   */
  inverse: (
    tx: Transaction,
    undone: { userId: string; subjectId: string; retained: Retained },
  ) => Promise<Touched | 'superseded'>;
};

/**
 * An undoable gesture on a subject that exists (ADR 0011), as its module declares it: only what varies
 * from one to the next. The circuit does the rest: the id, the transaction, the lock, the subject or
 * 404, the record of the gesture, the rows of the summary it changed, its token, the answer.
 */
export type Gesture<
  Kind extends GestureKind | PositioningGestureKind,
  Row,
  Input,
  Retained,
  Code extends RefusalCode,
> = Undoable<Kind, Retained> & {
  subject: GestureSubject<Row>;
  /** Its preconditions: a refusal before anything is written. */
  refuse?: (performed: Performed<Row, Input>) => Promise<Refusal<Code> | undefined>;
  /** Its writes. Still refused when the data decides it (a unique index…): what it wrote is rolled back. */
  write: (performed: Performed<Row, Input>) => Promise<Written<Retained> | Refusal<Code>>;
};

/**
 * An undoable gesture that creates its subject, as adding a Contact does: no id to read, nothing to
 * load first. Its writes name the subject they created, locked when the gesture is recorded.
 */
export type Creation<
  Kind extends GestureKind | PositioningGestureKind,
  Input,
  Retained,
  Code extends RefusalCode,
> = Undoable<Kind, Retained> & {
  write: (
    made: Made<Input>,
  ) => Promise<(Written<Retained> & { subjectId: string }) | Refusal<Code>>;
};

// oxlint-disable-next-line typescript/no-explicit-any -- any gesture, whatever its subject and retained.
type AnyGesture = Undoable<GestureKind | PositioningGestureKind, any>;

/** Thrown when the writes of a gesture are refused, so that its transaction rolls them back. */
class RolledBack extends Error {}

/** A route that names its subject by `:id`, behind `requireUser`. */
type SubjectRoute = Context<SignedInEnv, string, object>;

/**
 * The common circuit of a gesture: `perform` answers a route that names its subject by `:id`, `create`
 * one whose gesture creates it.
 */
export function createCircuit<Changes>({
  clock,
  changesOf,
}: {
  clock: Clock;
  changesOf: ChangesOf<Changes>;
}) {
  /**
   * Runs the writes of a gesture in a transaction of its own, then records it: the rows of the
   * summary it changed and its token, or the refusal, before or during its writes.
   */
  async function run<
    Kind extends GestureKind | PositioningGestureKind,
    Retained,
    Code extends RefusalCode,
  >(
    userId: string,
    declared: Undoable<Kind, Retained>,
    writes: (
      tx: Transaction,
      now: Date,
    ) => Promise<(Written<Retained> & { subjectId: string }) | Refusal<Code>>,
  ) {
    const now = clock.now();
    let refusedWrites: Refusal<Code> | undefined;
    return withUser(userId, async (tx) => {
      const written = await writes(tx, now);
      if ('error' in written) {
        refusedWrites = written;
        throw new RolledBack(written.error);
      }
      const undoToken = await record(tx, {
        userId,
        kind: declared.kind,
        column: declared.subject.column,
        subjectId: written.subjectId,
        payload: written.retained,
        now,
      });
      return { changes: await changesOf(tx, userId, written.touched), undoToken };
    }).catch((error: unknown) => {
      if (error instanceof RolledBack && refusedWrites) return refusedWrites;
      throw error;
    });
  }

  async function perform<
    Kind extends GestureKind | PositioningGestureKind,
    Row,
    Input,
    Retained,
    Code extends RefusalCode,
  >(c: SubjectRoute, declared: Gesture<Kind, Row, Input, Retained, Code>, input: Input) {
    const { userId } = c.var;
    const id = z.uuid().safeParse(c.req.param('id'));
    // Another User's subject, an unknown one and an id that is none answer alike.
    if (!id.success) return answerRefusal(c, refusal('not_found'));
    const subjectId = id.data;
    const outcome = await run<Kind, Retained, Code | 'not_found'>(
      userId,
      declared,
      async (tx, now) => {
        await lockSubject(tx, subjectId);
        const subject = await declared.subject.load(tx, userId, subjectId);
        if (subject === undefined) return refusal('not_found');
        const performed = { tx, userId, subjectId, subject, input, now };
        const refused = await declared.refuse?.(performed);
        if (refused) return refused;
        const written = await declared.write(performed);
        return 'error' in written ? written : { ...written, subjectId };
      },
    );
    if ('error' in outcome) return answerRefusal<Code | 'not_found'>(c, outcome);
    return c.json(outcome, 200);
  }

  async function create<
    Kind extends GestureKind | PositioningGestureKind,
    Input,
    Retained,
    Code extends RefusalCode,
  >(c: SubjectRoute, declared: Creation<Kind, Input, Retained, Code>, input: Input) {
    const outcome = await run(c.var.userId, declared, (tx, now) =>
      declared.write({ tx, userId: c.var.userId, input, now }),
    );
    if ('error' in outcome) return answerRefusal<Code>(c, outcome);
    return c.json(outcome, 201);
  }

  return { perform, create };
}

/** “Undo” (ADR 0011, spec stack §5.4). */
export function createGestures<Changes, Declared extends AnyGesture>({
  clock,
  requireUser,
  gestures,
  inverses,
  positioningInverses,
  changesOf,
}: {
  clock: Clock;
  requireUser: RequireUser;
  /** The gestures of the common circuit, each with its inverse. */
  gestures: readonly Declared[];
  /** The inverses of the gestures on a Contact still outside the circuit. */
  inverses: Omit<Inverses, Declared['kind']>;
  positioningInverses: PositioningInverses;
  changesOf: ChangesOf<Changes>;
}) {
  const inCircuitByKind = new Map<string, AnyGesture>(
    gestures.map((declared) => [declared.kind, declared]),
  );
  const routes = new Hono<AppEnv>().post('/gestures/:id/undo', requireUser, async (c) => {
    const { userId } = c.var;
    const id = z.uuid().safeParse(c.req.param('id'));
    // Another User's gesture, one already undone and an unknown id answer alike.
    if (!id.success) return answerRefusal(c, refusal('not_found'));
    const outcome = await withUser(userId, async (tx) => {
      const [made] = await tx
        .select()
        .from(gesture)
        .where(and(eq(gesture.userId, userId), eq(gesture.id, id.data)))
        .for('update');
      if (!made) return refusal('not_found');
      if (clock.now().getTime() - made.performedAt.getTime() > UNDO_WINDOW_MS) {
        return refusal('expired');
      }
      const { kind, payload } = made;
      const inCircuit = inCircuitByKind.get(kind);
      const column =
        inCircuit?.subject.column ?? (isPositioningKind(kind) ? 'positioningId' : 'contactId');
      const subjectId = made[column];
      if (subjectId === null) throw new Error('A gesture touched nothing');
      await lockSubject(tx, subjectId);
      // Later by the clock of the app, like the 15 minutes; made at the same instant, by its id (uuidv7).
      const [later] = await tx
        .select({ id: gesture.id })
        .from(gesture)
        .where(
          and(
            eq(gesture.userId, userId),
            eq(gesture[column], subjectId),
            or(
              gt(gesture.performedAt, made.performedAt),
              and(eq(gesture.performedAt, made.performedAt), gt(gesture.id, made.id)),
            ),
          ),
        )
        .limit(1);
      if (later) return refusal('superseded');
      const restored = inCircuit
        ? await inCircuit.inverse(tx, {
            userId,
            subjectId,
            retained: inCircuit.retained.parse(payload),
          })
        : await oldInverse(tx, { userId, subjectId, kind, payload });
      if (restored === 'superseded') return refusal(restored);
      await tx.delete(gesture).where(and(eq(gesture.userId, userId), eq(gesture.id, made.id)));
      return { changes: await changesOf(tx, userId, restored) };
    });
    if ('error' in outcome) return answerRefusal(c, outcome);
    return c.json(outcome, 200);
  });

  /** The inverse of a gesture still outside the circuit. */
  function oldInverse(
    tx: Transaction,
    {
      userId,
      subjectId,
      kind,
      payload,
    }: {
      userId: string;
      subjectId: string;
      kind: GestureKind | PositioningGestureKind;
      payload: unknown;
    },
  ) {
    if (isPositioningKind(kind)) {
      return positioningInverses[kind](tx, { userId, positioningId: subjectId, payload });
    }
    const inverse = (inverses as Partial<Inverses>)[kind];
    if (!inverse) throw new Error(`No inverse for the gesture ${kind}`);
    return inverse(tx, { userId, contactId: subjectId, payload });
  }

  return { routes };
}
