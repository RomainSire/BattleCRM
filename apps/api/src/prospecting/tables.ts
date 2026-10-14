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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// oxlint-disable-next-line no-restricted-imports -- a foreign key to the User: tables files reference each other directly, drizzle-kit loads them alone.
import { user } from '../auth/tables.ts';
// oxlint-disable-next-line no-restricted-imports -- a foreign key to the Stage of a Contact: tables files reference each other directly, drizzle-kit loads them alone.
import { stage } from '../funnel/tables.ts';
// oxlint-disable-next-line no-restricted-imports -- a foreign key to the Organization of a Contact: tables files reference each other directly, drizzle-kit loads them alone.
import { organization } from '../organizations/tables.ts';

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
    /**
     * The Stage it is at, Prospecting; in any other Status, the last one it reached, if it ever
     * reached one, archived or not: where it left the Funnel.
     */
    stageId: uuid('stage_id'),
    /** None: its Target is unknown. */
    organizationId: uuid('organization_id'),
    jobTitle: text('job_title'),
    email: text(),
    phone: text(),
    /** Its LinkedIn profile, as `normalizeLinkedInUrl` writes it: what identifies it (ST-30). */
    linkedinUrl: text('linkedin_url'),
    /** The lasting context of the Contact, apart from the notes of its Interactions. */
    note: text(),
    createdAt: instant('created_at').notNull(),
  },
  (table) => [
    unique('contact_user_id_id_unique').on(table.userId, table.id),
    // Several Contacts without a profile are fine: NULLs are never equal.
    uniqueIndex('contact_linkedin_url_unique').on(table.userId, table.linkedinUrl),
    foreignKey({
      name: 'contact_stage_fk',
      columns: [table.userId, table.stageId],
      foreignColumns: [stage.userId, stage.id],
    }),
    foreignKey({
      name: 'contact_organization_fk',
      columns: [table.userId, table.organizationId],
      foreignColumns: [organization.userId, organization.id],
    }),
    index('contact_organization_idx').on(table.userId, table.organizationId),
    check('contact_status_check', sql`${table.status} in (${quoted(CONTACT_STATUSES)})`),
    check('contact_name_check', sql`${table.name} <> ''`),
    check('contact_job_title_check', sql`${table.jobTitle} <> ''`),
    check('contact_email_check', sql`${table.email} <> ''`),
    check('contact_phone_check', sql`${table.phone} <> ''`),
    check('contact_linkedin_url_check', sql`${table.linkedinUrl} <> ''`),
    check('contact_note_check', sql`${table.note} <> ''`),
    check(
      'contact_prospecting_stage_check',
      sql`${table.status} <> 'prospecting' or ${table.stageId} is not null`,
    ),
  ],
);

/** What an Interaction records; each gesture that writes one adds its kind here. */
export const INTERACTION_KINDS = ['contact_added', 'status_changed', 'follow_up'] as const;
/** The kinds that are Prospecting actions, what the Activity counts (CONTEXT.md). */
export const PROSPECTING_ACTION_KINDS = [
  'follow_up',
] as const satisfies readonly (typeof INTERACTION_KINDS)[number][];
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
    /** What the User wrote of it, if anything: a done Follow-up keeps the note it had. */
    note: text(),
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
    check('interaction_note_check', sql`${table.note} <> ''`),
  ],
);

/** Scheduled, then done or canceled (CONTEXT.md, Follow-up). */
export const FOLLOW_UP_STATUSES = ['scheduled', 'done', 'canceled'] as const;

/**
 * A Follow-up of a Contact (CONTEXT.md): an outbound Interaction scheduled for a local day, at most one
 * scheduled per Contact. Done, it points to the Interaction it became; it never references a Positioning.
 */
export const followUp = pgTable(
  'follow_up',
  {
    id: id(),
    userId: userId(),
    contactId: uuid('contact_id').notNull(),
    status: text({ enum: FOLLOW_UP_STATUSES }).notNull(),
    /** The local day it is scheduled for: overdue once past, never moved by the app itself. */
    dueOn: date('due_on').notNull(),
    /** Why to follow up, what was said; optional. */
    note: text(),
    /** The Interaction it became, once done. */
    interactionId: uuid('interaction_id'),
    scheduledAt: instant('scheduled_at').notNull(),
  },
  (table) => [
    unique('follow_up_user_id_id_unique').on(table.userId, table.id),
    foreignKey({
      name: 'follow_up_contact_fk',
      columns: [table.userId, table.contactId],
      foreignColumns: [contact.userId, contact.id],
    }),
    foreignKey({
      name: 'follow_up_interaction_fk',
      columns: [table.userId, table.interactionId],
      foreignColumns: [interaction.userId, interaction.id],
    }),
    // At most one scheduled per Contact (spec stack §6).
    uniqueIndex('follow_up_scheduled_unique')
      .on(table.userId, table.contactId)
      .where(sql`${table.status} = 'scheduled'`),
    check('follow_up_status_check', sql`${table.status} in (${quoted(FOLLOW_UP_STATUSES)})`),
    check(
      'follow_up_done_check',
      sql`(${table.status} = 'done') = (${table.interactionId} is not null)`,
    ),
    check('follow_up_note_check', sql`${table.note} <> ''`),
  ],
);

/**
 * The history of the Status of a Contact (ST-39), each change recorded by an Interaction of its own,
 * dated when it is written down and never earlier: its gesture writes that Interaction from the clock
 * of the app, never one the User dated. A change to Prospecting is a Funnel entry; the first Status
 * of a Contact is a change from none.
 */
export const statusChange = pgTable(
  'status_change',
  {
    id: id(),
    userId: userId(),
    contactId: uuid('contact_id').notNull(),
    /** Its date and local day, from the clock of the app. */
    interactionId: uuid('interaction_id').notNull(),
    /** None when the Contact was added in the Status it changed to. */
    fromStatus: text('from_status', { enum: CONTACT_STATUSES }),
    toStatus: text('to_status', { enum: CONTACT_STATUSES }).notNull(),
    /** The Stage of the Contact then: the one it enters, or the last one it reached. */
    stageId: uuid('stage_id'),
    /** Optional, in the words of the User. */
    reason: text(),
  },
  (table) => [
    unique('status_change_user_id_id_unique').on(table.userId, table.id),
    unique('status_change_interaction_unique').on(table.userId, table.interactionId),
    foreignKey({
      name: 'status_change_contact_fk',
      columns: [table.userId, table.contactId],
      foreignColumns: [contact.userId, contact.id],
    }),
    foreignKey({
      name: 'status_change_interaction_fk',
      columns: [table.userId, table.interactionId],
      foreignColumns: [interaction.userId, interaction.id],
    }),
    foreignKey({
      name: 'status_change_stage_fk',
      columns: [table.userId, table.stageId],
      foreignColumns: [stage.userId, stage.id],
    }),
    check(
      'status_change_from_status_check',
      sql`${table.fromStatus} in (${quoted(CONTACT_STATUSES)})`,
    ),
    check('status_change_to_status_check', sql`${table.toStatus} in (${quoted(CONTACT_STATUSES)})`),
    check(
      'status_change_change_check',
      sql`${table.fromStatus} is distinct from ${table.toStatus}`,
    ),
    check(
      'status_change_prospecting_stage_check',
      sql`${table.toStatus} <> 'prospecting' or ${table.stageId} is not null`,
    ),
    check('status_change_reason_check', sql`${table.reason} <> ''`),
    index('status_change_contact_idx').on(table.userId, table.contactId),
  ],
);
