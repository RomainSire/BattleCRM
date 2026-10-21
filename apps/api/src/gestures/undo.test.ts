import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { addContact, editContact } from '../../test/factories/contact.ts';
import { undo } from '../../test/factories/gesture.ts';
import { makeUser } from '../../test/factories/user.ts';
import { withUser } from '../db/index.ts';
import { gesture } from './tables.ts';

type User = Awaited<ReturnType<typeof makeUser>>;

const gesturesOf = ({ userId }: User) =>
  withUser(userId, (tx) =>
    tx.select().from(gesture).where(eq(gesture.userId, userId)).orderBy(gesture.id),
  );

test('“Undo” is refused once a later gesture touched the same Contact', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact, undoToken } = await addContact(harness, user);
  harness.clock.advance('PT1M');
  const { undoToken: later } = await editContact(harness, user, contact.id, { name: 'Jean-Marc' });

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
