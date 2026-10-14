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
// oxlint-disable-next-line no-restricted-imports -- a foreign key to the Contact a gesture touched.
import { contact } from '../prospecting/tables.ts';

/** Every gesture “Undo” can take back; a new gesture adds its kind here, next to its inverse (ADR 0011). */
export const GESTURE_KINDS = [
  'contact_added',
  'contact_edited',
  'status_changed',
  'follow_up_scheduled',
  'follow_up_canceled',
  'followed_up',
] as const;

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
    kind: text({ enum: GESTURE_KINDS }).notNull(),
    /** The Contact it touched: a later gesture on the same one closes the way back. */
    contactId: uuid('contact_id').notNull(),
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
      sql`${table.kind} in (${sql.raw(GESTURE_KINDS.map((kind) => `'${kind}'`).join(', '))})`,
    ),
    index('gesture_contact_idx').on(table.userId, table.contactId),
  ],
);
