import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import {
  addContact,
  editContact,
  gestureAnswer,
  summaryChanges,
  summaryOf,
} from '../../test/factories/contact.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { withUser } from '../db/index.ts';
import { organization } from '../organizations/index.ts';
import { contact, interaction } from './index.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const rowsOf = ({ userId }: User) =>
  withUser(userId, async (tx) => ({
    contacts: await tx.select().from(contact).where(eq(contact.userId, userId)),
    organizations: await tx.select().from(organization).where(eq(organization.userId, userId)),
    interactions: await tx.select().from(interaction).where(eq(interaction.userId, userId)),
  }));

const edit = (harness: Harness, user: User, contactId: string, body: object) =>
  postJson(harness.app, `/api/contacts/${contactId}/edit`, body, user.cookie);

const undo = (harness: Harness, user: User, undoToken: string) =>
  postJson(harness.app, `/api/gestures/${undoToken}/undo`, {}, user.cookie);

const undone = z.object({ changes: summaryChanges });

/** A Contact with every Coordinate filled, at Capgemini. */
const fullContact = (harness: Harness, user: User) =>
  addContact(harness, user, 'Jean Dupont', {
    newOrganization: { name: 'Capgemini', type: 'consultancy' },
    linkedinUrl: 'linkedin.com/in/jean-dupont',
    jobTitle: 'Business manager',
    email: 'jean.dupont@example.com',
    phone: '06 12 34 56 78',
    note: 'Met at the Devoxx booth.',
  });

test('an edit writes every Coordinate, trimmed and normalized, and answers with the Contact', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean, organization: capgemini } = await fullContact(harness, user);

  const response = await edit(harness, user, jean.id, {
    name: ' Jean-Marc Dupont ',
    organizationId: capgemini!.id,
    linkedinUrl: ' https://www.linkedin.com/in/jm-dupont/?trk=x ',
    jobTitle: ' Head of sales ',
    email: ' jm.dupont@example.com ',
    phone: ' 07 00 00 00 00 ',
    note: ' Prefers calls. ',
  });

  expect(response.status).toBe(200);
  const { changes } = gestureAnswer.parse(await response.json());
  expect(changes.contacts).toEqual([
    {
      ...jean,
      name: 'Jean-Marc Dupont',
      linkedinUrl: 'https://linkedin.com/in/jm-dupont',
      jobTitle: 'Head of sales',
      email: 'jm.dupont@example.com',
      phone: '07 00 00 00 00',
    },
  ]);
  expect(changes.organizations).toEqual([]);
  expect((await summaryOf(harness, user)).contacts).toEqual(changes.contacts);
  expect((await rowsOf(user)).contacts).toMatchObject([{ note: 'Prefers calls.' }]);
});

test('a field left blank or out is emptied; the name alone is required', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean } = await fullContact(harness, user);

  const { contact: edited } = await editContact(harness, user, jean.id, {
    name: 'Jean Dupont',
    jobTitle: ' ',
    email: '',
  });

  expect(edited).toMatchObject({
    organizationId: null,
    linkedinUrl: null,
    jobTitle: null,
    email: null,
    phone: null,
  });
  expect((await rowsOf(user)).contacts).toMatchObject([{ note: null }]);
  const refused = await edit(harness, user, jean.id, { name: '  ' });
  expect(refused.status).toBe(400);
});

test('an edit is no Interaction, and leaves the Stage and the Status alone', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    status: 'prospecting',
  });
  harness.clock.advance('P1D');

  const { contact: edited } = await editContact(harness, user, jean.id, {
    name: 'Jean Dupont',
    status: 'archived',
    stageId: null,
  });

  expect(edited).toMatchObject({
    status: 'prospecting',
    stageId: jean.stageId,
    lastInteractionAt: jean.lastInteractionAt,
  });
  expect((await rowsOf(user)).interactions).toHaveLength(1);
});

test('a new Organization is created with its type, and comes with the answer', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean } = await addContact(harness, user);

  const { contact: edited, organization: created } = await editContact(harness, user, jean.id, {
    name: 'Jean Dupont',
    newOrganization: { name: ' Sopra Steria ', type: 'consultancy' },
  });

  expect(created).toEqual({ id: expect.any(String), name: 'Sopra Steria', type: 'consultancy' });
  expect(edited.organizationId).toBe(created!.id);
});

test('an Organization taken, unknown or of another User is refused, and nothing is written', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const other = await makeUser(harness);
  const { contact: jean } = await fullContact(harness, user);
  const { organization: theirs } = await addContact(harness, other, 'Julie Martin', {
    newOrganization: { name: 'Sopra', type: 'consultancy' },
  });
  const before = await rowsOf(user);

  const taken = await edit(harness, user, jean.id, {
    name: 'Jean Dupont',
    newOrganization: { name: 'CAPGEMINI', type: 'end_client' },
  });
  const unknown = await edit(harness, user, jean.id, {
    name: 'Jean Dupont',
    organizationId: theirs!.id,
  });

  expect(taken.status).toBe(409);
  expect(await taken.json()).toEqual({ error: 'organization_taken' });
  expect(unknown.status).toBe(400);
  expect(await unknown.json()).toEqual({ error: 'unknown_organization' });
  expect(await rowsOf(user)).toEqual(before);
});

test('the LinkedIn profile of another Contact is refused; its own is fine', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean } = await fullContact(harness, user);
  const { contact: julie } = await addContact(harness, user, 'Julie Martin', {
    linkedinUrl: 'linkedin.com/in/julie-martin',
  });

  const refused = await edit(harness, user, jean.id, {
    name: 'Jean Dupont',
    linkedinUrl: 'https://www.linkedin.com/in/julie-martin/',
    newOrganization: { name: 'Sopra', type: 'consultancy' },
  });
  const kept = await edit(harness, user, jean.id, {
    name: 'Jean Dupont',
    linkedinUrl: 'https://www.linkedin.com/in/jean-dupont/',
  });

  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ error: 'linkedin_url_taken', contactId: julie.id });
  expect((await rowsOf(user)).organizations.map(({ name }) => name)).toEqual(['Capgemini']);
  expect(kept.status).toBe(200);
});

test('a Contact of another User, or none, answers 404', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const other = await makeUser(harness);
  const { contact: theirs } = await addContact(harness, other);

  const responses = [
    await edit(harness, user, theirs.id, { name: 'Jean Dupont' }),
    await edit(harness, user, '00000000-0000-7000-8000-000000000000', { name: 'Jean Dupont' }),
    await edit(harness, user, 'not-an-id', { name: 'Jean Dupont' }),
  ];

  expect(responses.map(({ status }) => status)).toEqual([404, 404, 404]);
  expect((await summaryOf(harness, other)).contacts).toEqual([theirs]);
});

test('“Undo” restores every Coordinate, and takes back the Organization the edit created', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean, organization: capgemini } = await fullContact(harness, user);
  const before = await rowsOf(user);
  harness.clock.advance('PT1M');
  const { undoToken, organization: created } = await editContact(harness, user, jean.id, {
    name: 'Jean-Marc Dupont',
    newOrganization: { name: 'Sopra', type: 'consultancy' },
  });

  const response = await undo(harness, user, undoToken);

  expect(response.status).toBe(200);
  const { changes } = undone.parse(await response.json());
  expect(changes.contacts).toEqual([jean]);
  expect(changes.removedOrganizationIds).toEqual([created!.id]);
  expect(await rowsOf(user)).toEqual(before);
  expect((await summaryOf(harness, user)).organizations).toEqual([capgemini]);
});

test('“Undo” keeps the Organization the edit created once another Contact joined it', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean } = await addContact(harness, user);
  const { undoToken, organization: created } = await editContact(harness, user, jean.id, {
    name: 'Jean Dupont',
    newOrganization: { name: 'Sopra', type: 'consultancy' },
  });
  await addContact(harness, user, 'Julie Martin', { organizationId: created!.id });

  const { changes } = undone.parse(await (await undo(harness, user, undoToken)).json());

  expect(changes.removedOrganizationIds).toEqual([]);
  expect((await summaryOf(harness, user)).organizations).toEqual([created]);
});

test('“Undo” is refused when another Contact took the LinkedIn profile back meanwhile', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean } = await fullContact(harness, user);
  const { undoToken } = await editContact(harness, user, jean.id, { name: 'Jean Dupont' });
  await addContact(harness, user, 'J. Dupont', { linkedinUrl: 'linkedin.com/in/jean-dupont' });

  const response = await undo(harness, user, undoToken);

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'superseded' });
  expect((await rowsOf(user)).contacts.find(({ id }) => id === jean.id)).toMatchObject({
    linkedinUrl: null,
  });
});

test('“Undo” is refused when the Organization it would restore is gone', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const julie = await addContact(harness, user, 'Julie Martin', {
    newOrganization: { name: 'Capgemini', type: 'consultancy' },
  });
  const { contact: jean } = await addContact(harness, user, 'Jean Dupont', {
    organizationId: julie.organization!.id,
  });
  const { undoToken } = await editContact(harness, user, jean.id, { name: 'Jean Dupont' });
  // Undoing Julie's addition takes Capgemini back: Jean left it.
  await undo(harness, user, julie.undoToken);

  const response = await undo(harness, user, undoToken);

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'superseded' });
});

test('an edit closes the way back of the addition, and a later edit that of the earlier one', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const added = await addContact(harness, user);
  harness.clock.advance('PT1M');
  const first = await editContact(harness, user, added.contact.id, { name: 'Jean-Marc Dupont' });
  harness.clock.advance('PT1M');
  await editContact(harness, user, added.contact.id, { name: 'J.-M. Dupont' });

  expect((await undo(harness, user, added.undoToken)).status).toBe(409);
  expect((await undo(harness, user, first.undoToken)).status).toBe(409);
});
