import { CONTACT_STATUSES } from '@battlecrm/contract';
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// oxlint-disable-next-line no-restricted-imports -- a foreign key to the User: tables files reference each other directly, drizzle-kit loads them alone.
import { user } from '../auth/tables.ts';

// What every business table carries (spec stack §6): an id from the database, the User it belongs to under
// forced row level security, `(user_id, id)` unique so that a foreign key can never reach another User's row,
// NOT NULL unless said otherwise, a CHECK on each enumeration, and instants written from the clock of the app.

const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`);
const userId = () =>
  uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' });
const instant = (name: string) => timestamp(name, { withTimezone: true });
const quoted = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(', '));

export const contact = pgTable(
  'contact',
  {
    id: id(),
    userId: userId(),
    /** The only field a Contact must have. */
    name: text().notNull(),
    status: text({ enum: CONTACT_STATUSES }).notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (table) => [
    unique('contact_user_id_id_unique').on(table.userId, table.id),
    check('contact_status_check', sql`${table.status} in (${quoted(CONTACT_STATUSES)})`),
    check('contact_name_check', sql`${table.name} <> ''`),
  ],
);

/** What an Interaction records; each gesture that writes one adds its kind here. */
export const INTERACTION_KINDS = ['contact_added'] as const;
/** Adding a Contact, like a change of Stage or of Status, is neither outbound nor inbound. */
export const INTERACTION_DIRECTIONS = ['outbound', 'inbound', 'none'] as const;

export const interaction = pgTable(
  'interaction',
  {
    id: id(),
    userId: userId(),
    contactId: uuid('contact_id').notNull(),
    kind: text({ enum: INTERACTION_KINDS }).notNull(),
    direction: text({ enum: INTERACTION_DIRECTIONS }).notNull(),
    /** When it happened, which may come before it was written down (ST-36). */
    occurredAt: instant('occurred_at').notNull(),
    /** The local day of `occurredAt`, in the time zone in effect when it was written. */
    localDate: date('local_date').notNull(),
    recordedAt: instant('recorded_at').notNull(),
  },
  (table) => [
    unique('interaction_user_id_id_unique').on(table.userId, table.id),
    foreignKey({
      name: 'interaction_contact_fk',
      columns: [table.userId, table.contactId],
      foreignColumns: [contact.userId, contact.id],
    }),
    check('interaction_kind_check', sql`${table.kind} in (${quoted(INTERACTION_KINDS)})`),
    check(
      'interaction_direction_check',
      sql`${table.direction} in (${quoted(INTERACTION_DIRECTIONS)})`,
    ),
    index('interaction_contact_idx').on(table.userId, table.contactId, table.occurredAt),
  ],
);
