import { normalizeName } from './normalize.ts';

/** What the search of the Contacts screen reads of a Contact (ST-63). */
export type SearchableContact = {
  name: string;
  organizationId: string | null;
  jobTitle: string | null;
  email: string | null;
};

/**
 * The Contacts whose name, Organization, job title or e-mail holds what is typed, case, accents and
 * spaces aside, in their order (spec UX §5.10).
 */
export function contactsMatching<C extends SearchableContact>(
  typed: string,
  contacts: readonly C[],
  organizations: readonly { id: string; name: string }[],
): C[] {
  const wanted = normalizeName(typed);
  const names = new Map(organizations.map(({ id, name }) => [id, name]));
  return contacts.filter((contact) =>
    [
      contact.name,
      contact.organizationId === null ? undefined : names.get(contact.organizationId),
      contact.jobTitle,
      contact.email,
    ].some((value) => value != null && normalizeName(value).includes(wanted)),
  );
}
