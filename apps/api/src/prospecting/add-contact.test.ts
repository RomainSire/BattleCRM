import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import {
  addContact,
  gestureAnswer,
  summaryChanges,
  summaryContact,
} from '../../test/factories/contact.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { withUser } from '../db/index.ts';
import { contact, interaction } from './tables.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const summary = z.strictObject({ contacts: z.array(summaryContact) });

async function summaryOf(harness: Harness, user: User) {
  const response = await harness.app.request('/api/summary', { headers: { Cookie: user.cookie } });
  expect(response.status).toBe(200);
  return summary.parse(await response.json());
}

const rowsOf = ({ userId }: User) =>
  withUser(userId, async (tx) => ({
    contacts: await tx.select().from(contact).where(eq(contact.userId, userId)),
    interactions: await tx.select().from(interaction).where(eq(interaction.userId, userId)),
  }));

const undo = (harness: Harness, user: User, undoToken: string) =>
  postJson(harness.app, `/api/gestures/${undoToken}/undo`, {}, user.cookie);

test('adding a Contact puts it in the Pool and answers with its row of the summary', async () => {
  const harness = testApp();
  const user = await makeUser(harness);

  const response = await postJson(
    harness.app,
    '/api/contacts',
    { name: '  Jean Dupont ' },
    user.cookie,
  );

  expect(response.status).toBe(201);
  const { changes } = gestureAnswer.parse(await response.json());
  expect(changes).toEqual({
    contacts: [
      {
        id: expect.any(String),
        name: 'Jean Dupont',
        status: 'pool',
        lastInteractionAt: '2026-01-05T09:00:00.000Z',
        lastInteractionOn: '2026-01-05',
      },
    ],
    removedContactIds: [],
  });
  expect(await summaryOf(harness, user)).toEqual({ contacts: changes.contacts });
});

test('the addition is an Interaction neither outbound nor inbound, dated by the clock of the app in the local day of the User', async () => {
  const harness = testApp();
  const user = await makeUser(harness, { timeZone: 'Europe/Paris' });
  // 23:30 UTC on January 5th is already January 6th in Paris.
  harness.clock.advance('PT14H30M');

  const { contact: added } = await addContact(harness, user);

  const now = new Date('2026-01-05T23:30:00Z');
  expect(await rowsOf(user)).toEqual({
    contacts: [
      { id: added.id, userId: user.userId, name: 'Jean Dupont', status: 'pool', createdAt: now },
    ],
    interactions: [
      {
        id: expect.any(String),
        userId: user.userId,
        contactId: added.id,
        kind: 'contact_added',
        direction: 'none',
        occurredAt: now,
        localDate: '2026-01-06',
        recordedAt: now,
      },
    ],
  });
  expect(added.lastInteractionOn).toBe('2026-01-06');
});

test.each([
  ['no name', {}],
  ['an empty name', { name: '' }],
  ['a blank name', { name: '   ' }],
  ['a name too long', { name: 'a'.repeat(201) }],
  ['a name that is no text', { name: 42 }],
])('a Contact needs a name: %s is refused and writes nothing', async (_case, body) => {
  const harness = testApp();
  const user = await makeUser(harness);

  const response = await postJson(harness.app, '/api/contacts', body, user.cookie);

  expect(response.status).toBe(400);
  expect(await rowsOf(user)).toEqual({ contacts: [], interactions: [] });
});

test('two Contacts may carry the same name', async () => {
  const harness = testApp();
  const user = await makeUser(harness);

  const first = await addContact(harness, user, 'Jean Dupont');
  const second = await addContact(harness, user, 'Jean Dupont');

  expect(second.contact.id).not.toBe(first.contact.id);
  expect((await summaryOf(harness, user)).contacts).toHaveLength(2);
});

test('“Undo” takes the addition back: neither the Contact nor its Interaction is left', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const kept = await addContact(harness, user, 'Julie Martin');
  const { contact: added, undoToken } = await addContact(harness, user);

  const response = await undo(harness, user, undoToken);

  expect(response.status).toBe(200);
  expect(z.strictObject({ changes: summaryChanges }).parse(await response.json())).toEqual({
    changes: { contacts: [], removedContactIds: [added.id] },
  });
  expect(await summaryOf(harness, user)).toEqual({ contacts: [kept.contact] });
  const rows = await rowsOf(user);
  expect(rows.contacts.map((row) => row.id)).toEqual([kept.contact.id]);
  expect(rows.interactions.map((row) => row.contactId)).toEqual([kept.contact.id]);
});

test('a gesture is undone once', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { undoToken } = await addContact(harness, user);
  await undo(harness, user, undoToken);

  const again = await undo(harness, user, undoToken);

  expect(again.status).toBe(404);
});

test('“Undo” is accepted for 15 minutes, then refused and the Contact stays', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const late = await addContact(harness, user, 'Julie Martin');
  harness.clock.advance('PT1S');
  const inTime = await addContact(harness, user);
  harness.clock.advance('PT15M');

  const refused = await undo(harness, user, late.undoToken);
  const accepted = await undo(harness, user, inTime.undoToken);

  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ error: 'expired' });
  expect(accepted.status).toBe(200);
  expect(await summaryOf(harness, user)).toEqual({ contacts: [late.contact] });
});
