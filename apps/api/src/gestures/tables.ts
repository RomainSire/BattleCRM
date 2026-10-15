import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// oxlint-disable-next-line no-restricted-imports -- a foreign key to the User: tables files reference each other directly, drizzle-kit loads them alone.
import { user } from '../auth/tables.ts';
// oxlint-disable-next-line no-restricted-imports -- the kinds of the workshop, which name no Contact.
import { POSITIONING_GESTURE_KINDS } from '../funnel/tables.ts';
// oxlint-disable-next-line no-restricted-imports -- a foreign key to the Contact a gesture touched, and its kinds.
import { CONTACT_GESTURE_KINDS, contact } from '../prospecting/tables.ts';

/** Every kind of gesture, each listed by the module of its subject (ADR 0011). */
const KINDS = [...CONTACT_GESTURE_KINDS, ...POSITIONING_GESTURE_KINDS] as const;

/** What “Undo” needs to take a gesture back (ADR 0011). A row lives 15 minutes at most, or until it is undone. */
export const gesture = pgTable(
  'gesture',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text({ enum: KINDS }).notNull(),
    /**
     * What it touched, a Contact or a Positioning: a later gesture on the same one closes the way back.
     * No foreign key to the Positioning: deleting one is a gesture “Undo” takes back.
     */
    contactId: uuid('contact_id'),
    positioningId: uuid('positioning_id'),
    /** What the inverse of this kind needs, written and read by its module alone. */
    payload: jsonb().notNull(),
    performedAt: timestamp('performed_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    unique('gesture_user_id_id_unique').on(table.userId, table.id),
    foreignKey({
      name: 'gesture_contact_fk',
      columns: [table.userId, table.contactId],
      foreignColumns: [contact.userId, contact.id],
    }).onDelete('cascade'),
    check(
      'gesture_kind_check',
      sql`${table.kind} in (${sql.raw(KINDS.map((kind) => `'${kind}'`).join(', '))})`,
    ),
    check(
      'gesture_subject_check',
      sql`(${table.contactId} is null) = (${table.kind} in (${sql.raw(POSITIONING_GESTURE_KINDS.map((kind) => `'${kind}'`).join(', '))})) and (${table.positioningId} is null) <> (${table.contactId} is null)`,
    ),
    index('gesture_contact_idx').on(table.userId, table.contactId),
    index('gesture_positioning_idx').on(table.userId, table.positioningId),
  ],
);
