import {
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_TYPES,
  type OrganizationType,
} from '@battlecrm/contract';
import { normalizeName } from '@battlecrm/domain';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { RequireUser } from '../auth/index.ts';
import { violates, withUser, type Transaction } from '../db/index.ts';
import { touched, type ChangesOf } from '../gestures/index.ts';
import { jsonBody } from '../json-body.ts';
import { answerRefusal, refusal } from '../refusals.ts';
import { idOf } from '../route-id.ts';
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

/**
 * The Contacts of an Organization, which `prospecting` writes: handed to the gestures of the
 * Organization by the composition root, that imports both modules (spec stack §5.2).
 */
export type OrganizationMembers = {
  /** Whether a Contact belongs to it. */
  any: (tx: Transaction, userId: string, organizationId: string) => Promise<boolean>;
  /** Moves every Contact of one to the other; the ids of the Contacts moved. */
  move: (tx: Transaction, userId: string, fromId: string, toId: string) => Promise<string[]>;
};

/**
 * The ids among these that are Organizations of the User, locked until the transaction ends. Always in
 * the order of their ids: two merges of the same pair, either way round, never wait on each other.
 */
async function lockedOrganizations(tx: Transaction, userId: string, organizationIds: string[]) {
  const found = await tx
    .select({ id: organization.id })
    .from(organization)
    .where(and(eq(organization.userId, userId), inArray(organization.id, organizationIds)))
    .orderBy(organization.id)
    .for('update');
  return new Set(found.map(({ id }) => id));
}

/**
 * The gestures of an Organization (spec UX §5.4): rename, change the type, merge, delete. Each in one
 * transaction, confirmed beforehand by the User and never undone (spec UX §1); each answers with the
 * rows of the summary it changed.
 */
export function createOrganizations<Changes>({
  requireUser,
  changesOf,
  members,
}: {
  requireUser: RequireUser;
  changesOf: ChangesOf<Changes>;
  members: OrganizationMembers;
}) {
  const routes = new Hono<AppEnv>()
    // Unique by its normalized name (ST-30): its own, written another way, is fine.
    .post(
      '/organizations/:id/rename',
      requireUser,
      jsonBody(z.object({ name: z.string().trim().min(1).max(ORGANIZATION_NAME_MAX_LENGTH) })),
      async (c) => {
        const { userId } = c.var;
        const organizationId = idOf(c.req.param('id'));
        if (organizationId === null) return answerRefusal(c, refusal('not_found'));
        const { name } = c.req.valid('json');
        const outcome = await withUser(userId, async (tx) => {
          const [renamed] = await tx
            .update(organization)
            .set({ name, normalizedName: normalizeName(name) })
            .where(and(eq(organization.userId, userId), eq(organization.id, organizationId)))
            .returning({ id: organization.id });
          if (!renamed) return refusal('not_found');
          return {
            changes: await changesOf(tx, userId, touched({ organizationIds: [organizationId] })),
          };
        }).catch((error: unknown) => {
          if (violates(error, 'organization_normalized_name_unique')) {
            return refusal('organization_taken');
          }
          throw error;
        });
        if ('error' in outcome) return answerRefusal(c, outcome);
        return c.json(outcome, 200);
      },
    )
    // The Target of its Contacts follows; the Trials already started keep theirs (CONTEXT.md, Organization).
    .post(
      '/organizations/:id/change-type',
      requireUser,
      jsonBody(z.object({ type: z.enum(ORGANIZATION_TYPES) })),
      async (c) => {
        const { userId } = c.var;
        const organizationId = idOf(c.req.param('id'));
        if (organizationId === null) return answerRefusal(c, refusal('not_found'));
        const { type } = c.req.valid('json');
        const outcome = await withUser(userId, async (tx) => {
          const [changed] = await tx
            .update(organization)
            .set({ type })
            .where(and(eq(organization.userId, userId), eq(organization.id, organizationId)))
            .returning({ id: organization.id });
          if (!changed) return refusal('not_found');
          return {
            changes: await changesOf(tx, userId, touched({ organizationIds: [organizationId] })),
          };
        });
        if ('error' in outcome) return answerRefusal(c, outcome);
        return c.json(outcome, 200);
      },
    )
    // Two Organizations made twice become one (ST-31): its Contacts join the one that stays, and take its type.
    .post(
      '/organizations/:id/merge',
      requireUser,
      jsonBody(z.object({ intoId: z.uuid() })),
      async (c) => {
        const { userId } = c.var;
        const organizationId = idOf(c.req.param('id'));
        if (organizationId === null) return answerRefusal(c, refusal('not_found'));
        const { intoId } = c.req.valid('json');
        const outcome = await withUser(userId, async (tx) => {
          // Locked first: no Contact joins the one that goes while it goes.
          const locked = await lockedOrganizations(tx, userId, [organizationId, intoId]);
          if (!locked.has(organizationId)) return refusal('not_found');
          if (intoId === organizationId || !locked.has(intoId)) {
            return refusal('unknown_organization');
          }
          const moved = await members.move(tx, userId, organizationId, intoId);
          await deleteOrganization(tx, userId, organizationId);
          return {
            changes: await changesOf(
              tx,
              userId,
              touched({
                contactIds: moved,
                organizationIds: [intoId],
                removedOrganizationIds: [organizationId],
              }),
            ),
          };
        });
        if ('error' in outcome) return answerRefusal(c, outcome);
        return c.json(outcome, 200);
      },
    )
    // Never automatic, and only once no Contact belongs to it (CONTEXT.md, Organization).
    .post('/organizations/:id/delete', requireUser, async (c) => {
      const { userId } = c.var;
      const organizationId = idOf(c.req.param('id'));
      if (organizationId === null) return answerRefusal(c, refusal('not_found'));
      const outcome = await withUser(userId, async (tx) => {
        if (!(await lockedOrganizations(tx, userId, [organizationId])).has(organizationId)) {
          return refusal('not_found');
        }
        if (await members.any(tx, userId, organizationId)) return refusal('has_contacts');
        await deleteOrganization(tx, userId, organizationId);
        return {
          changes: await changesOf(
            tx,
            userId,
            touched({ removedOrganizationIds: [organizationId] }),
          ),
        };
      });
      if ('error' in outcome) return answerRefusal(c, outcome);
      return c.json(outcome, 200);
    });
  return { routes };
}
