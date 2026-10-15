import {
  CHANNELS,
  FOLLOW_UP_INTERVALS_MAX,
  FOLLOW_UP_MESSAGE_MAX_LENGTH,
  POSITIONING_CONTENT_MAX_LENGTH,
  POSITIONING_LABEL_MAX_LENGTH,
  SETTING_DAYS_MAX,
} from '@battlecrm/contract';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { RequireUser } from '../auth/index.ts';
import type { Clock } from '../clock.ts';
import { withUser, type Transaction } from '../db/index.ts';
import {
  lockPositioning,
  recordGesture,
  type ChangesOf,
  type PositioningInverse,
  type PositioningInverses,
  type Touched,
} from '../gestures/index.ts';
import { jsonBody } from '../json-body.ts';
import { positioning, stage } from './tables.ts';

/** A text the User may leave blank, trimmed: blank, it has no value. */
const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((text) => text || null)
    .optional();

const days = z.number().int().min(1).max(SETTING_DAYS_MAX);

/** What the User writes in a Positioning, whatever the gesture (spec UX §6.10). */
const positioningFields = z.object({
  label: z.string().trim().min(1).max(POSITIONING_LABEL_MAX_LENGTH),
  channel: z.enum(CHANNELS),
  content: optionalText(POSITIONING_CONTENT_MAX_LENGTH),
  /** Its Follow-up cadence: each rank, its interval and its optional message. */
  followUps: z
    .array(z.object({ days, message: optionalText(FOLLOW_UP_MESSAGE_MAX_LENGTH) }))
    .max(FOLLOW_UP_INTERVALS_MAX),
  responseWindowDays: days,
});

const createRequest = positioningFields.extend({
  stageId: z.uuid(),
  /** Absent for a new one; the original of a modified copy, at the same Stage. */
  derivedFromId: z.uuid().optional(),
});

/** What an edit changes: everything but the Stage and the Channel, which a Positioning fixes. */
const editRequest = positioningFields.omit({ channel: true });

/** The columns the fields fill, as the table keeps them; the Channel is the creation's alone. */
function columnsOf({
  label,
  content = null,
  followUps,
  responseWindowDays,
}: z.infer<typeof editRequest>) {
  return {
    label,
    content,
    followUpDays: followUps.map((followUp) => followUp.days),
    followUpMessages: followUps.map((followUp) => followUp.message ?? null),
    responseWindowDays,
  };
}

/** A whole Positioning as an inverse writes it back. */
const storedPositioning = z.object({
  id: z.uuid(),
  stageId: z.uuid(),
  label: z.string(),
  channel: z.enum(CHANNELS),
  content: z.string().nullable(),
  followUpDays: z.array(z.number()),
  followUpMessages: z.array(z.string().nullable()),
  responseWindowDays: z.number(),
  derivedFromId: z.uuid().nullable(),
  archivedAt: z.iso.datetime().nullable(),
});

/** What an edit replaced. */
const positioningEdited = z.object({
  before: storedPositioning.pick({
    label: true,
    content: true,
    followUpDays: true,
    followUpMessages: true,
    responseWindowDays: true,
  }),
});
const positioningRelabeled = z.object({ label: z.string() });
const positioningUnarchived = z.object({ archivedAt: z.iso.datetime() });
/** What a deletion took away: the Positioning, and the copies that named it as their original. */
const positioningDeleted = z.object({ positioning: storedPositioning, copyIds: z.array(z.uuid()) });

/** The summary row of one Positioning changed, or removed. */
const touchedPositioning = (positioningId: string): Touched => ({
  contactIds: [],
  removedContactIds: [],
  organizationIds: [],
  removedOrganizationIds: [],
  positioningIds: [positioningId],
});
const removedPositioning = (positioningId: string, copyIds: string[] = []): Touched => ({
  ...touchedPositioning(positioningId),
  positioningIds: copyIds,
  removedPositioningIds: [positioningId],
});

const byId = (userId: string, positioningId: string) =>
  and(eq(positioning.userId, userId), eq(positioning.id, positioningId));

/** The copies of a Positioning: they name it as their original. */
async function copiesOf(tx: Transaction, userId: string, positioningId: string) {
  const copies = await tx
    .select({ id: positioning.id })
    .from(positioning)
    .where(and(eq(positioning.userId, userId), eq(positioning.derivedFromId, positioningId)));
  return copies.map(({ id }) => id);
}

/** Takes a creation back: the Positioning leaves no trace, unless a copy was made of it since. */
const removeCreatedPositioning: PositioningInverse = async (tx, { userId, positioningId }) => {
  if ((await copiesOf(tx, userId, positioningId)).length > 0) return 'superseded';
  await tx.delete(positioning).where(byId(userId, positioningId));
  return removedPositioning(positioningId);
};

const restoreEditedPositioning: PositioningInverse = async (
  tx,
  { userId, positioningId, payload },
) => {
  const { before } = positioningEdited.parse(payload);
  await tx.update(positioning).set(before).where(byId(userId, positioningId));
  return touchedPositioning(positioningId);
};

const restoreLabel: PositioningInverse = async (tx, { userId, positioningId, payload }) => {
  const { label } = positioningRelabeled.parse(payload);
  await tx.update(positioning).set({ label }).where(byId(userId, positioningId));
  return touchedPositioning(positioningId);
};

const unarchive: PositioningInverse = async (tx, { userId, positioningId }) => {
  await tx.update(positioning).set({ archivedAt: null }).where(byId(userId, positioningId));
  return touchedPositioning(positioningId);
};

const rearchive: PositioningInverse = async (tx, { userId, positioningId, payload }) => {
  const { archivedAt } = positioningUnarchived.parse(payload);
  await tx
    .update(positioning)
    .set({ archivedAt: new Date(archivedAt) })
    .where(byId(userId, positioningId));
  return touchedPositioning(positioningId);
};

/**
 * Takes a deletion back: the Positioning comes back as it was, and its copies name it again; unless
 * its own original was deleted since.
 */
const restoreDeletedPositioning: PositioningInverse = async (tx, { userId, payload }) => {
  const { positioning: deleted, copyIds } = positioningDeleted.parse(payload);
  if (deleted.derivedFromId !== null) {
    const [original] = await tx
      .select({ id: positioning.id })
      .from(positioning)
      .where(byId(userId, deleted.derivedFromId));
    if (!original) return 'superseded';
  }
  const { archivedAt } = deleted;
  await tx.insert(positioning).values({
    ...deleted,
    userId,
    archivedAt: archivedAt === null ? null : new Date(archivedAt),
  });
  const relinked =
    copyIds.length === 0
      ? []
      : await tx
          .update(positioning)
          .set({ derivedFromId: deleted.id })
          .where(
            and(
              eq(positioning.userId, userId),
              inArray(positioning.id, copyIds),
              isNull(positioning.derivedFromId),
            ),
          )
          .returning({ id: positioning.id });
  return {
    ...touchedPositioning(deleted.id),
    positioningIds: [deleted.id, ...relinked.map(({ id }) => id)],
  };
};

/** Why a gesture is refused, and the status its route answers with. */
const REFUSAL_STATUS = {
  not_found: 404,
  unknown_stage: 400,
  unknown_positioning: 400,
  archived: 409,
  not_archived: 409,
} as const;

type Refused = { refused: keyof typeof REFUSAL_STATUS };

/** The Positioning a route names: `null` for an id that is none, which answers like an unknown one. */
const positioningIdOf = (param: string) => {
  const id = z.uuid().safeParse(param);
  return id.success ? id.data : null;
};

/**
 * A gesture on one Positioning, in its own transaction, the Positioning locked first: `act` gets it as
 * it stands, and answers, or refuses. An unknown Positioning is refused.
 */
function onPositioning<Answer>(
  userId: string,
  positioningId: string,
  act: (tx: Transaction, before: typeof positioning.$inferSelect) => Promise<Answer | Refused>,
): Promise<Answer | Refused> {
  return withUser(userId, async (tx) => {
    await lockPositioning(tx, positioningId);
    const [found] = await tx.select().from(positioning).where(byId(userId, positioningId));
    if (!found) return { refused: 'not_found' as const };
    return act(tx, found);
  });
}

/**
 * The gestures of the Positioning workshop (spec UX §5.6, §6.10): create one or a modified copy, edit
 * it, fix its label, archive, unarchive and delete it. Each in one transaction, answered with the rows
 * of the summary it changed and the token that takes it back (ADR 0011).
 *
 * Frozen once used in a Trial, and no longer deletable once used at all: both facts arrive with the
 * use of a Positioning (tickets 25, 28), which adds their refusals here, read in the transaction of
 * the gesture (ST-32). Until then, every Positioning is never used.
 */
export function createPositionings<Changes>({
  clock,
  requireUser,
  changesOf,
}: {
  clock: Clock;
  requireUser: RequireUser;
  changesOf: ChangesOf<Changes>;
}) {
  /** Records the gesture, then answers with what it changed and its token. */
  const answered = async (
    tx: Transaction,
    made: Parameters<typeof recordGesture>[1] & { positioningId: string },
    touched: Touched,
  ) => {
    const undoToken = await recordGesture(tx, made);
    return { changes: await changesOf(tx, made.userId, touched), undoToken };
  };

  const routes = new Hono<AppEnv>()
    // A new Positioning at a Stage of the Funnel, or a modified copy of one (spec UX §6.10).
    .post('/positionings', requireUser, jsonBody(createRequest), async (c) => {
      const { userId } = c.var;
      const { stageId, derivedFromId, ...fields } = c.req.valid('json');
      const now = clock.now();
      const answer = await withUser(userId, async (tx) => {
        const [found] = await tx
          .select({ id: stage.id })
          .from(stage)
          .where(and(eq(stage.userId, userId), eq(stage.id, stageId), isNull(stage.archivedAt)));
        if (!found) return { refused: 'unknown_stage' as const };
        if (derivedFromId !== undefined) {
          // A copy stays at the Stage of its original.
          const [original] = await tx
            .select({ id: positioning.id })
            .from(positioning)
            .where(and(byId(userId, derivedFromId), eq(positioning.stageId, stageId)));
          if (!original) return { refused: 'unknown_positioning' as const };
        }
        const [created] = await tx
          .insert(positioning)
          .values({
            userId,
            stageId,
            derivedFromId: derivedFromId ?? null,
            channel: fields.channel,
            ...columnsOf(fields),
          })
          .returning({ id: positioning.id });
        if (!created) throw new Error('A Positioning was not created');
        return answered(
          tx,
          { userId, kind: 'positioning_created', positioningId: created.id, payload: {}, now },
          touchedPositioning(created.id),
        );
      });
      if ('refused' in answer)
        return c.json({ error: answer.refused }, REFUSAL_STATUS[answer.refused]);
      return c.json(answer, 201);
    })
    // Everything but its Stage and its Channel (another Channel is another Positioning), as long as
    // it is not frozen (spec UX §5.6).
    .post('/positionings/:id/edit', requireUser, jsonBody(editRequest), async (c) => {
      const { userId } = c.var;
      const positioningId = positioningIdOf(c.req.param('id'));
      if (positioningId === null) return c.json({ error: 'not_found' as const }, 404);
      const columns = columnsOf(c.req.valid('json'));
      const now = clock.now();
      const answer = await onPositioning(userId, positioningId, async (tx, before) => {
        await tx.update(positioning).set(columns).where(byId(userId, positioningId));
        const payload = {
          before: {
            label: before.label,
            content: before.content,
            followUpDays: before.followUpDays,
            followUpMessages: before.followUpMessages,
            responseWindowDays: before.responseWindowDays,
          },
        } satisfies z.infer<typeof positioningEdited>;
        return answered(
          tx,
          { userId, kind: 'positioning_edited', positioningId, payload, now },
          touchedPositioning(positioningId),
        );
      });
      if ('refused' in answer)
        return c.json({ error: answer.refused }, REFUSAL_STATUS[answer.refused]);
      return c.json(answer, 200);
    })
    // Fix the label (spec UX §5.6): a typo, even once frozen; the new one applies everywhere.
    .post(
      '/positionings/:id/relabel',
      requireUser,
      jsonBody(positioningFields.pick({ label: true })),
      async (c) => {
        const { userId } = c.var;
        const positioningId = positioningIdOf(c.req.param('id'));
        if (positioningId === null) return c.json({ error: 'not_found' as const }, 404);
        const { label } = c.req.valid('json');
        const now = clock.now();
        const answer = await onPositioning(userId, positioningId, async (tx, before) => {
          await tx.update(positioning).set({ label }).where(byId(userId, positioningId));
          return answered(
            tx,
            {
              userId,
              kind: 'positioning_relabeled',
              positioningId,
              payload: { label: before.label } satisfies z.infer<typeof positioningRelabeled>,
              now,
            },
            touchedPositioning(positioningId),
          );
        });
        if ('refused' in answer)
          return c.json({ error: answer.refused }, REFUSAL_STATUS[answer.refused]);
        return c.json(answer, 200);
      },
    )
    // Archive it by hand (spec UX §5.6). Neither the Champion nor one in an open Battle: Battles
    // come with tickets 27 and 32.
    .post('/positionings/:id/archive', requireUser, async (c) => {
      const { userId } = c.var;
      const positioningId = positioningIdOf(c.req.param('id'));
      if (positioningId === null) return c.json({ error: 'not_found' as const }, 404);
      const now = clock.now();
      const answer = await onPositioning(userId, positioningId, async (tx, before) => {
        if (before.archivedAt !== null) return { refused: 'archived' as const };
        await tx.update(positioning).set({ archivedAt: now }).where(byId(userId, positioningId));
        return answered(
          tx,
          { userId, kind: 'positioning_archived', positioningId, payload: {}, now },
          touchedPositioning(positioningId),
        );
      });
      if ('refused' in answer) {
        return c.json({ error: answer.refused }, REFUSAL_STATUS[answer.refused]);
      }
      return c.json(answer, 200);
    })
    // Available again, as a Challenger to come.
    .post('/positionings/:id/unarchive', requireUser, async (c) => {
      const { userId } = c.var;
      const positioningId = positioningIdOf(c.req.param('id'));
      if (positioningId === null) return c.json({ error: 'not_found' as const }, 404);
      const now = clock.now();
      const answer = await onPositioning(userId, positioningId, async (tx, before) => {
        if (before.archivedAt === null) return { refused: 'not_archived' as const };
        await tx.update(positioning).set({ archivedAt: null }).where(byId(userId, positioningId));
        const payload = {
          archivedAt: before.archivedAt.toISOString(),
        } satisfies z.infer<typeof positioningUnarchived>;
        return answered(
          tx,
          { userId, kind: 'positioning_unarchived', positioningId, payload, now },
          touchedPositioning(positioningId),
        );
      });
      if ('refused' in answer) {
        return c.json({ error: answer.refused }, REFUSAL_STATUS[answer.refused]);
      }
      return c.json(answer, 200);
    })
    // Delete one never used (spec UX §5.6); its copies stay, without an original.
    .post('/positionings/:id/delete', requireUser, async (c) => {
      const { userId } = c.var;
      const positioningId = positioningIdOf(c.req.param('id'));
      if (positioningId === null) return c.json({ error: 'not_found' as const }, 404);
      const now = clock.now();
      const answer = await onPositioning(userId, positioningId, async (tx, before) => {
        const copyIds = await copiesOf(tx, userId, positioningId);
        if (copyIds.length > 0) {
          await tx
            .update(positioning)
            .set({ derivedFromId: null })
            .where(and(eq(positioning.userId, userId), inArray(positioning.id, copyIds)));
        }
        await tx.delete(positioning).where(byId(userId, positioningId));
        const { userId: _owner, archivedAt, ...kept } = before;
        const payload = {
          positioning: { ...kept, archivedAt: archivedAt?.toISOString() ?? null },
          copyIds,
        } satisfies z.infer<typeof positioningDeleted>;
        return answered(
          tx,
          { userId, kind: 'positioning_deleted', positioningId, payload, now },
          removedPositioning(positioningId, copyIds),
        );
      });
      if ('refused' in answer)
        return c.json({ error: answer.refused }, REFUSAL_STATUS[answer.refused]);
      return c.json(answer, 200);
    });

  const inverses = {
    positioning_created: removeCreatedPositioning,
    positioning_edited: restoreEditedPositioning,
    positioning_relabeled: restoreLabel,
    positioning_archived: unarchive,
    positioning_unarchived: rearchive,
    positioning_deleted: restoreDeletedPositioning,
  } satisfies PositioningInverses;
  return { routes, inverses };
}
