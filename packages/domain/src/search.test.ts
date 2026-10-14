import { expect, test } from 'vitest';

import { contactsMatching, type SearchableContact } from './search.ts';

const CAPGEMINI = { id: 'o1', name: 'Capgemini' };

const contact = (fields: Partial<SearchableContact & { id: string }>) => ({
  id: 'c1',
  name: 'Jean Dupont',
  organizationId: null,
  jobTitle: null,
  email: null,
  ...fields,
});

test('a Contact is found by its name, its Organization, its job title or its e-mail', () => {
  const byName = contact({ id: 'c1', name: 'Hélène Durand' });
  const byOrganization = contact({ id: 'c2', name: 'Julie Martin', organizationId: 'o1' });
  const byJobTitle = contact({ id: 'c3', name: 'Paul Roux', jobTitle: 'Business manager' });
  const byEmail = contact({ id: 'c4', name: 'Inès Moreau', email: 'ines@nordika.io' });
  const contacts = [byName, byOrganization, byJobTitle, byEmail];

  expect(contactsMatching('helene', contacts, [CAPGEMINI])).toEqual([byName]);
  expect(contactsMatching('CAP gem', contacts, [CAPGEMINI])).toEqual([byOrganization]);
  expect(contactsMatching('business', contacts, [CAPGEMINI])).toEqual([byJobTitle]);
  expect(contactsMatching('nordika', contacts, [CAPGEMINI])).toEqual([byEmail]);
});

test('nothing typed finds them all, in their order; nothing found finds none', () => {
  const contacts = [contact({ id: 'c2' }), contact({ id: 'c1' })];

  expect(contactsMatching('  ', contacts, [])).toEqual(contacts);
  expect(contactsMatching('zz', contacts, [])).toEqual([]);
});

test('an Organization the summary does not know yet matches nothing', () => {
  const orphan = contact({ organizationId: 'o9' });

  expect(contactsMatching('capgemini', [orphan], [CAPGEMINI])).toEqual([]);
});
