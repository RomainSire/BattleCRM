import { summaryChanges } from '@battlecrm/contract';
import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { addContact, gestureAnswer, summaryOf } from '../../test/factories/contact.ts';
import { undo } from '../../test/factories/gesture.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { withUser } from '../db/index.ts';
import { organization } from '../organizations/index.ts';
import { contact } from './index.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const rowsOf = ({ userId }: User) =>
  withUser(userId, async (tx) => ({
    contacts: await tx.select().from(contact).where(eq(contact.userId, userId)).orderBy(contact.id),
    organizations: await tx
      .select()
      .from(organization)
      .where(eq(organization.userId, userId))
      .orderBy(organization.id),
  }));

const add = (harness: Harness, user: User, body: object) =>
  postJson(harness.app, '/api/contacts', { name: 'Jean Dupont', ...body }, user.cookie);

test('an Organization created with its type in the quick add comes with the answer, and in the summary', async () => {
  const harness = testApp();
  const user = await makeUser(harness);

  const response = await add(harness, user, {
    newOrganization: { name: ' Capgemini ', type: 'consultancy' },
  });

  expect(response.status).toBe(201);
  const { changes } = gestureAnswer.parse(await response.json());
  const [created] = changes.organizations;
  expect(changes.organizations).toEqual([
    { id: expect.any(String), name: 'Capgemini', type: 'consultancy' },
  ]);
  expect(changes.contacts).toMatchObject([{ organizationId: created!.id }]);
  const read = await summaryOf(harness, user);
  expect(read.organizations).toEqual(changes.organizations);
  expect(read.contacts).toEqual(changes.contacts);
  expect((await rowsOf(user)).organizations).toMatchObject([
    { name: 'Capgemini', normalizedName: 'capgemini', type: 'consultancy' },
  ]);
});

test('a Contact joins an Organization of its User', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { organization: capgemini } = await addContact(harness, user, 'Julie Martin', {
    newOrganization: { name: 'Capgemini', type: 'consultancy' },
  });

  const { contact: added } = await addContact(harness, user, 'Jean Dupont', {
    organizationId: capgemini!.id,
  });

  expect(added.organizationId).toBe(capgemini!.id);
  expect((await summaryOf(harness, user)).organizations).toHaveLength(1);
});

test('two Organizations never share a name, case, accents and spaces aside: the second is refused and nothing is written', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  await addContact(harness, user, 'Julie Martin', {
    newOrganization: { name: 'Société Générale', type: 'end_client' },
  });

  const response = await add(harness, user, {
    newOrganization: { name: 'societe  GENERALE', type: 'consultancy' },
  });

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'organization_taken' });
  const rows = await rowsOf(user);
  expect(rows.contacts.map(({ name }) => name)).toEqual(['Julie Martin']);
  expect(rows.organizations).toHaveLength(1);
});

test('an Organization of another User, or none at all, is refused', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const other = await makeUser(harness);
  const { organization: theirs } = await addContact(harness, other, 'Julie Martin', {
    newOrganization: { name: 'Capgemini', type: 'consultancy' },
  });

  const refusals = [
    await add(harness, user, { organizationId: theirs!.id }),
    await add(harness, user, { organizationId: '00000000-0000-7000-8000-000000000000' }),
    await add(harness, user, {
      organizationId: theirs!.id,
      newOrganization: { name: 'Sopra', type: 'consultancy' },
    }),
    await add(harness, user, { newOrganization: { name: 'Sopra', type: 'esn' } }),
    await add(harness, user, { newOrganization: { name: '  ', type: 'consultancy' } }),
  ];

  expect(refusals.map((response) => response.status)).toEqual([400, 400, 400, 400, 400]);
  expect(await refusals[0]!.json()).toEqual({ error: 'unknown_organization' });
  expect(await rowsOf(user)).toEqual({ contacts: [], organizations: [] });
});

test('the LinkedIn profile is kept normalized, with the other fields, trimmed; the note stays out of the summary', async () => {
  const harness = testApp();
  const user = await makeUser(harness);

  const { contact: added } = await addContact(harness, user, 'Jean Dupont', {
    linkedinUrl: ' http://www.linkedin.com/in/jean-dupont/?trk=public ',
    jobTitle: ' Business manager ',
    email: ' jean.dupont@example.com ',
    phone: ' 06 12 34 56 78 ',
    note: ' Met at the Devoxx booth. ',
  });

  expect(added).toMatchObject({
    linkedinUrl: 'https://linkedin.com/in/jean-dupont',
    jobTitle: 'Business manager',
    email: 'jean.dupont@example.com',
    phone: '06 12 34 56 78',
  });
  expect(added).not.toHaveProperty('note');
  expect((await rowsOf(user)).contacts).toMatchObject([{ note: 'Met at the Devoxx booth.' }]);
});

test('a blank optional field is no value', async () => {
  const harness = testApp();
  const user = await makeUser(harness);

  const { contact: added } = await addContact(harness, user, 'Jean Dupont', {
    linkedinUrl: ' ',
    jobTitle: '',
    email: '  ',
    phone: '',
    note: ' ',
  });

  expect(added).toMatchObject({ linkedinUrl: null, jobTitle: null, email: null, phone: null });
  expect((await rowsOf(user)).contacts).toMatchObject([{ note: null }]);
});

test('an address that is no LinkedIn profile is refused', async () => {
  const harness = testApp();
  const user = await makeUser(harness);

  const response = await add(harness, user, { linkedinUrl: 'example.com/in/jean-dupont' });

  expect(response.status).toBe(400);
  expect((await rowsOf(user)).contacts).toEqual([]);
});

test('the same LinkedIn profile, however written, is refused by the unique index: the Organization of the gesture is not left behind', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const other = await makeUser(harness);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    linkedinUrl: 'https://www.linkedin.com/in/jean-dupont',
  });
  // Another User may know the same person.
  await addContact(harness, other, 'Jean Dupont', { linkedinUrl: 'linkedin.com/in/jean-dupont' });

  const response = await add(harness, user, {
    name: 'J. Dupont',
    linkedinUrl: 'linkedin.com/in/jean-dupont/',
    newOrganization: { name: 'Capgemini', type: 'consultancy' },
  });

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'linkedin_url_taken', contactId: jean.id });
  expect(await rowsOf(user)).toMatchObject({ contacts: [{ id: jean.id }], organizations: [] });
});

test('“Undo” takes back the Organization the addition created, and keeps one that was already there', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { organization: capgemini } = await addContact(harness, user, 'Julie Martin', {
    newOrganization: { name: 'Capgemini', type: 'consultancy' },
  });
  const created = await addContact(harness, user, 'Jean Dupont', {
    newOrganization: { name: 'Sopra Steria', type: 'consultancy' },
  });
  const joined = await addContact(harness, user, 'Paul Durand', { organizationId: capgemini!.id });

  const undone = z.object({ changes: summaryChanges });
  const { changes: first } = undone.parse(
    await (await undo(harness, user, created.undoToken)).json(),
  );
  const { changes: second } = undone.parse(
    await (await undo(harness, user, joined.undoToken)).json(),
  );

  expect(first.removedOrganizationIds).toEqual([created.organization!.id]);
  expect(second.removedOrganizationIds).toEqual([]);
  expect((await summaryOf(harness, user)).organizations).toEqual([capgemini]);
});

test('“Undo” keeps the Organization it created once another Contact joined it', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const created = await addContact(harness, user, 'Jean Dupont', {
    newOrganization: { name: 'Sopra Steria', type: 'consultancy' },
  });
  await addContact(harness, user, 'Julie Martin', { organizationId: created.organization!.id });

  const response = await undo(harness, user, created.undoToken);

  expect(response.status).toBe(200);
  expect((await summaryOf(harness, user)).organizations).toEqual([created.organization]);
});
