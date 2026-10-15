import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import {
  addContact,
  scheduleFollowUp as sendScheduleFollowUp,
} from '../../test/factories/contact.ts';
import { makeUser } from '../../test/factories/user.ts';
import { withUser } from '../db/index.ts';
import { touched } from '../gestures/index.ts';
import { scheduleFollowUp } from './follow-ups.ts';
import { followUp } from './index.ts';

type User = Awaited<ReturnType<typeof makeUser>>;

const followUpsOf = ({ userId }: User) =>
  withUser(userId, (tx) =>
    tx.select().from(followUp).where(eq(followUp.userId, userId)).orderBy(followUp.id),
  );

/** The inverse alone, in a transaction of its own: no route, no `gesture` row. */
const undo = (user: User, contactId: string, retained: unknown) =>
  withUser(user.userId, (tx) =>
    scheduleFollowUp.inverse(tx, {
      userId: user.userId,
      subjectId: contactId,
      retained: scheduleFollowUp.retained.parse(retained),
    }),
  );

test('the inverse of “Schedule a follow-up” takes a new Follow-up away, and gives a modified one its day and note back', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
  });
  await sendScheduleFollowUp(harness, user, jean.id, { dueOn: '2026-01-08', note: 'Tender' });
  const [first] = await followUpsOf(user);
  if (!first) throw new Error('No Follow-up was scheduled');
  await sendScheduleFollowUp(harness, user, jean.id, { dueOn: '2026-01-12' });

  const restored = await undo(user, jean.id, {
    followUpId: first.id,
    before: { dueOn: '2026-01-08', note: 'Tender' },
  });

  expect(restored).toEqual(touched({ contactIds: [jean.id] }));
  expect(await followUpsOf(user)).toEqual([first]);

  await undo(user, jean.id, { followUpId: first.id, before: null });

  expect(await followUpsOf(user)).toEqual([]);
});
