import { expect, test } from 'vitest';

import { findDuplicates, organizationsMatching } from './duplicates.ts';

const CAPGEMINI = { id: 'o1', name: 'Capgemini' };
const SOPRA = { id: 'o2', name: 'Sopra Steria' };

const contact = (fields: Partial<Parameters<typeof findDuplicates>[1][number]>) => ({
  id: 'c1',
  name: 'Jean Dupont',
  organizationId: null,
  linkedinUrl: null,
  email: null,
  phone: null,
  ...fields,
});

test('an Organization is found as it is typed, case, accents and spaces aside', () => {
  const organizations = [CAPGEMINI, SOPRA, { id: 'o3', name: 'Société Générale' }];

  expect(organizationsMatching('cap', organizations)).toEqual([CAPGEMINI]);
  expect(organizationsMatching('SOCIETE gen', organizations).map(({ id }) => id)).toEqual(['o3']);
  expect(organizationsMatching('  ', organizations)).toEqual(organizations);
  expect(organizationsMatching('ra st', organizations)).toEqual([SOPRA]);
});

test('the same LinkedIn profile is a duplicate, however its address is written', () => {
  const jean = contact({ linkedinUrl: 'https://linkedin.com/in/jean-dupont' });

  const found = findDuplicates(
    { name: 'J. Dupont', linkedinUrl: 'www.linkedin.com/in/jean-dupont/?trk=x' },
    [jean],
  );

  expect(found.sameLinkedIn).toBe(jean);
});

test('the same name, e-mail or phone is only worth knowing, each when it is filled', () => {
  const jean = contact({ email: 'jean@example.com', phone: '06 12 34 56 78' });
  const other = contact({ id: 'c2', name: 'Julie Martin' });

  const found = findDuplicates(
    { name: 'jean  DUPONT', email: 'JEAN@example.com ', phone: '06.12.34.56.78' },
    [jean, other],
  );

  expect(found).toEqual({
    sameLinkedIn: undefined,
    sameName: [jean],
    sameNameInOrganization: false,
    sameEmail: [jean],
    samePhone: [jean],
  });
  expect(findDuplicates({ name: 'Paul', email: '', phone: '' }, [contact({})])).toMatchObject({
    sameName: [],
    sameEmail: [],
    samePhone: [],
  });
});

test('the same name in the same Organization says more', () => {
  const atCapgemini = contact({ organizationId: CAPGEMINI.id });
  const atSopra = contact({ id: 'c2', organizationId: SOPRA.id });

  const found = findDuplicates({ name: 'Jean Dupont', organizationId: CAPGEMINI.id }, [
    atSopra,
    atCapgemini,
  ]);

  expect(found.sameName).toEqual([atCapgemini, atSopra]);
  expect(found.sameNameInOrganization).toBe(true);
});

test('a Contact is no duplicate of itself, and a blank or unreadable value matches nothing', () => {
  const jean = contact({ linkedinUrl: 'https://linkedin.com/in/jean-dupont' });

  expect(
    findDuplicates({ id: jean.id, name: jean.name, linkedinUrl: jean.linkedinUrl }, [jean]),
  ).toMatchObject({ sameLinkedIn: undefined, sameName: [] });
  expect(findDuplicates({ name: '  ', linkedinUrl: 'jean dupont' }, [jean])).toMatchObject({
    sameLinkedIn: undefined,
    sameName: [],
  });
});
