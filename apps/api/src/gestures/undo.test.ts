import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { addContact } from '../../test/factories/contact.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { withUser } from '../db/index.ts';
import { recordGesture } from './index.ts';
import { gesture } from './tables.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const undo = (harness: Harness, user: User, id: string) =>
  postJson(harness.app, `/api/gestures/${id}/undo`, {}, user.cookie);

const gesturesOf = ({ userId }: User) =>
  withUser(userId, (tx) => tx.select().from(gesture).where(eq(gesture.userId, userId)));

test('“Undo” is refused once a later gesture touched the same Contact', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact, undoToken } = await addContact(harness, user);
  harness.clock.advance('PT1M');
  // No second gesture on a Contact exists yet: this one stands for the next ticket's.
  const later = await withUser(user.userId, (tx) =>
    recordGesture(tx, {
      userId: user.userId,
      kind: 'contact_added',
      contactId: contact.id,
      payload: {},
      now: harness.clock.now(),
    }),
  );

  const refused = await undo(harness, user, undoToken);

  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ error: 'superseded' });
  expect((await gesturesOf(user)).map((row) => row.id)).toEqual([undoToken, later]);
});

test('a gesture on another Contact leaves the way back open', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const first = await addContact(harness, user, 'Julie Martin');
  harness.clock.advance('PT1M');
  await addContact(harness, user, 'Jean Dupont');

  const response = await undo(harness, user, first.undoToken);

  expect(response.status).toBe(200);
});

test.each(['00000000-0000-7000-8000-000000000000', 'not-an-id'])(
  'a gesture nobody made answers 404: %s',
  async (id) => {
    const harness = testApp();
    const user = await makeUser(harness);

    const response = await undo(harness, user, id);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  },
);

test('a gesture that can no longer be undone is forgotten at the next one', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  await addContact(harness, user, 'Julie Martin');
  harness.clock.advance('PT15M1S');

  const { undoToken } = await addContact(harness, user);

  expect((await gesturesOf(user)).map((row) => row.id)).toEqual([undoToken]);
});
