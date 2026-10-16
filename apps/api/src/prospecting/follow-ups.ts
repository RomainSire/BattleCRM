import { cadenceFollowUpOn, hasFollowUps, shiftedFollowUpOn } from '@battlecrm/domain';
import { and, desc, eq, max } from 'drizzle-orm';
import { z } from 'zod';

import type { Transaction } from '../db/index.ts';
import { cadenceOf } from '../funnel/index.ts';
import { touched, type Gesture } from '../gestures/index.ts';
import { refusal } from '../refusals.ts';
import { localDateOf } from '../settings/index.ts';
import { contactSubject, type ContactPlace } from './contact-subject.ts';
import { dayEntered, recordInteraction, removeInteraction } from './interactions.ts';
import { followUp, interaction } from './tables.ts';

/** The scheduled Follow-up of a Contact, if it has one. */
export async function scheduledFollowUp(tx: Transaction, userId: string, contactId: string) {
  const [scheduled] = await tx
    .select({ id: followUp.id, dueOn: followUp.dueOn, note: followUp.note, rank: followUp.rank })
    .from(followUp)
    .where(
      and(
        eq(followUp.userId, userId),
        eq(followUp.contactId, contactId),
        eq(followUp.status, 'scheduled'),
      ),
    );
  return scheduled;
}

/**
 * The intervals of the Cadence a Contact is on: those of the last Positioning used on it (CONTEXT.md,
 * Follow-up cadence); none when none was.
 */
async function cadenceDays(tx: Transaction, userId: string, contactId: string) {
  const [lastUse] = await tx
    .select({ positioningId: interaction.positioningId })
    .from(interaction)
    .where(
      and(
        eq(interaction.userId, userId),
        eq(interaction.contactId, contactId),
        eq(interaction.kind, 'positioning_used'),
      ),
    )
    .orderBy(desc(interaction.occurredAt), desc(interaction.id))
    .limit(1);
  return lastUse?.positioningId ? cadenceOf(tx, userId, lastUse.positioningId) : undefined;
}

/** The local day of the last outbound Interaction done with a Contact: what each interval counts from. */
async function lastOutboundOn(tx: Transaction, userId: string, contactId: string) {
  const [last] = await tx
    .select({ on: max(interaction.localDate) })
    .from(interaction)
    .where(
      and(
        eq(interaction.userId, userId),
        eq(interaction.contactId, contactId),
        eq(interaction.direction, 'outbound'),
      ),
    );
  return last?.on ?? undefined;
}

/** What pushing a Follow-up of the Cadence back retains: the Follow-up, and its day before. */
export const followUpPushed = z.object({ followUpId: z.uuid(), dueOn: z.iso.date() });

/**
 * Once an outbound Interaction is recorded (spec UX §6.4): the scheduled Follow-up of the Cadence
 * pushed back, its interval counted from the last one done. What it was, if it moved.
 */
export async function pushFollowUpBack(
  tx: Transaction,
  userId: string,
  contactId: string,
): Promise<z.infer<typeof followUpPushed> | undefined> {
  const scheduled = await scheduledFollowUp(tx, userId, contactId);
  if (scheduled?.rank == null) return undefined;
  const days = await cadenceDays(tx, userId, contactId);
  const lastOn = await lastOutboundOn(tx, userId, contactId);
  if (days === undefined || lastOn === undefined) return undefined;
  const dueOn = shiftedFollowUpOn(scheduled, lastOn, days);
  if (dueOn === scheduled.dueOn) return undefined;
  await tx
    .update(followUp)
    .set({ dueOn })
    .where(and(eq(followUp.userId, userId), eq(followUp.id, scheduled.id)));
  return { followUpId: scheduled.id, dueOn: scheduled.dueOn };
}

/** Gives a Follow-up of the Cadence pushed back its day as it was. */
export const restoreFollowUpDay = (
  tx: Transaction,
  userId: string,
  { followUpId, dueOn }: z.infer<typeof followUpPushed>,
) =>
  tx
    .update(followUp)
    .set({ dueOn })
    .where(and(eq(followUp.userId, userId), eq(followUp.id, followUpId)));

/** Cancels a Follow-up, or schedules it again, as it was. */
export const setFollowUpStatus = (
  tx: Transaction,
  userId: string,
  followUpId: string,
  status: 'scheduled' | 'canceled',
) =>
  tx
    .update(followUp)
    .set({ status })
    .where(and(eq(followUp.userId, userId), eq(followUp.id, followUpId)));

/** Takes a Follow-up off the Cadence, or gives it its rank back. */
export const setFollowUpRank = (
  tx: Transaction,
  userId: string,
  followUpId: string,
  rank: number | null,
) =>
  tx
    .update(followUp)
    .set({ rank })
    .where(and(eq(followUp.userId, userId), eq(followUp.id, followUpId)));

/** What “Schedule a follow-up” retains: the Follow-up, and what it was before, if it was. */
const followUpScheduled = z.object({
  followUpId: z.uuid(),
  before: z.object({ dueOn: z.iso.date(), note: z.string().nullable() }).nullable(),
});

/**
 * Schedule a follow-up, or Edit the follow-up when there is one (spec UX §6.5): its local day, today
 * or later, and its note. Off the Cadence when there was none.
 */
export const scheduleFollowUp: Gesture<
  'follow_up_scheduled',
  ContactPlace,
  { dueOn: string; note: string | null },
  z.infer<typeof followUpScheduled>,
  'no_follow_up_in_status' | 'past_day'
> = {
  kind: 'follow_up_scheduled',
  subject: contactSubject,
  async refuse({ tx, userId, subject, input, now }) {
    if (!hasFollowUps(subject.status)) return refusal('no_follow_up_in_status');
    if (input.dueOn < (await localDateOf(tx, userId, now))) return refusal('past_day');
    return undefined;
  },
  async write({ tx, userId, subjectId: contactId, input: { dueOn, note }, now }) {
    const before = await scheduledFollowUp(tx, userId, contactId);
    let followUpId = before?.id;
    if (followUpId === undefined) {
      const [scheduled] = await tx
        .insert(followUp)
        .values({ userId, contactId, status: 'scheduled', dueOn, note, scheduledAt: now })
        .returning({ id: followUp.id });
      if (!scheduled) throw new Error('A Follow-up was not scheduled');
      followUpId = scheduled.id;
    } else {
      await tx
        .update(followUp)
        .set({ dueOn, note })
        .where(and(eq(followUp.userId, userId), eq(followUp.id, followUpId)));
    }
    return {
      retained: { followUpId, before: before ? { dueOn: before.dueOn, note: before.note } : null },
      touched: touched({ contactIds: [contactId] }),
    };
  },
  retained: followUpScheduled,
  /** A new Follow-up leaves no trace, a modified one gets its day and note back. */
  async inverse(tx, { userId, subjectId: contactId, retained: { followUpId, before } }) {
    const where = and(eq(followUp.userId, userId), eq(followUp.id, followUpId));
    if (before === null) await tx.delete(followUp).where(where);
    else await tx.update(followUp).set(before).where(where);
    return touched({ contactIds: [contactId] });
  },
};

/** What “Cancel the follow-up” retains: the Follow-up canceled. */
const followUpCanceled = z.object({ followUpId: z.uuid() });

/** Cancel the scheduled Follow-up (spec UX §5.3): it stays, canceled. */
export const cancelFollowUp: Gesture<
  'follow_up_canceled',
  ContactPlace,
  undefined,
  z.infer<typeof followUpCanceled>,
  'no_follow_up'
> = {
  kind: 'follow_up_canceled',
  subject: contactSubject,
  async write({ tx, userId, subjectId: contactId }) {
    const scheduled = await scheduledFollowUp(tx, userId, contactId);
    if (!scheduled) return refusal('no_follow_up');
    await setFollowUpStatus(tx, userId, scheduled.id, 'canceled');
    return {
      retained: { followUpId: scheduled.id },
      touched: touched({ contactIds: [contactId] }),
    };
  },
  retained: followUpCanceled,
  async inverse(tx, { userId, subjectId: contactId, retained: { followUpId } }) {
    await setFollowUpStatus(tx, userId, followUpId, 'scheduled');
    return touched({ contactIds: [contactId] });
  },
};

/** Schedules the Follow-up of a rank of the Cadence, if it has one: its id. */
async function scheduleNextRank(
  tx: Transaction,
  userId: string,
  contactId: string,
  rank: number,
  now: Date,
) {
  const days = await cadenceDays(tx, userId, contactId);
  const lastOn = await lastOutboundOn(tx, userId, contactId);
  const dueOn = days && lastOn && cadenceFollowUpOn(rank, lastOn, days);
  if (!dueOn) return undefined;
  const [scheduled] = await tx
    .insert(followUp)
    .values({ userId, contactId, status: 'scheduled', dueOn, rank, scheduledAt: now })
    .returning({ id: followUp.id });
  if (!scheduled) throw new Error('A Follow-up was not scheduled');
  return scheduled.id;
}

/** What “Follow up…” retains: the Follow-up done, the Interaction it became, the next one it scheduled. */
const followedUp = z.object({
  followUpId: z.uuid(),
  interactionId: z.uuid(),
  // Absent from the gestures recorded before the Cadence.
  nextFollowUpId: z.uuid().optional(),
});

/**
 * Follow up… (spec UX §6.3): the scheduled Follow-up becomes an outbound Interaction, dated the local
 * day entered (ST-36), a Prospecting action. Of the Cadence, the app schedules the next rank, its
 * interval after the last outbound Interaction done; past the last rank, the Response window is next.
 */
export const recordFollowUp: Gesture<
  'followed_up',
  ContactPlace,
  { occurredOn: string; note: string | null },
  z.infer<typeof followedUp>,
  'future_day' | 'no_follow_up'
> = {
  kind: 'followed_up',
  subject: contactSubject,
  async write({ tx, userId, subjectId: contactId, input: { occurredOn, note }, now }) {
    const day = await dayEntered(tx, userId, occurredOn, now);
    if ('error' in day) return day;
    const scheduled = await scheduledFollowUp(tx, userId, contactId);
    if (!scheduled) return refusal('no_follow_up');
    const interactionId = await recordInteraction(tx, {
      userId,
      contactId,
      kind: 'follow_up',
      direction: 'outbound',
      ...day,
      note,
    });
    await tx
      .update(followUp)
      .set({ status: 'done', interactionId })
      .where(and(eq(followUp.userId, userId), eq(followUp.id, scheduled.id)));
    const nextFollowUpId =
      scheduled.rank === null
        ? undefined
        : await scheduleNextRank(tx, userId, contactId, scheduled.rank + 1, now);
    return {
      retained: { followUpId: scheduled.id, interactionId, nextFollowUpId },
      touched: touched({ contactIds: [contactId] }),
    };
  },
  retained: followedUp,
  /** The Interaction leaves no trace, nor the next Follow-up, and the Follow-up is scheduled again. */
  async inverse(tx, { userId, subjectId: contactId, retained }) {
    const { followUpId, interactionId, nextFollowUpId } = retained;
    if (nextFollowUpId !== undefined) {
      await tx
        .delete(followUp)
        .where(and(eq(followUp.userId, userId), eq(followUp.id, nextFollowUpId)));
    }
    await tx
      .update(followUp)
      .set({ status: 'scheduled', interactionId: null })
      .where(and(eq(followUp.userId, userId), eq(followUp.id, followUpId)));
    await removeInteraction(tx, userId, interactionId);
    return touched({ contactIds: [contactId] });
  },
};
