import { STAGE_AIM_MAX_LENGTH, STAGE_NAME_MAX_LENGTH } from '@battlecrm/contract';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { RequireUser } from '../auth/index.ts';
import type { Clock } from '../clock.ts';
import type { Transaction } from '../db/index.ts';
import {
  createCircuit,
  touched,
  type ChangesOf,
  type Creation,
  type Gesture,
  type GestureSubject,
} from '../gestures/index.ts';
import { jsonBody } from '../json-body.ts';
import { refusal } from '../refusals.ts';
import { positioning, stage } from './tables.ts';

/** The order of the Funnel, for every read of its Stages. */
export const FUNNEL_ORDER = [asc(stage.position), asc(stage.id)];

const name = z.string().trim().min(1).max(STAGE_NAME_MAX_LENGTH);
/** Optional: blank, it has none. */
const aim = z
  .string()
  .trim()
  .max(STAGE_AIM_MAX_LENGTH)
  .transform((text) => text || null);

/** Where a Stage goes: right after this one, first with `null`. */
const afterId = z.uuid().nullable();

const createRequest = z.object({ name, aim: aim.optional(), afterId: afterId.optional() });
/** One field at a time, as Settings save them (spec UX §5.8). */
const editRequest = z
  .object({ name: name.optional(), aim: aim.optional() })
  .refine(({ name: named, aim: aimed }) => named !== undefined || aimed !== undefined);
const moveRequest = z.object({ afterId });

const nothingRetained = z.object({});
const stageEdited = z.object({
  before: z.object({ name: z.string(), aim: z.string().nullable() }),
});
/** The Stage it followed, `null` when it was first: where “Undo” puts it back. */
const stageMoved = z.object({ afterId: z.uuid().nullable() });
const stageRestored = z.object({ archivedAt: z.iso.datetime() });
/** The Stage deleted, and the one it followed in the Funnel. */
const stageDeleted = z.object({
  stage: z.object({
    id: z.uuid(),
    name: z.string(),
    aim: z.string().nullable(),
    archivedAt: z.iso.datetime().nullable(),
    precededById: z.uuid().nullable(),
  }),
  afterId: z.uuid().nullable(),
});

/** What a gesture on the Funnel changes in the summary: its Stages, which the answer carries whole. */
const funnelChanged = () => touched({ stages: true });

const byId = (userId: string, stageId: string) =>
  and(eq(stage.userId, userId), eq(stage.id, stageId));

/**
 * The Contacts at a Stage (ST-32): `prospecting` keeps them, and answers in the transaction of the
 * gesture.
 */
export type StageContacts = {
  /** Whether a Contact ever was at the Stage, whatever its Status now. */
  passed: (tx: Transaction, userId: string, stageId: string) => Promise<boolean>;
  /** Whether a Contact Prospecting is at it now. */
  prospecting: (tx: Transaction, userId: string, stageId: string) => Promise<boolean>;
};

/** The Battles of a Stage (ST-32): `battles` keeps them, and answers. */
export type StageBattles = {
  any: (tx: Transaction, userId: string, stageId: string) => Promise<boolean>;
  open: (tx: Transaction, userId: string, stageId: string) => Promise<boolean>;
};

/** Who tells what keeps a Stage: its Contacts and its Battles. */
type StageKeepers = { contacts: StageContacts; battles: StageBattles };

/**
 * Locks every Stage of the User before a gesture reads or rewrites the Funnel, in the order of their
 * ids, which no gesture changes. A Contact entering a Stage shares them in the same order
 * (`stageOrder`): one waits for the other, never both, and sees what it wrote. Two gestures on the
 * Funnel, too.
 */
const lockFunnel = (tx: Transaction, userId: string) =>
  tx
    .select({ id: stage.id })
    .from(stage)
    .where(eq(stage.userId, userId))
    .orderBy(asc(stage.id))
    .for('update');

/** The Stages of the Funnel, archived ones left out, in their order. */
async function funnelIds(tx: Transaction, userId: string) {
  const rows = await tx
    .select({ id: stage.id })
    .from(stage)
    .where(and(eq(stage.userId, userId), isNull(stage.archivedAt)))
    .orderBy(...FUNNEL_ORDER);
  return rows.map(({ id }) => id);
}

/** Writes the order of the Funnel; an archived Stage keeps the position it had. */
async function writeOrder(tx: Transaction, userId: string, ids: readonly string[]) {
  for (const [position, id] of ids.entries()) {
    await tx.update(stage).set({ position }).where(byId(userId, id));
  }
}

/**
 * Puts a Stage of the Funnel right after another one, first after `null`; at the end when that one
 * is no longer in it.
 */
async function placeAfter(
  tx: Transaction,
  userId: string,
  stageId: string,
  afterStageId: string | null,
) {
  const others = (await funnelIds(tx, userId)).filter((id) => id !== stageId);
  const index = afterStageId === null ? 0 : others.indexOf(afterStageId) + 1 || others.length;
  await writeOrder(tx, userId, others.toSpliced(index, 0, stageId));
}

/** The Stage right before this one in the Funnel, `null` when it is first. */
async function predecessorOf(tx: Transaction, userId: string, stageId: string) {
  const ids = await funnelIds(tx, userId);
  return ids[ids.indexOf(stageId) - 1] ?? null;
}

/** Whether it is the one Stage left in the Funnel, which always keeps one (CONTEXT.md, Funnel). */
async function isLast(tx: Transaction, userId: string, stageId: string) {
  const ids = await funnelIds(tx, userId);
  return ids.length === 1 && ids[0] === stageId;
}

/** Whether a Stage served (CONTEXT.md, Stage): a Contact passed there, it bears a Positioning or a Battle. */
async function hasServed(
  tx: Transaction,
  { contacts, battles }: StageKeepers,
  userId: string,
  stageId: string,
) {
  const [borne] = await tx
    .select({ id: positioning.id })
    .from(positioning)
    .where(and(eq(positioning.userId, userId), eq(positioning.stageId, stageId)))
    .limit(1);
  return (
    borne !== undefined ||
    (await contacts.passed(tx, userId, stageId)) ||
    (await battles.any(tx, userId, stageId))
  );
}

/**
 * Why a Stage may not leave the Funnel (CONTEXT.md, Stage): a Contact Prospecting at it, an open
 * Battle, or it is the last one.
 */
async function whyNotArchivable(
  tx: Transaction,
  { contacts, battles }: StageKeepers,
  userId: string,
  stageId: string,
) {
  if (await contacts.prospecting(tx, userId, stageId)) return 'has_contacts' as const;
  if (await battles.open(tx, userId, stageId)) return 'battle_open' as const;
  if (await isLast(tx, userId, stageId)) return 'last_stage' as const;
  return undefined;
}

type StageRow = typeof stage.$inferSelect;

/** The Stage a gesture of Settings acts on, read once the Funnel is locked. */
const stageSubject: GestureSubject<StageRow> = {
  column: 'stageId',
  async load(tx, userId, stageId) {
    await lockFunnel(tx, userId);
    const [found] = await tx.select().from(stage).where(byId(userId, stageId));
    return found;
  },
};

/** “+ Add a Stage” (spec UX §5.8): at the end, or right where the User inserts it. */
const createStage = (
  keepers: StageKeepers,
): Creation<
  'stage_created',
  z.infer<typeof createRequest>,
  z.infer<typeof nothingRetained>,
  'unknown_stage'
> => ({
  kind: 'stage_created',
  subject: stageSubject,
  async write({ tx, userId, input }) {
    await lockFunnel(tx, userId);
    const ids = await funnelIds(tx, userId);
    if (input.afterId != null && !ids.includes(input.afterId)) return refusal('unknown_stage');
    const [created] = await tx
      .insert(stage)
      .values({ userId, name: input.name, aim: input.aim ?? null, position: ids.length })
      .returning({ id: stage.id });
    if (!created) throw new Error('A Stage was not created');
    if (input.afterId !== undefined) await placeAfter(tx, userId, created.id, input.afterId);
    return { subjectId: created.id, retained: {}, touched: funnelChanged() };
  },
  retained: nothingRetained,
  /** It leaves no trace, unless it served since, or is the last one in the Funnel. */
  async inverse(tx, { userId, subjectId: stageId }) {
    await lockFunnel(tx, userId);
    if (await hasServed(tx, keepers, userId, stageId)) return 'superseded';
    if (await isLast(tx, userId, stageId)) return 'superseded';
    await tx.delete(stage).where(byId(userId, stageId));
    await writeOrder(tx, userId, await funnelIds(tx, userId));
    return funnelChanged();
  },
});

/** Its name or its Aim, edited in place (spec UX §5.8): renamed, it is renamed everywhere, history included. */
const editStage: Gesture<
  'stage_edited',
  StageRow,
  z.infer<typeof editRequest>,
  z.infer<typeof stageEdited>,
  never
> = {
  kind: 'stage_edited',
  subject: stageSubject,
  async write({ tx, userId, subjectId: stageId, subject: before, input }) {
    await tx.update(stage).set(input).where(byId(userId, stageId));
    return {
      retained: { before: { name: before.name, aim: before.aim } },
      touched: funnelChanged(),
    };
  },
  retained: stageEdited,
  async inverse(tx, { userId, subjectId: stageId, retained: { before } }) {
    await lockFunnel(tx, userId);
    await tx.update(stage).set(before).where(byId(userId, stageId));
    return funnelChanged();
  },
};

/**
 * Reorder (spec UX §5.8): right after another Stage, or first. No Contact moves, and the history keeps
 * the order of then (ADR 0003).
 */
const moveStage: Gesture<
  'stage_moved',
  StageRow,
  z.infer<typeof moveRequest>,
  z.infer<typeof stageMoved>,
  'archived' | 'unknown_stage'
> = {
  kind: 'stage_moved',
  subject: stageSubject,
  async write({ tx, userId, subjectId: stageId, subject, input }) {
    if (subject.archivedAt !== null) return refusal('archived');
    const ids = await funnelIds(tx, userId);
    if (input.afterId !== null && (input.afterId === stageId || !ids.includes(input.afterId))) {
      return refusal('unknown_stage');
    }
    const before = await predecessorOf(tx, userId, stageId);
    await placeAfter(tx, userId, stageId, input.afterId);
    return { retained: { afterId: before }, touched: funnelChanged() };
  },
  retained: stageMoved,
  /** Back after the Stage it followed, unless that one left the Funnel since. */
  async inverse(tx, { userId, subjectId: stageId, retained: { afterId: before } }) {
    await lockFunnel(tx, userId);
    if (before !== null && !(await funnelIds(tx, userId)).includes(before)) return 'superseded';
    await placeAfter(tx, userId, stageId, before);
    return funnelChanged();
  },
};

/**
 * Archive one (spec UX §5.8): it leaves the Funnel, its Positionings, Battles and History of Champions
 * stay; it remembers the Stage it followed, to come back after it.
 */
const archiveStage = (
  keepers: StageKeepers,
): Gesture<
  'stage_archived',
  StageRow,
  undefined,
  z.infer<typeof nothingRetained>,
  'archived' | 'has_contacts' | 'battle_open' | 'last_stage'
> => ({
  kind: 'stage_archived',
  subject: stageSubject,
  async refuse({ tx, userId, subjectId: stageId, subject }) {
    if (subject.archivedAt !== null) return refusal('archived');
    const why = await whyNotArchivable(tx, keepers, userId, stageId);
    return why && refusal(why);
  },
  async write({ tx, userId, subjectId: stageId, now }) {
    const precededById = await predecessorOf(tx, userId, stageId);
    await tx.update(stage).set({ archivedAt: now, precededById }).where(byId(userId, stageId));
    return { retained: {}, touched: funnelChanged() };
  },
  retained: nothingRetained,
  /** Back in the Funnel, after the Stage it followed. */
  async inverse(tx, { userId, subjectId: stageId }) {
    await lockFunnel(tx, userId);
    await restore(tx, userId, stageId);
    return funnelChanged();
  },
});

/** Back in the Funnel, right after the Stage it followed if it is still there, otherwise at the end. */
async function restore(tx: Transaction, userId: string, stageId: string) {
  const [archived] = await tx
    .update(stage)
    .set({ archivedAt: null })
    .where(byId(userId, stageId))
    .returning({ precededById: stage.precededById });
  await placeAfter(tx, userId, stageId, archived?.precededById ?? null);
}

/** “Restore” (spec UX §5.8), under “Archived Stages”. */
const restoreStage = (
  keepers: StageKeepers,
): Gesture<
  'stage_restored',
  StageRow,
  undefined,
  z.infer<typeof stageRestored>,
  'not_archived'
> => ({
  kind: 'stage_restored',
  subject: stageSubject,
  async write({ tx, userId, subjectId: stageId, subject: { archivedAt } }) {
    // Refused here rather than in `refuse`: the date it retains is then known.
    if (archivedAt === null) return refusal('not_archived');
    await restore(tx, userId, stageId);
    return { retained: { archivedAt: archivedAt.toISOString() }, touched: funnelChanged() };
  },
  retained: stageRestored,
  /** Archived again, unless something keeps it in the Funnel since. */
  async inverse(tx, { userId, subjectId: stageId, retained: { archivedAt } }) {
    await lockFunnel(tx, userId);
    if ((await whyNotArchivable(tx, keepers, userId, stageId)) !== undefined) return 'superseded';
    const precededById = await predecessorOf(tx, userId, stageId);
    await tx
      .update(stage)
      .set({ archivedAt: new Date(archivedAt), precededById })
      .where(byId(userId, stageId));
    return funnelChanged();
  },
});

/** Delete one that never served (spec UX §5.8), without a confirmation; one that served is archived. */
const deleteStage = (
  keepers: StageKeepers,
): Gesture<
  'stage_deleted',
  StageRow,
  undefined,
  z.infer<typeof stageDeleted>,
  'served' | 'last_stage'
> => ({
  kind: 'stage_deleted',
  subject: stageSubject,
  async refuse({ tx, userId, subjectId: stageId, subject }) {
    if (await hasServed(tx, keepers, userId, stageId)) return refusal('served');
    if (subject.archivedAt === null && (await isLast(tx, userId, stageId))) {
      return refusal('last_stage');
    }
    return undefined;
  },
  async write({ tx, userId, subjectId: stageId, subject }) {
    const followed = subject.archivedAt === null ? await predecessorOf(tx, userId, stageId) : null;
    await tx.delete(stage).where(byId(userId, stageId));
    await writeOrder(tx, userId, await funnelIds(tx, userId));
    const { id, name: deletedName, aim: deletedAim, archivedAt, precededById } = subject;
    return {
      retained: {
        stage: {
          id,
          name: deletedName,
          aim: deletedAim,
          archivedAt: archivedAt?.toISOString() ?? null,
          precededById,
        },
        afterId: followed,
      },
      touched: funnelChanged(),
    };
  },
  retained: stageDeleted,
  /** It comes back as it was, at its place: after the Stage it followed, or at the end. */
  async inverse(tx, { userId, retained: { stage: deleted, afterId: after } }) {
    await lockFunnel(tx, userId);
    const ids = await funnelIds(tx, userId);
    const { archivedAt } = deleted;
    await tx.insert(stage).values({
      ...deleted,
      userId,
      position: ids.length,
      archivedAt: archivedAt === null ? null : new Date(archivedAt),
    });
    if (archivedAt === null) await placeAfter(tx, userId, deleted.id, after);
    return funnelChanged();
  },
});

/**
 * The gestures of Settings on the Funnel (spec UX §5.8), its only editor: add, edit, reorder,
 * archive, restore and delete a Stage. One endpoint each, through the common circuit, which answers
 * with the whole Funnel and the token that takes it back (ADR 0011).
 *
 * Whether a Stage served, and whether a Contact Prospecting or an open Battle keeps it in the Funnel,
 * is read in the transaction of the gesture, the Funnel locked (ST-32).
 */
export function createStages<Changes>({
  clock,
  requireUser,
  changesOf,
  contacts,
  battles,
}: {
  clock: Clock;
  requireUser: RequireUser;
  changesOf: ChangesOf<Changes>;
  contacts: StageContacts;
  battles: StageBattles;
}) {
  const keepers = { contacts, battles };
  const { perform, create } = createCircuit({ clock, changesOf });
  const created = createStage(keepers);
  const archived = archiveStage(keepers);
  const restored = restoreStage(keepers);
  const deleted = deleteStage(keepers);
  const routes = new Hono<AppEnv>()
    .post('/stages', requireUser, jsonBody(createRequest), (c) =>
      create(c, created, c.req.valid('json')),
    )
    .post('/stages/:id/edit', requireUser, jsonBody(editRequest), (c) =>
      perform(c, editStage, c.req.valid('json')),
    )
    .post('/stages/:id/move', requireUser, jsonBody(moveRequest), (c) =>
      perform(c, moveStage, c.req.valid('json')),
    )
    .post('/stages/:id/archive', requireUser, (c) => perform(c, archived, undefined))
    .post('/stages/:id/restore', requireUser, (c) => perform(c, restored, undefined))
    .post('/stages/:id/delete', requireUser, (c) => perform(c, deleted, undefined));
  const gestures = [created, editStage, moveStage, archived, restored, deleted] as const;
  return { routes, gestures };
}
