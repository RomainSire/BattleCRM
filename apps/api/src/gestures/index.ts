import { and, eq, gt, lt, or, sql } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import type { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { RequireUser, SignedInEnv } from '../auth/index.ts';
import type { Clock } from '../clock.ts';
import { withUser, type Transaction } from '../db/index.ts';
import { answerRefusal, refusal, type Refusal, type RefusalCode } from '../refusals.ts';
import { idOf } from '../route-id.ts';
import { gesture } from './tables.ts';

type Recorded = typeof gesture.$inferSelect;

/** Every kind of gesture, as each module declares its own next to its subject's table. */
export type GestureKind = Recorded['kind'];

type Columns = (typeof gesture)['_']['columns'];

/**
 * The columns of `gesture` that name what a gesture touched, its ids that may be null: one per subject.
 * A later gesture on the same one closes the way back.
 */
type SubjectColumn = {
  [Column in keyof Columns]: Columns[Column]['_'] extends { columnType: 'PgUUID'; notNull: false }
    ? Column
    : never;
}[keyof Columns];

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
  battleIds: string[];
  removedBattleIds: string[];
  /** Whether it changed the Funnel: its Stages, their order. */
  stages: boolean;
  /** Whether it deleted a Contact, whose days still count (ADR 0006). */
  deletedContacts: boolean;
};

/** The rows a gesture touched, every kind it names nothing of left empty. */
export const touched = (rows: Partial<Touched>): Touched => ({
  contactIds: [],
  removedContactIds: [],
  organizationIds: [],
  removedOrganizationIds: [],
  positioningIds: [],
  removedPositioningIds: [],
  battleIds: [],
  removedBattleIds: [],
  stages: false,
  deletedContacts: false,
  ...rows,
});

/** The rows of the summary as a gesture, or its inverse, left them: read by `views`, in the same transaction. */
export type ChangesOf<Changes> = (
  tx: Transaction,
  userId: string,
  touched: Touched,
) => Promise<Changes>;

/**
 * One at a time per subject, until the transaction ends: an undo and a gesture on the same one never
 * cross, so the undo always sees the gesture that closes its way back.
 */
export const lockSubject = (tx: Transaction, subjectId: string) =>
  tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${subjectId}, 0))`);

/**
 * Forgets every gesture on a Contact, which can then no longer be undone: what they kept of it goes
 * with them (ADR 0006).
 */
export const forgetGesturesOn = (tx: Transaction, userId: string, contactId: string) =>
  tx.delete(gesture).where(and(eq(gesture.userId, userId), eq(gesture.contactId, contactId)));

/**
 * Remembers a gesture in its own transaction, and returns the token that undoes it.
 * Gestures too old to be undone are forgotten on the way: no job could, under row level security.
 */
async function record(
  tx: Transaction,
  made: {
    userId: string;
    kind: GestureKind;
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

/** What the circuit knows of a subject, whether a gesture finds it or creates it. */
type SubjectRecord = {
  column: SubjectColumn;
  /**
   * What a gesture on it forgets on the way, once “Undo” can no longer reach it, as the circuit
   * forgets the gestures too old: no job could, under row level security.
   */
  forgetExpired?: (tx: Transaction, userId: string, now: Date) => Promise<void>;
};

/**
 * What gestures act on, one at a time (ADR 0011): a Contact, a Positioning, a Battle, a Stage. A new one comes
 * with its column in `gesture` and its own loader, never a branch of the circuit.
 */
export type GestureSubject<Row> = SubjectRecord & {
  /**
   * When a route names it through one of its rows (an attachment of a Positioning): the subject that
   * row belongs to, `undefined` when the User has no such row.
   */
  of?: (tx: Transaction, userId: string, namedId: string) => Promise<string | undefined>;
  /** Reads it, already locked; `undefined` when the User has none by this id. */
  load: (tx: Transaction, userId: string, id: string) => Promise<Row | undefined>;
};

/** What the writes of a gesture are given: what the User sent, and when. */
export type Made<Input> = { tx: Transaction; userId: string; input: Input; now: Date };

/**
 * What each step of a gesture is given: the subject as it stood once locked, and what the User sent.
 * `namedId` is the id the route named: the subject's own, or the one of the row it was reached through.
 */
export type Performed<Row, Input> = Made<Input> & {
  subjectId: string;
  namedId: string;
  subject: Row;
};

/** What the writes of a gesture leave: what its inverse needs, and the summary rows they changed. */
export type Written<Retained> = { retained: Retained; touched: Touched };

/** What every undoable gesture declares (ADR 0011): its kind, its subject, what it retains, its inverse. */
type Undoable<Kind extends GestureKind, Retained> = {
  kind: Kind;
  subject: SubjectRecord;
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
  Kind extends GestureKind,
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
  Kind extends GestureKind,
  Input,
  Retained,
  Code extends RefusalCode,
> = Undoable<Kind, Retained> & {
  write: (
    made: Made<Input>,
  ) => Promise<(Written<Retained> & { subjectId: string }) | Refusal<Code>>;
};

// oxlint-disable-next-line typescript/no-explicit-any -- any gesture, whatever its subject and retained.
type AnyGesture = Undoable<GestureKind, any>;

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
  async function run<Kind extends GestureKind, Retained, Code extends RefusalCode>(
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
      await declared.subject.forgetExpired?.(tx, userId, now);
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

  /** Answers 200, or 201 for a gesture that creates a row within its subject (an attachment…). */
  async function perform<
    Kind extends GestureKind,
    Row,
    Input,
    Retained,
    Code extends RefusalCode,
    Status extends 200 | 201 = 200,
  >(
    c: SubjectRoute,
    declared: Gesture<Kind, Row, Input, Retained, Code>,
    input: Input,
    status?: Status,
  ) {
    const { userId } = c.var;
    const namedId = idOf(c.req.param('id'));
    // Another User's subject, an unknown one and an id that is none answer alike.
    if (namedId === null) return answerRefusal(c, refusal('not_found'));
    const outcome = await run<Kind, Retained, Code | 'not_found'>(
      userId,
      declared,
      async (tx, now) => {
        const subjectId = declared.subject.of
          ? await declared.subject.of(tx, userId, namedId)
          : namedId;
        if (subjectId === undefined) return refusal('not_found');
        await lockSubject(tx, subjectId);
        const subject = await declared.subject.load(tx, userId, subjectId);
        if (subject === undefined) return refusal('not_found');
        const performed = { tx, userId, subjectId, namedId, subject, input, now };
        const refused = await declared.refuse?.(performed);
        if (refused) return refused;
        const written = await declared.write(performed);
        return 'error' in written ? written : { ...written, subjectId };
      },
    );
    if ('error' in outcome) return answerRefusal<Code | 'not_found'>(c, outcome);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the default is the status left out.
    return c.json(outcome, status ?? (200 as Status));
  }

  async function create<Kind extends GestureKind, Input, Retained, Code extends RefusalCode>(
    c: SubjectRoute,
    declared: Creation<Kind, Input, Retained, Code>,
    input: Input,
  ) {
    const outcome = await run(c.var.userId, declared, (tx, now) =>
      declared.write({ tx, userId: c.var.userId, input, now }),
    );
    if ('error' in outcome) return answerRefusal<Code>(c, outcome);
    return c.json(outcome, 201);
  }

  return { perform, create };
}

/** Nothing more when every kind is declared; the kinds left out otherwise, for the compiler to name. */
type Covering<Declared extends GestureKind> =
  Exclude<GestureKind, Declared> extends never
    ? unknown
    : { missing: Exclude<GestureKind, Declared> };

/** “Undo” (ADR 0011, spec stack §5.4). */
export function createGestures<Changes, Declared extends AnyGesture>({
  clock,
  requireUser,
  gestures,
  changesOf,
}: {
  clock: Clock;
  requireUser: RequireUser;
  /** Every undoable gesture, as each module declares its own: a kind without one does not compile. */
  gestures: readonly Declared[] & Covering<Declared['kind']>;
  changesOf: ChangesOf<Changes>;
}) {
  const byKind = new Map<string, AnyGesture>(gestures.map((declared) => [declared.kind, declared]));
  const routes = new Hono<AppEnv>().post('/gestures/:id/undo', requireUser, async (c) => {
    const { userId } = c.var;
    const gestureId = idOf(c.req.param('id'));
    // Another User's gesture, one already undone and an unknown id answer alike.
    if (gestureId === null) return answerRefusal(c, refusal('not_found'));
    const outcome = await withUser(userId, async (tx) => {
      const [made] = await tx
        .select()
        .from(gesture)
        .where(and(eq(gesture.userId, userId), eq(gesture.id, gestureId)))
        .for('update');
      if (!made) return refusal('not_found');
      if (clock.now().getTime() - made.performedAt.getTime() > UNDO_WINDOW_MS) {
        return refusal('expired');
      }
      const { kind, payload } = made;
      const declared = byKind.get(kind);
      if (!declared) throw new Error(`No inverse for the gesture ${kind}`);
      const { column } = declared.subject;
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
      const restored = await declared.inverse(tx, {
        userId,
        subjectId,
        retained: declared.retained.parse(payload),
      });
      if (restored === 'superseded') return refusal(restored);
      await tx.delete(gesture).where(and(eq(gesture.userId, userId), eq(gesture.id, made.id)));
      return { changes: await changesOf(tx, userId, restored) };
    });
    if ('error' in outcome) return answerRefusal(c, outcome);
    return c.json(outcome, 200);
  });

  return { routes };
}
