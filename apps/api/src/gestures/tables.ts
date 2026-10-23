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
// oxlint-disable-next-line no-restricted-imports -- the kinds of the gestures on a Battle, which name no Contact.
import { BATTLE_GESTURE_KINDS } from '../battles/tables.ts';
// oxlint-disable-next-line no-restricted-imports -- the kinds of the workshop, which name no Contact.
import { POSITIONING_GESTURE_KINDS, STAGE_GESTURE_KINDS } from '../funnel/tables.ts';
// oxlint-disable-next-line no-restricted-imports -- a foreign key to the Contact a gesture touched, and its kinds.
import { CONTACT_GESTURE_KINDS, contact } from '../prospecting/tables.ts';

/** Every kind of gesture, each listed by the module of its subject (ADR 0011). */
const KINDS = [
  ...CONTACT_GESTURE_KINDS,
  ...POSITIONING_GESTURE_KINDS,
  ...BATTLE_GESTURE_KINDS,
  ...STAGE_GESTURE_KINDS,
] as const;

/** `kind in (…)`, for the kinds of one subject. */
const kindIn = (kinds: readonly string[]) =>
  sql.raw(`(${kinds.map((kind) => `'${kind}'`).join(', ')})`);

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
     * What it touched, a Contact, a Positioning, a Battle or a Stage: a later gesture on the same one
     * closes the way back. No foreign key but to the Contact: deleting a Positioning or a Stage is a
     * gesture “Undo” takes back.
     */
    contactId: uuid('contact_id'),
    positioningId: uuid('positioning_id'),
    battleId: uuid('battle_id'),
    stageId: uuid('stage_id'),
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
    check('gesture_kind_check', sql`${table.kind} in ${kindIn(KINDS)}`),
    // One subject, the one its kind names.
    check(
      'gesture_subject_check',
      sql`num_nonnulls(${table.contactId}, ${table.positioningId}, ${table.battleId}, ${table.stageId}) = 1 and (${table.contactId} is not null) = (${table.kind} in ${kindIn(CONTACT_GESTURE_KINDS)}) and (${table.positioningId} is not null) = (${table.kind} in ${kindIn(POSITIONING_GESTURE_KINDS)}) and (${table.stageId} is not null) = (${table.kind} in ${kindIn(STAGE_GESTURE_KINDS)})`,
    ),
    index('gesture_contact_idx').on(table.userId, table.contactId),
    index('gesture_positioning_idx').on(table.userId, table.positioningId),
    index('gesture_battle_idx').on(table.userId, table.battleId),
    index('gesture_stage_idx').on(table.userId, table.stageId),
  ],
);
