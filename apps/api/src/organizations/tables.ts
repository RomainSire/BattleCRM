import { ORGANIZATION_TYPES } from '@battlecrm/contract';
import { sql } from 'drizzle-orm';
import { check, pgTable, text, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// oxlint-disable-next-line no-restricted-imports -- a foreign key to the User: tables files reference each other directly, drizzle-kit loads them alone.
import { user } from '../auth/tables.ts';

/**
 * The company a Contact works for. Its type sets the Target of its Contacts. Two Organizations of a
 * User never share a name, case, accents and spaces aside (ST-30): `packages/domain` normalizes it,
 * a unique index holds it.
 */
export const organization = pgTable(
  'organization',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** As the User wrote it. */
    name: text().notNull(),
    /** `normalizeName(name)`, written with it. */
    normalizedName: text('normalized_name').notNull(),
    type: text({ enum: ORGANIZATION_TYPES }).notNull(),
  },
  (table) => [
    unique('organization_user_id_id_unique').on(table.userId, table.id),
    uniqueIndex('organization_normalized_name_unique').on(table.userId, table.normalizedName),
    check('organization_name_check', sql`${table.name} <> ''`),
    check('organization_normalized_name_check', sql`${table.normalizedName} <> ''`),
    check(
      'organization_type_check',
      sql`${table.type} in (${sql.raw(ORGANIZATION_TYPES.map((type) => `'${type}'`).join(', '))})`,
    ),
  ],
);
