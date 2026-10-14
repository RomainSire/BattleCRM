import type { OrganizationType } from '@battlecrm/contract';
import { normalizeName } from '@battlecrm/domain';
import { and, eq } from 'drizzle-orm';

import type { Transaction } from '../db/index.ts';
import { organization } from './tables.ts';

// Read by `views`, which never writes it.
export { organization } from './tables.ts';

/**
 * A new Organization of the User, its name normalized for the unique index (ST-30). `null` when the
 * User already has one by that name, case, accents and spaces aside.
 */
export async function createOrganization(
  tx: Transaction,
  userId: string,
  { name, type }: { name: string; type: OrganizationType },
): Promise<string | null> {
  const [created] = await tx
    .insert(organization)
    .values({ userId, name, normalizedName: normalizeName(name), type })
    .onConflictDoNothing({ target: [organization.userId, organization.normalizedName] })
    .returning({ id: organization.id });
  return created?.id ?? null;
}

/** Whether the Organization is one of the User's. */
export async function isOrganizationOf(
  tx: Transaction,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const [found] = await tx
    .select({ id: organization.id })
    .from(organization)
    .where(and(eq(organization.userId, userId), eq(organization.id, organizationId)));
  return found !== undefined;
}

/** Deletes an Organization no Contact belongs to: the caller, who knows the Contacts, makes sure of it. */
export async function deleteOrganization(
  tx: Transaction,
  userId: string,
  organizationId: string,
): Promise<void> {
  await tx
    .delete(organization)
    .where(and(eq(organization.userId, userId), eq(organization.id, organizationId)));
}
