/** The type of an Organization (CONTEXT.md): a consultancy (ESN) or an end client. */
export type OrganizationType = 'consultancy' | 'end_client';

/** The Target of a Contact (CONTEXT.md): the type of its Organization, unknown without one. */
export type Target = OrganizationType | 'unknown';

export const targetOf = (organization: { type: OrganizationType } | undefined): Target =>
  organization?.type ?? 'unknown';
