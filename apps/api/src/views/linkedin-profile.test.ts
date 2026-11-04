import { CONTACT_STATUSES } from '@battlecrm/contract';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { extensionRequest, extensionTokenOf } from '../../test/extension.ts';
import {
  addContact,
  changeStatus,
  noteInteraction,
  recordReply,
  summaryOf,
} from '../../test/factories/contact.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const profileOf = (harness: Harness, user: User, url?: string) =>
  harness.app.request(
    `/api/contacts/linkedin-profile${url === undefined ? '' : `?${new URLSearchParams({ url }).toString()}`}`,
    { headers: { Cookie: user.cookie } },
  );

/** The card of a Contact found on a LinkedIn profile, or none (spec extension §8). */
const profile = z.strictObject({
  contact: z
    .strictObject({
      id: z.uuid(),
      name: z.string(),
      status: z.enum(CONTACT_STATUSES),
      stageName: z.string().nullable(),
      organizationName: z.string().nullable(),
      jobTitle: z.string().nullable(),
      lastDoneInteractionOn: z.iso.date().nullable(),
    })
    .nullable(),
});

const read = async (response: Response) => {
  expect(response.status).toBe(200);
  return profile.parse(await response.json());
};

test('a profile that is a Contact: its card, the names of its Organization and Stage resolved', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { stages } = await summaryOf(harness, user);
  const [first] = stages;
  if (!first) throw new Error('The User has no Stage');
  const { contact } = await addContact(harness, user, 'Gaëtan Lefèvre', {
    status: 'prospecting',
    stageId: first.id,
    jobTitle: 'Directeur technique',
    newOrganization: { name: 'Acme', type: 'consultancy' },
    linkedinUrl: 'https://www.linkedin.com/in/gaëtan-lefèvre-b7c41e2d',
  });
  // The tab's address: encoded, on a page of the profile.
  const url = 'https://www.linkedin.com/in/ga%C3%ABtan-lef%C3%A8vre-b7c41e2d/overlay/contact-info/';

  expect(await read(await profileOf(harness, user, url))).toEqual({
    contact: {
      id: contact.id,
      name: 'Gaëtan Lefèvre',
      status: 'prospecting',
      stageName: first.name,
      organizationName: 'Acme',
      jobTitle: 'Directeur technique',
      // Added, never in touch yet: the day it was added does not count.
      lastDoneInteractionOn: null,
    },
  });
});

test('the latest Interaction done, outbound or inbound; no Stage out of Prospecting', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const url = 'https://www.linkedin.com/in/camille-durand';
  const { contact } = await addContact(harness, user, 'Camille Durand', { linkedinUrl: url });
  await noteInteraction(harness, user, contact.id, { kind: 'call', occurredOn: '2026-01-02' });
  await recordReply(harness, user, contact.id, { occurredOn: '2026-01-03', channel: 'email' });
  // A change of Status is no exchange.
  await changeStatus(harness, user, contact.id, { status: 'ally' });

  expect((await read(await profileOf(harness, user, url))).contact).toMatchObject({
    status: 'ally',
    stageName: null,
    organizationName: null,
    jobTitle: null,
    lastDoneInteractionOn: '2026-01-03',
  });
});

test('an Archived Contact has its card; a deleted one, an unknown profile and no profile none', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const archived = 'https://www.linkedin.com/in/camille-durand';
  const deleted = 'https://www.linkedin.com/in/ines-l-c83e9a51f';
  const { contact } = await addContact(harness, user, 'Camille Durand', { linkedinUrl: archived });
  await changeStatus(harness, user, contact.id, { status: 'archived' });
  const { contact: gone } = await addContact(harness, user, 'Inès L.', { linkedinUrl: deleted });
  const deletion = await postJson(harness.app, `/api/contacts/${gone.id}/delete`, {}, user.cookie);
  expect(deletion.status).toBe(200);

  expect((await read(await profileOf(harness, user, archived))).contact).toMatchObject({
    id: contact.id,
    status: 'archived',
  });
  expect(await read(await profileOf(harness, user, deleted))).toEqual({ contact: null });
  expect(
    await read(await profileOf(harness, user, 'https://www.linkedin.com/in/julien-moreau')),
  ).toEqual({ contact: null });
  // Ignored, never refused.
  expect(await read(await profileOf(harness, user, 'https://example.com/'))).toEqual({
    contact: null,
  });
  expect((await profileOf(harness, user)).status).toBe(400);
});

test("another User's Contact is never found, by the cookie or by the extension's token", async () => {
  const harness = testApp();
  const alice = await makeUser(harness);
  const bob = await makeUser(harness);
  const url = 'https://www.linkedin.com/in/camille-durand';
  const { contact: alices } = await addContact(harness, alice, 'Camille Durand', {
    linkedinUrl: url,
    status: 'ally',
  });
  const token = await extensionTokenOf(harness, alice);

  expect(await read(await profileOf(harness, bob, url))).toEqual({ contact: null });
  const asAliceExtension = await extensionRequest(
    harness.app,
    `/api/contacts/linkedin-profile?${new URLSearchParams({ url }).toString()}`,
    { token },
  );
  expect((await read(asAliceExtension)).contact).toMatchObject({ id: alices.id, status: 'ally' });
});
