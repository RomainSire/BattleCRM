import { hasFollowUps } from '@battlecrm/domain';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import type { Transaction } from '../db/index.ts';
import { touched, type Gesture } from '../gestures/index.ts';
import { refusal } from '../refusals.ts';
import { localDateOf } from '../settings/index.ts';
import { contactSubject, type ContactPlace } from './contact-subject.ts';
import { dayEntered, recordInteraction, removeInteraction } from './interactions.ts';
import { followUp } from './tables.ts';

/** The scheduled Follow-up of a Contact, if it has one. */
export async function scheduledFollowUp(tx: Transaction, userId: string, contactId: string) {
  const [scheduled] = await tx
    .select({ id: followUp.id, dueOn: followUp.dueOn, note: followUp.note })
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

/** What “Follow up…” retains: the Follow-up done, and the Interaction it became. */
const followedUp = z.object({ followUpId: z.uuid(), interactionId: z.uuid() });

/**
 * Follow up… (spec UX §6.3): the scheduled Follow-up becomes an outbound Interaction, dated the local
 * day entered (ST-36), a Prospecting action.
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
    return {
      retained: { followUpId: scheduled.id, interactionId },
      touched: touched({ contactIds: [contactId] }),
    };
  },
  retained: followedUp,
  /** The Interaction leaves no trace, and the Follow-up is scheduled again. */
  async inverse(tx, { userId, subjectId: contactId, retained: { followUpId, interactionId } }) {
    await tx
      .update(followUp)
      .set({ status: 'scheduled', interactionId: null })
      .where(and(eq(followUp.userId, userId), eq(followUp.id, followUpId)));
    await removeInteraction(tx, userId, interactionId);
    return touched({ contactIds: [contactId] });
  },
};
