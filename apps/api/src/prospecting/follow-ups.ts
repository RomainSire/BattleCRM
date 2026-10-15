import { hasFollowUps } from '@battlecrm/domain';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import type { Transaction } from '../db/index.ts';
import { touched, type Gesture } from '../gestures/index.ts';
import { refusal } from '../refusals.ts';
import { localDateOf } from '../settings/index.ts';
import { contactSubject, type ContactPlace } from './contact-subject.ts';
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
