import {
  normalizeEmail,
  normalizeLinkedInUrl,
  normalizeName,
  normalizePhone,
} from './normalize.ts';

/** The Organizations whose name holds what is typed, case, accents and spaces aside, in their order. */
export function organizationsMatching<O extends { name: string }>(
  typed: string,
  organizations: readonly O[],
): O[] {
  const wanted = normalizeName(typed);
  return organizations.filter((organization) => normalizeName(organization.name).includes(wanted));
}

/** What the duplicate checks read of a Contact. */
export type ContactIdentity = {
  id: string;
  name: string;
  organizationId: string | null;
  linkedinUrl: string | null;
  email: string | null;
  phone: string | null;
};

/** A Contact being added or edited: only its name is sure to be there. */
export type ContactCandidate = {
  /** When an existing Contact is edited: never a duplicate of itself. */
  id?: string;
  name: string;
  organizationId?: string | null;
  linkedinUrl?: string | null;
  email?: string | null;
  phone?: string | null;
};

/**
 * The Contacts a candidate may duplicate (spec UX §6.8, §6.12): the one with its LinkedIn profile,
 * which blocks; the ones with its name, the same Organization first, its e-mail or its phone, which
 * are only worth knowing. Each value counts when it is filled.
 */
export function findDuplicates<C extends ContactIdentity>(
  candidate: ContactCandidate,
  contacts: readonly C[],
) {
  const others = contacts.filter(({ id }) => id !== candidate.id);
  /** The others whose value, normalized, is the candidate's; none when it has none. */
  const sharing = (
    value: string | null | undefined,
    normalize: (value: string) => string | null,
    of: (contact: C) => string | null,
  ) => {
    const wanted = value ? normalize(value) : null;
    if (!wanted) return [];
    return others.filter((contact) => {
      const theirs = of(contact);
      return theirs !== null && normalize(theirs) === wanted;
    });
  };
  const organizationId = candidate.organizationId ?? null;
  const sameName = sharing(candidate.name, normalizeName, ({ name }) => name).toSorted(
    (a, b) =>
      Number(b.organizationId === organizationId) - Number(a.organizationId === organizationId),
  );
  return {
    sameLinkedIn: sharing(candidate.linkedinUrl, normalizeLinkedInUrl, (c) => c.linkedinUrl)[0],
    sameName,
    sameNameInOrganization:
      organizationId !== null && sameName.some((c) => c.organizationId === organizationId),
    sameEmail: sharing(candidate.email, normalizeEmail, ({ email }) => email),
    samePhone: sharing(candidate.phone, normalizePhone, ({ phone }) => phone),
  };
}
