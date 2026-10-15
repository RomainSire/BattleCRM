import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_NAME_MAX_LENGTH,
  CHANNELS,
  FOLLOW_UP_INTERVALS_MAX,
  FOLLOW_UP_MESSAGE_MAX_LENGTH,
  POSITIONING_CONTENT_MAX_LENGTH,
  POSITIONING_LABEL_MAX_LENGTH,
  SETTING_DAYS_MAX,
} from '@battlecrm/contract';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { validator } from 'hono/validator';
import { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { RequireUser } from '../auth/index.ts';
import type { Clock } from '../clock.ts';
import { withUser, type Transaction } from '../db/index.ts';
import {
  createCircuit,
  touched,
  type ChangesOf,
  type Creation,
  type Gesture,
  type GestureSubject,
} from '../gestures/index.ts';
import { jsonBody } from '../json-body.ts';
import { answerRefusal, refusal } from '../refusals.ts';
import { idOf } from '../route-id.ts';
import {
  attach,
  copyAttachments,
  eraseAttachment,
  eraseAttachmentsOf,
  hasRoomForCopyOf,
  positioningOfAttachment,
  purgeRemovedAttachments,
  readAttachment,
  removeAttachments,
  restoreAttachments,
  type JoinedFile,
} from './attachments.ts';
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
/**
 * What a deletion took away: the Positioning, the copies that named it as their original, and its
 * attachments (none in a gesture recorded before them).
 */
const positioningDeleted = z.object({
  positioning: storedPositioning,
  copyIds: z.array(z.uuid()),
  attachmentIds: z.array(z.uuid()).default([]),
});
/** The attachment a gesture joined, or removed. */
const attachmentChanged = z.object({ attachmentId: z.uuid() });

/** What a creation, or an archiving, retains: nothing, the Positioning is enough. */
const nothingRetained = z.object({});

/** The summary row of one Positioning changed, or removed. */
const touchedPositioning = (positioningId: string) => touched({ positioningIds: [positioningId] });
const removedPositioning = (positioningId: string, copyIds: string[] = []) =>
  touched({ positioningIds: copyIds, removedPositioningIds: [positioningId] });

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

type PositioningRow = typeof positioning.$inferSelect;

/**
 * The Positioning a gesture of the workshop acts on, as it reads it once locked. Each gesture purges,
 * on the way, the attachments removed longer ago than “Undo” may reach.
 */
const positioningSubject: GestureSubject<PositioningRow> = {
  column: 'positioningId',
  forgetExpired: purgeRemovedAttachments,
  async load(tx, userId, positioningId) {
    const [found] = await tx.select().from(positioning).where(byId(userId, positioningId));
    return found;
  },
};

/** The Positioning of an attachment the route names, not removed. */
const attachmentSubject: GestureSubject<PositioningRow> = {
  ...positioningSubject,
  of: positioningOfAttachment,
};

/** A new Positioning at a Stage of the Funnel, or a modified copy of one (spec UX §6.10). */
const createPositioning: Creation<
  'positioning_created',
  z.infer<typeof createRequest>,
  z.infer<typeof nothingRetained>,
  'unknown_stage' | 'unknown_positioning' | 'quota_exceeded'
> = {
  kind: 'positioning_created',
  subject: positioningSubject,
  async write({ tx, userId, input: { stageId, derivedFromId, ...fields }, now }) {
    const [found] = await tx
      .select({ id: stage.id })
      .from(stage)
      .where(and(eq(stage.userId, userId), eq(stage.id, stageId), isNull(stage.archivedAt)));
    if (!found) return refusal('unknown_stage');
    if (derivedFromId !== undefined) {
      // A copy stays at the Stage of its original, and takes its attachments.
      const [original] = await tx
        .select({ id: positioning.id })
        .from(positioning)
        .where(and(byId(userId, derivedFromId), eq(positioning.stageId, stageId)));
      if (!original) return refusal('unknown_positioning');
      if (!(await hasRoomForCopyOf(tx, userId, derivedFromId))) return refusal('quota_exceeded');
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
    if (derivedFromId !== undefined) {
      await copyAttachments(tx, { userId, fromId: derivedFromId, toId: created.id, now });
    }
    return { subjectId: created.id, retained: {}, touched: touchedPositioning(created.id) };
  },
  retained: nothingRetained,
  /** The Positioning leaves no trace, unless a copy was made of it since. */
  async inverse(tx, { userId, subjectId: positioningId }) {
    if ((await copiesOf(tx, userId, positioningId)).length > 0) return 'superseded';
    // A modified copy came with the attachments of its original.
    await eraseAttachmentsOf(tx, userId, positioningId);
    await tx.delete(positioning).where(byId(userId, positioningId));
    return removedPositioning(positioningId);
  },
};

/**
 * Everything but its Stage and its Channel (another Channel is another Positioning), as long as it is
 * not frozen (spec UX §5.6).
 */
const editPositioning: Gesture<
  'positioning_edited',
  PositioningRow,
  z.infer<typeof editRequest>,
  z.infer<typeof positioningEdited>,
  never
> = {
  kind: 'positioning_edited',
  subject: positioningSubject,
  async write({ tx, userId, subjectId: positioningId, subject: before, input }) {
    await tx.update(positioning).set(columnsOf(input)).where(byId(userId, positioningId));
    return {
      retained: {
        before: {
          label: before.label,
          content: before.content,
          followUpDays: before.followUpDays,
          followUpMessages: before.followUpMessages,
          responseWindowDays: before.responseWindowDays,
        },
      },
      touched: touchedPositioning(positioningId),
    };
  },
  retained: positioningEdited,
  async inverse(tx, { userId, subjectId: positioningId, retained: { before } }) {
    await tx.update(positioning).set(before).where(byId(userId, positioningId));
    return touchedPositioning(positioningId);
  },
};

/** Fix the label (spec UX §5.6): a typo, even once frozen; the new one applies everywhere. */
const relabelPositioning: Gesture<
  'positioning_relabeled',
  PositioningRow,
  { label: string },
  z.infer<typeof positioningRelabeled>,
  never
> = {
  kind: 'positioning_relabeled',
  subject: positioningSubject,
  async write({ tx, userId, subjectId: positioningId, subject: before, input: { label } }) {
    await tx.update(positioning).set({ label }).where(byId(userId, positioningId));
    return { retained: { label: before.label }, touched: touchedPositioning(positioningId) };
  },
  retained: positioningRelabeled,
  async inverse(tx, { userId, subjectId: positioningId, retained: { label } }) {
    await tx.update(positioning).set({ label }).where(byId(userId, positioningId));
    return touchedPositioning(positioningId);
  },
};

/**
 * Archive it by hand (spec UX §5.6). Neither the Champion nor one in an open Battle: Battles come
 * with tickets 27 and 32.
 */
const archivePositioning: Gesture<
  'positioning_archived',
  PositioningRow,
  undefined,
  z.infer<typeof nothingRetained>,
  'archived'
> = {
  kind: 'positioning_archived',
  subject: positioningSubject,
  async refuse({ subject }) {
    return subject.archivedAt === null ? undefined : refusal('archived');
  },
  async write({ tx, userId, subjectId: positioningId, now }) {
    await tx.update(positioning).set({ archivedAt: now }).where(byId(userId, positioningId));
    return { retained: {}, touched: touchedPositioning(positioningId) };
  },
  retained: nothingRetained,
  async inverse(tx, { userId, subjectId: positioningId }) {
    await tx.update(positioning).set({ archivedAt: null }).where(byId(userId, positioningId));
    return touchedPositioning(positioningId);
  },
};

/** Available again, as a Challenger to come. */
const unarchivePositioning: Gesture<
  'positioning_unarchived',
  PositioningRow,
  undefined,
  z.infer<typeof positioningUnarchived>,
  'not_archived'
> = {
  kind: 'positioning_unarchived',
  subject: positioningSubject,
  async write({ tx, userId, subjectId: positioningId, subject: { archivedAt } }) {
    // Refused here rather than in `refuse`: the date it retains is then known.
    if (archivedAt === null) return refusal('not_archived');
    await tx.update(positioning).set({ archivedAt: null }).where(byId(userId, positioningId));
    return {
      retained: { archivedAt: archivedAt.toISOString() },
      touched: touchedPositioning(positioningId),
    };
  },
  retained: positioningUnarchived,
  async inverse(tx, { userId, subjectId: positioningId, retained: { archivedAt } }) {
    await tx
      .update(positioning)
      .set({ archivedAt: new Date(archivedAt) })
      .where(byId(userId, positioningId));
    return touchedPositioning(positioningId);
  },
};

/** Delete one never used (spec UX §5.6); its copies stay, without an original. */
const deletePositioning: Gesture<
  'positioning_deleted',
  PositioningRow,
  undefined,
  z.infer<typeof positioningDeleted>,
  never
> = {
  kind: 'positioning_deleted',
  subject: positioningSubject,
  async write({ tx, userId, subjectId: positioningId, subject: before, now }) {
    const copyIds = await copiesOf(tx, userId, positioningId);
    if (copyIds.length > 0) {
      await tx
        .update(positioning)
        .set({ derivedFromId: null })
        .where(and(eq(positioning.userId, userId), inArray(positioning.id, copyIds)));
    }
    await tx.delete(positioning).where(byId(userId, positioningId));
    // Its attachments go with it, kept for “Undo” only.
    const attachmentIds = await removeAttachments(tx, { userId, positioningId, now });
    const { userId: _owner, archivedAt, ...kept } = before;
    return {
      retained: {
        positioning: { ...kept, archivedAt: archivedAt?.toISOString() ?? null },
        copyIds,
        attachmentIds,
      },
      touched: removedPositioning(positioningId, copyIds),
    };
  },
  retained: positioningDeleted,
  /**
   * The Positioning comes back as it was, and its copies name it again; unless its own original was
   * deleted since.
   */
  async inverse(tx, { userId, retained: { positioning: deleted, copyIds, attachmentIds } }) {
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
    await restoreAttachments(tx, userId, attachmentIds);
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
    return touched({ positioningIds: [deleted.id, ...relinked.map(({ id }) => id)] });
  },
};

/**
 * Join a file (ST-35): of any type, within 5 MiB, and within the room of the User. Frozen with its
 * Positioning once used in a Trial (ticket 28).
 */
const joinAttachment: Gesture<
  'positioning_attachment_added',
  PositioningRow,
  JoinedFile,
  z.infer<typeof attachmentChanged>,
  'quota_exceeded'
> = {
  kind: 'positioning_attachment_added',
  subject: positioningSubject,
  async write({ tx, userId, subjectId: positioningId, input: file, now }) {
    const attached = await attach(tx, { userId, positioningId, file, now });
    if (attached === 'quota_exceeded') return refusal(attached);
    return { retained: attached, touched: touchedPositioning(positioningId) };
  },
  retained: attachmentChanged,
  /** The file leaves no trace. */
  async inverse(tx, { userId, subjectId: positioningId, retained: { attachmentId } }) {
    await eraseAttachment(tx, userId, attachmentId);
    return touchedPositioning(positioningId);
  },
};

/** Remove one, named by its own id: kept for “Undo” only. */
const removeAttachment: Gesture<
  'positioning_attachment_removed',
  PositioningRow,
  undefined,
  z.infer<typeof attachmentChanged>,
  'not_found'
> = {
  kind: 'positioning_attachment_removed',
  subject: attachmentSubject,
  async write({ tx, userId, subjectId: positioningId, namedId: attachmentId, now }) {
    const removed = await removeAttachments(tx, { userId, attachmentIds: [attachmentId], now });
    if (removed.length === 0) return refusal('not_found');
    return { retained: { attachmentId }, touched: touchedPositioning(positioningId) };
  },
  retained: attachmentChanged,
  async inverse(tx, { userId, subjectId: positioningId, retained: { attachmentId } }) {
    if ((await restoreAttachments(tx, userId, [attachmentId])) === 0) return 'superseded';
    return touchedPositioning(positioningId);
  },
};

/** The name a file is kept under: without its path or a control character, within the bound. */
function nameOf(fileName: string) {
  const name = (fileName.split(/[/\\]/).at(-1) ?? '').replaceAll(/\p{Cc}/gu, '').trim();
  return Array.from(name).slice(0, ATTACHMENT_NAME_MAX_LENGTH).join('').trim();
}

/** A media type as `type/subtype`, without its parameters; any other is served as plain bytes. */
const MEDIA_TYPE = /^[\w!#$&^.+-]{1,63}\/[\w!#$&^.+-]{1,63}$/;
function contentTypeOf(type: string) {
  const essence = (type.split(';')[0] ?? '').trim().toLowerCase();
  return MEDIA_TYPE.test(essence) ? essence : 'application/octet-stream';
}

/** Saved under its own name (RFC 6266): in ASCII for an old client, in UTF-8 for any other. */
function contentDispositionOf(name: string) {
  const ascii = name.replaceAll(/[^\x20-\x7e]|["\\]/g, '_');
  const utf8 = encodeURIComponent(name).replaceAll(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

/**
 * The gestures of the Positioning workshop (spec UX §5.6, §6.10): create one or a modified copy, edit
 * it, fix its label, archive, unarchive and delete it, join and remove its attachments. One endpoint
 * each, through the common circuit, which answers with the rows of the summary it changed and the
 * token that takes it back (ADR 0011).
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
  const { perform, create } = createCircuit({ clock, changesOf });
  const routes = new Hono<AppEnv>()
    .post('/positionings', requireUser, jsonBody(createRequest), (c) =>
      create(c, createPositioning, c.req.valid('json')),
    )
    .post('/positionings/:id/edit', requireUser, jsonBody(editRequest), (c) =>
      perform(c, editPositioning, c.req.valid('json')),
    )
    .post(
      '/positionings/:id/relabel',
      requireUser,
      jsonBody(positioningFields.pick({ label: true })),
      (c) => perform(c, relabelPositioning, c.req.valid('json')),
    )
    .post('/positionings/:id/archive', requireUser, (c) =>
      perform(c, archivePositioning, undefined),
    )
    .post('/positionings/:id/unarchive', requireUser, (c) =>
      perform(c, unarchivePositioning, undefined),
    )
    .post('/positionings/:id/delete', requireUser, (c) => perform(c, deletePositioning, undefined))
    .post(
      '/positionings/:id/attachments',
      requireUser,
      bodyLimit({
        // The file, and the multipart frame around it.
        maxSize: ATTACHMENT_MAX_BYTES + 64 * 1024,
        onError: (c) => answerRefusal(c, refusal('too_large')),
      }),
      validator('form', (form, c) => {
        const file = form['file'];
        return file instanceof File ? { file } : answerRefusal(c, refusal('invalid'));
      }),
      async (c) => {
        // An unknown Positioning is told before the file: its bytes are never read for nothing.
        if (idOf(c.req.param('id')) === null) return answerRefusal(c, refusal('not_found'));
        const { file } = c.req.valid('form');
        if (file.size > ATTACHMENT_MAX_BYTES) return answerRefusal(c, refusal('too_large'));
        const name = nameOf(file.name);
        if (name === '') return answerRefusal(c, refusal('invalid'));
        const joined = {
          name,
          contentType: contentTypeOf(file.type),
          data: new Uint8Array(await file.arrayBuffer()),
        };
        return perform(c, joinAttachment, joined, 201);
      },
    )
    .post('/attachments/:id/remove', requireUser, (c) => perform(c, removeAttachment, undefined))
    // Download one (spec stack §6): always saved, never shown, whatever its type.
    .get('/attachments/:id', requireUser, async (c) => {
      const { userId } = c.var;
      const attachmentId = idOf(c.req.param('id'));
      const found =
        attachmentId !== null &&
        (await withUser(userId, (tx) => readAttachment(tx, userId, attachmentId)));
      // Another User's, one removed, an unknown id and one that is none answer alike.
      if (!found) return answerRefusal(c, refusal('not_found'));
      return c.body(new Uint8Array(found.data), 200, {
        'Content-Type': found.contentType,
        'Content-Disposition': contentDispositionOf(found.name),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      });
    });

  const gestures = [
    createPositioning,
    editPositioning,
    relabelPositioning,
    archivePositioning,
    unarchivePositioning,
    deletePositioning,
    joinAttachment,
    removeAttachment,
  ] as const;
  return { routes, gestures };
}
