import type { CONTACT_STATUSES } from '@battlecrm/contract';
import { and, eq, isNull } from 'drizzle-orm';

import type { GestureSubject } from '../gestures/index.ts';
import { contact } from './tables.ts';

/** Where a Contact is: its Status, and its Stage (or the last one it reached). */
export type ContactPlace = { status: (typeof CONTACT_STATUSES)[number]; stageId: string | null };

/** A Contact of the User, unless it was deleted (ADR 0006): no gesture reaches it any more. */
export const presentContact = (userId: string, contactId: string) =>
  and(eq(contact.userId, userId), eq(contact.id, contactId), isNull(contact.anonymizedAt));

/** The Contact a gesture acts on, as it reads it once locked: where it is. */
export const contactSubject: GestureSubject<ContactPlace> = {
  column: 'contactId',
  async load(tx, userId, contactId) {
    const [found] = await tx
      .select({ status: contact.status, stageId: contact.stageId })
      .from(contact)
      .where(presentContact(userId, contactId));
    return found;
  },
};
