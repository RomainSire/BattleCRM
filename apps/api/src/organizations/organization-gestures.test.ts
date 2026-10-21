import { summaryChanges } from '@battlecrm/contract';
import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { addContact, editContact, summaryOf } from '../../test/factories/contact.ts';
import { undo } from '../../test/factories/gesture.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postJson } from '../../test/http.ts';
import { withUser } from '../db/index.ts';
import { organization } from './index.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

/** A gesture on an Organization: confirmed beforehand, never undone (spec UX §1). */
const changed = z.strictObject({ changes: summaryChanges });

const gesture = (harness: Harness, user: User, path: string, body: object = {}) =>
  postJson(harness.app, `/api/organizations/${path}`, body, user.cookie);

const organizationsOf = ({ userId }: User) =>
  withUser(userId, (tx) =>
    tx
      .select({ name: organization.name, normalizedName: organization.normalizedName })
      .from(organization)
      .where(eq(organization.userId, userId))
      .orderBy(organization.id),
  );

/** A Contact added with a new Organization, which comes back with it. */
async function memberOf(
  harness: Harness,
  user: User,
  name: string,
  newOrganization: { name: string; type: 'consultancy' | 'end_client' },
) {
  const { contact, organization: created } = await addContact(harness, user, name, {
    newOrganization,
  });
  if (!created) throw new Error('memberOf: no Organization was created');
  return { contact, organization: created };
}

test('renaming keeps the name as written and normalizes it for the unique index', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { organization: capgemini } = await memberOf(harness, user, 'Jean Dupont', {
    name: 'Capgemni',
    type: 'consultancy',
  });

  const response = await gesture(harness, user, `${capgemini.id}/rename`, {
    name: '  Capgemini Engineering ',
  });

  expect(response.status).toBe(200);
  const { changes } = changed.parse(await response.json());
  expect(changes).toEqual({
    contacts: [],
    removedContactIds: [],
    organizations: [{ ...capgemini, name: 'Capgemini Engineering' }],
    removedOrganizationIds: [],
    positionings: [],
    removedPositioningIds: [],
    battles: [],
    removedBattleIds: [],
  });
  expect(await organizationsOf(user)).toEqual([
    { name: 'Capgemini Engineering', normalizedName: 'capgeminiengineering' },
  ]);
});

test('a name another Organization has, case, accents and spaces aside, is refused', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  await memberOf(harness, user, 'Jean Dupont', { name: 'Société Générale', type: 'end_client' });
  const { organization: sg } = await memberOf(harness, user, 'Julie Martin', {
    name: 'SG',
    type: 'end_client',
  });

  const refused = await gesture(harness, user, `${sg.id}/rename`, { name: 'societe  generale' });

  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ error: 'organization_taken' });
  // Its own name, written another way, is no other Organization's.
  const own = await gesture(harness, user, `${sg.id}/rename`, { name: 's g' });
  expect(own.status).toBe(200);
  const blank = await gesture(harness, user, `${sg.id}/rename`, { name: ' ' });
  expect(blank.status).toBe(400);
});

test('changing the type changes the Target of its Contacts, through the Organization', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean, organization: acme } = await memberOf(harness, user, 'Jean Dupont', {
    name: 'Acme',
    type: 'end_client',
  });

  const response = await gesture(harness, user, `${acme.id}/change-type`, { type: 'consultancy' });

  expect(response.status).toBe(200);
  const { changes } = changed.parse(await response.json());
  expect(changes.organizations).toEqual([{ ...acme, type: 'consultancy' }]);
  const summary = await summaryOf(harness, user);
  expect(summary.organizations).toEqual([{ ...acme, type: 'consultancy' }]);
  expect(summary.contacts).toEqual([jean]);
  const refused = await gesture(harness, user, `${acme.id}/change-type`, { type: 'unknown' });
  expect(refused.status).toBe(400);
});

test('merging moves the Contacts to the Organization that stays, then removes the other', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean, organization: typo } = await memberOf(harness, user, 'Jean Dupont', {
    name: 'Capgemni',
    type: 'end_client',
  });
  const julie = (await addContact(harness, user, 'Julie Martin', { organizationId: typo.id }))
    .contact;
  const { contact: paul, organization: capgemini } = await memberOf(harness, user, 'Paul Durand', {
    name: 'Capgemini',
    type: 'consultancy',
  });

  const response = await gesture(harness, user, `${typo.id}/merge`, { intoId: capgemini.id });

  expect(response.status).toBe(200);
  const { changes } = changed.parse(await response.json());
  expect(changes.contacts.map(({ id }) => id).toSorted()).toEqual([jean.id, julie.id].toSorted());
  expect(changes.contacts.every((moved) => moved.organizationId === capgemini.id)).toBe(true);
  expect(changes.organizations).toEqual([capgemini]);
  expect(changes.removedOrganizationIds).toEqual([typo.id]);
  const summary = await summaryOf(harness, user);
  expect(summary.organizations).toEqual([capgemini]);
  expect(summary.contacts.map(({ organizationId }) => organizationId)).toEqual([
    capgemini.id,
    capgemini.id,
    capgemini.id,
  ]);
  expect(summary.contacts.find(({ id }) => id === paul.id)).toEqual(paul);
});

test('a merge needs two Organizations of the User', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const other = await makeUser(harness);
  const { organization: acme } = await memberOf(harness, user, 'Jean Dupont', {
    name: 'Acme',
    type: 'end_client',
  });
  const { organization: elsewhere } = await memberOf(harness, other, 'Julie Martin', {
    name: 'Globex',
    type: 'end_client',
  });

  const itself = await gesture(harness, user, `${acme.id}/merge`, { intoId: acme.id });
  const foreign = await gesture(harness, user, `${acme.id}/merge`, { intoId: elsewhere.id });

  expect(itself.status).toBe(400);
  expect(await itself.json()).toEqual({ error: 'unknown_organization' });
  expect(foreign.status).toBe(400);
  expect(await foreign.json()).toEqual({ error: 'unknown_organization' });
  expect((await summaryOf(harness, user)).organizations).toEqual([acme]);
  expect((await summaryOf(harness, other)).organizations).toEqual([elsewhere]);
});

test('an Organization is deleted only once no Contact belongs to it', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { contact: jean, organization: acme } = await memberOf(harness, user, 'Jean Dupont', {
    name: 'Acme',
    type: 'end_client',
  });

  const refused = await gesture(harness, user, `${acme.id}/delete`);
  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ error: 'has_contacts' });

  // Its last Contact leaves it: it stays until it is deleted (CONTEXT.md, Organization).
  await editContact(harness, user, jean.id, { name: 'Jean Dupont' });
  expect((await summaryOf(harness, user)).organizations).toEqual([acme]);

  const response = await gesture(harness, user, `${acme.id}/delete`);

  expect(response.status).toBe(200);
  const { changes } = changed.parse(await response.json());
  expect(changes).toEqual({
    contacts: [],
    removedContactIds: [],
    organizations: [],
    removedOrganizationIds: [acme.id],
    positionings: [],
    removedPositioningIds: [],
    battles: [],
    removedBattleIds: [],
  });
  expect((await summaryOf(harness, user)).organizations).toEqual([]);
});

test.each(['rename', 'change-type', 'merge', 'delete'])(
  'an Organization nobody has answers 404: %s',
  async (path) => {
    const harness = testApp();
    const user = await makeUser(harness);
    const { organization: acme } = await memberOf(harness, user, 'Jean Dupont', {
      name: 'Acme',
      type: 'end_client',
    });
    const body = { name: 'Globex', type: 'consultancy', intoId: acme.id };

    for (const id of ['00000000-0000-7000-8000-000000000000', 'not-an-id']) {
      const response = await gesture(harness, user, `${id}/${path}`, body);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not_found' });
    }
  },
);

test('undoing the edit that moved a Contact to a merged Organization is refused', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const { organization: acme } = await memberOf(harness, user, 'Jean Dupont', {
    name: 'Acme',
    type: 'end_client',
  });
  const { contact: julie, organization: globex } = await memberOf(harness, user, 'Julie Martin', {
    name: 'Globex',
    type: 'end_client',
  });
  harness.clock.advance('PT1M');
  const { undoToken } = await editContact(harness, user, julie.id, {
    name: 'Julie Martin',
    organizationId: acme.id,
  });
  await gesture(harness, user, `${globex.id}/merge`, { intoId: acme.id });

  const refused = await undo(harness, user, undoToken);

  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ error: 'superseded' });
});
