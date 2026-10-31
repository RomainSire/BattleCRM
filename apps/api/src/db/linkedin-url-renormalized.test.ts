import { readFile } from 'node:fs/promises';

import { normalizeLinkedInUrl } from '@battlecrm/domain';
import { eq } from 'drizzle-orm';
import { Client } from 'pg';
import { expect, inject, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { addContact } from '../../test/factories/contact.ts';
import { makeUser } from '../../test/factories/user.ts';
import { ownerUrl } from '../../test/postgres.ts';
import { contact } from '../prospecting/index.ts';
import { withUser } from './index.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

/** Runs migration 0047 again, as the migrator does, on the Contacts stored so far; what it warned. */
async function renormalize(): Promise<string[]> {
  const sql = await readFile(
    new URL('../../drizzle/0047_linkedin_url_renormalized.sql', import.meta.url),
    'utf8',
  );
  const database = new URL(inject('databaseUrl')).pathname.slice(1);
  const client = new Client({ connectionString: ownerUrl(database) });
  const warnings: string[] = [];
  client.on('notice', (notice) => {
    if (notice.severity === 'WARNING') warnings.push(notice.message ?? '');
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
  return warnings;
}

/** A Contact whose LinkedIn URL was stored by the previous `normalizeLinkedInUrl`, as it wrote it. */
async function storedAs(harness: Harness, user: User, linkedinUrl: string): Promise<string> {
  const { contact: added } = await addContact(harness, user, 'Jean Dupont');
  await withUser(user.userId, (tx) =>
    tx.update(contact).set({ linkedinUrl }).where(eq(contact.id, added.id)),
  );
  return added.id;
}

const linkedinUrlOf = async (user: User, contactId: string) =>
  (
    await withUser(user.userId, (tx) =>
      tx
        .select({ linkedinUrl: contact.linkedinUrl })
        .from(contact)
        .where(eq(contact.id, contactId)),
    )
  )[0]?.linkedinUrl;

test('stored URLs are normalized again, as normalizeLinkedInUrl now writes them (ST-93)', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const stored = [
    'https://linkedin.com/in/fa%c3%afza-b',
    'https://linkedin.com/in/fa%C3%AFza-c',
    'https://linkedin.com/in/be%cc%81ne%cc%81',
    'https://linkedin.com/in/jean-dupont/overlay/contact-info',
    'https://linkedin.com/in/marie-curie/details/experience',
    'https://linkedin.com/in/pierre/fr',
    'https://linkedin.com/in/jean%20martin',
    'https://linkedin.com/in/jean%zz',
    'https://linkedin.com/in/jean%c3',
    'https://linkedin.com/in/jean%25',
    'https://linkedin.com/in/jean%2fdupont',
    'https://linkedin.com/in/jean%00',
    'https://linkedin.com/in/%C3%89lodie',
    'https://linkedin.com/in/jean%c2%a0martin',
    'https://linkedin.com/in/jean%ef%bb%bf',
    'https://linkedin.com/company/soci%c3%a9t%c3%a9/about',
    'https://linkedin.com/in/already-normalized',
    'https://linkedin.com',
  ];
  const ids = await Promise.all(stored.map((url) => storedAs(harness, user, url)));

  expect(await renormalize()).toEqual([]);

  const renormalized = await Promise.all(ids.map((id) => linkedinUrlOf(user, id)));
  expect(renormalized.slice(0, 6)).toEqual([
    'https://linkedin.com/in/faïza-b',
    'https://linkedin.com/in/faïza-c',
    'https://linkedin.com/in/béné',
    'https://linkedin.com/in/jean-dupont',
    'https://linkedin.com/in/marie-curie',
    'https://linkedin.com/in/pierre',
  ]);
  // The SPA, the API and the extension compare a URL just read with the stored one: they must agree.
  expect(renormalized).toEqual(stored.map(normalizeLinkedInUrl));
});

test('two Contacts that would share a URL are left as they were, and named in a warning (ST-93)', async () => {
  const harness = testApp();
  const user = await makeUser(harness);
  const other = await makeUser(harness);
  const encoded = await storedAs(harness, user, 'https://linkedin.com/in/h%c3%a9l%c3%a8ne');
  const accented = await storedAs(harness, user, 'https://linkedin.com/in/hélène/fr');
  const ofOther = await storedAs(harness, other, 'https://linkedin.com/in/h%c3%a9l%c3%a8ne');

  const warnings = await renormalize();

  expect(await linkedinUrlOf(user, encoded)).toBe('https://linkedin.com/in/h%c3%a9l%c3%a8ne');
  expect(await linkedinUrlOf(user, accented)).toBe('https://linkedin.com/in/hélène/fr');
  // Another User's Contact is no duplicate.
  expect(await linkedinUrlOf(other, ofOther)).toBe('https://linkedin.com/in/hélène');
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain(encoded);
  expect(warnings[0]).toContain(accented);
  expect(warnings[0]).toContain(user.userId);
  expect(warnings[0]).toContain('https://linkedin.com/in/hélène');
});
