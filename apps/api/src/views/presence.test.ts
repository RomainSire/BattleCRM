import { CONTACT_STATUSES } from '@battlecrm/contract';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { extensionRequest, extensionTokenOf } from '../../test/extension.ts';
import { addContact, changeStatus } from '../../test/factories/contact.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const presenceOf = (harness: Harness, user: User, linkedinUrls: unknown) =>
  postJson(harness.app, '/api/contacts/presence', { linkedinUrls }, user.cookie);

/** Which of the profiles sent are Contacts of the User (spec extension §8). */
const presence = z.strictObject({
  matches: z.array(
    z.strictObject({
      linkedinUrl: z.string(),
      contactId: z.uuid(),
      status: z.enum(CONTACT_STATUSES),
    }),
  ),
});

test('a profile that is a Contact is matched, under the address as sent; the others are left out', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact } = await addContact(harness, user, 'Gaëtan Lefèvre', {
    status: 'ally',
    linkedinUrl: 'https://www.linkedin.com/in/gaëtan-lefèvre-b7c41e2d',
  });
  // The tab's address: encoded, on a page of the profile.
  const sent =
    'https://www.linkedin.com/in/ga%C3%ABtan-lef%C3%A8vre-b7c41e2d/overlay/contact-info/';

  const response = await presenceOf(harness, user, [
    sent,
    'https://www.linkedin.com/in/julien-moreau-482915307/',
  ]);

  expect(response.status).toBe(200);
  expect(presence.parse(await response.json())).toEqual({
    matches: [{ linkedinUrl: sent, contactId: contact.id, status: 'ally' }],
  });
});

test('an Archived Contact is found like the others; a deleted one never is', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const archived = 'https://www.linkedin.com/in/camille-durand';
  const deleted = 'https://www.linkedin.com/in/ines-l-c83e9a51f';
  const { contact } = await addContact(harness, user, 'Camille Durand', { linkedinUrl: archived });
  await changeStatus(harness, user, contact.id, { status: 'archived' });
  const { contact: gone } = await addContact(harness, user, 'Inès L.', { linkedinUrl: deleted });
  const deletion = await postJson(harness.app, `/api/contacts/${gone.id}/delete`, {}, user.cookie);
  expect(deletion.status).toBe(200);

  const response = await presenceOf(harness, user, [archived, deleted]);

  expect(presence.parse(await response.json())).toEqual({
    matches: [{ linkedinUrl: archived, contactId: contact.id, status: 'archived' }],
  });
});

test('an address that is no LinkedIn profile is left out, never refused', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const url = 'https://www.linkedin.com/in/camille-durand';
  const { contact } = await addContact(harness, user, 'Camille Durand', { linkedinUrl: url });

  const response = await presenceOf(harness, user, ['not an address', 'https://example.com/', url]);

  expect(response.status).toBe(200);
  expect(presence.parse(await response.json())).toEqual({
    matches: [{ linkedinUrl: url, contactId: contact.id, status: 'pool' }],
  });
});

test('50 addresses at most: 51 are refused, and so is a body that is no list of addresses', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const urls = Array.from({ length: 51 }, (_, i) => `https://www.linkedin.com/in/person-${i}`);

  expect((await presenceOf(harness, user, urls.slice(0, 50))).status).toBe(200);
  expect((await presenceOf(harness, user, urls)).status).toBe(400);
  expect((await presenceOf(harness, user, 'https://www.linkedin.com/in/x')).status).toBe(400);
  expect((await presenceOf(harness, user, [42])).status).toBe(400);
});

test("another User's Contact is never matched, by the cookie or by the extension's token", async () => {
  const harness = testApp();
  const alice = await makeUser(harness);
  const bob = await makeUser(harness);
  const url = 'https://www.linkedin.com/in/camille-durand';
  const { contact: alices } = await addContact(harness, alice, 'Camille Durand', {
    linkedinUrl: url,
    status: 'ally',
  });
  const { contact: bobs } = await addContact(harness, bob, 'Camille Durand', { linkedinUrl: url });
  const token = await extensionTokenOf(harness, alice);

  const asBob = await presenceOf(harness, bob, [url]);
  const asAliceExtension = await extensionRequest(harness.app, '/api/contacts/presence', {
    token,
    body: { linkedinUrls: [url] },
  });

  expect(presence.parse(await asBob.json())).toEqual({
    matches: [{ linkedinUrl: url, contactId: bobs.id, status: 'pool' }],
  });
  expect(asAliceExtension.status).toBe(200);
  expect(presence.parse(await asAliceExtension.json())).toEqual({
    matches: [{ linkedinUrl: url, contactId: alices.id, status: 'ally' }],
  });
});
