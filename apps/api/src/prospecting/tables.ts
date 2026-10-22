import {
  CHANNELS,
  CONTACT_STATUSES,
  NOTED_INTERACTION_KINDS,
  TARGETS,
  TRIAL_OUTCOMES,
} from '@battlecrm/contract';
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
  integer,
  boolean,
  uuid,
} from 'drizzle-orm/pg-core';

// oxlint-disable-next-line no-restricted-imports -- a foreign key to the User: tables files reference each other directly, drizzle-kit loads them alone.
import { user } from '../auth/tables.ts';
// oxlint-disable-next-line no-restricted-imports -- foreign keys to the Battle of an Assignment or of a Trial: tables files reference each other directly, drizzle-kit loads them alone.
import { battle } from '../battles/tables.ts';
// oxlint-disable-next-line no-restricted-imports -- foreign keys to the Stage of a Contact and to the Positioning an Interaction used: tables files reference each other directly, drizzle-kit loads them alone.
import { positioning, stage } from '../funnel/tables.ts';
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
export const INTERACTION_KINDS = [
  'contact_added',
  'status_changed',
  'stage_changed',
  'follow_up',
  ...NOTED_INTERACTION_KINDS,
  'reply',
  'positioning_used',
] as const;
/** The kinds that are Prospecting actions, what the Activity counts (CONTEXT.md). */
export const PROSPECTING_ACTION_KINDS = [
  'follow_up',
  'positioning_used',
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
    /** The Channel a reply came by; none for any other kind. */
    channel: text({ enum: CHANNELS }),
    /** The Positioning a use sent, which can then no longer be deleted; none for any other kind. */
    positioningId: uuid('positioning_id'),
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
    check('interaction_channel_check', sql`${table.channel} in (${quoted(CHANNELS)})`),
    check(
      'interaction_reply_channel_check',
      sql`(${table.kind} = 'reply') = (${table.channel} is not null)`,
    ),
    foreignKey({
      name: 'interaction_positioning_fk',
      columns: [table.userId, table.positioningId],
      foreignColumns: [positioning.userId, positioning.id],
    }),
    check(
      'interaction_positioning_check',
      sql`(${table.kind} = 'positioning_used') = (${table.positioningId} is not null)`,
    ),
    index('interaction_positioning_idx').on(table.userId, table.positioningId),
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
    /** Its rank in the Cadence of the last Positioning used, from 1; none off the Cadence. */
    rank: integer(),
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
    check('follow_up_rank_check', sql`${table.rank} > 0`),
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

/**
 * The history of the Stage of a Contact Prospecting (ST-33), each change recorded by an Interaction of
 * its own, neither outbound nor inbound, dated from the clock of the app. It keeps the positions of
 * both Stages in the Funnel of the moment: reordering never turns a step forward into a step back
 * (ADR 0003).
 */
export const stageChange = pgTable(
  'stage_change',
  {
    id: id(),
    userId: userId(),
    contactId: uuid('contact_id').notNull(),
    /** Its date and local day, from the clock of the app. */
    interactionId: uuid('interaction_id').notNull(),
    fromStageId: uuid('from_stage_id').notNull(),
    toStageId: uuid('to_stage_id').notNull(),
    /** The places of both Stages in the Funnel then, from 0. */
    fromPosition: integer('from_position').notNull(),
    toPosition: integer('to_position').notNull(),
  },
  (table) => [
    unique('stage_change_user_id_id_unique').on(table.userId, table.id),
    unique('stage_change_interaction_unique').on(table.userId, table.interactionId),
    foreignKey({
      name: 'stage_change_contact_fk',
      columns: [table.userId, table.contactId],
      foreignColumns: [contact.userId, contact.id],
    }),
    foreignKey({
      name: 'stage_change_interaction_fk',
      columns: [table.userId, table.interactionId],
      foreignColumns: [interaction.userId, interaction.id],
    }),
    foreignKey({
      name: 'stage_change_from_stage_fk',
      columns: [table.userId, table.fromStageId],
      foreignColumns: [stage.userId, stage.id],
    }),
    foreignKey({
      name: 'stage_change_to_stage_fk',
      columns: [table.userId, table.toStageId],
      foreignColumns: [stage.userId, stage.id],
    }),
    check('stage_change_change_check', sql`${table.fromStageId} <> ${table.toStageId}`),
    check(
      'stage_change_position_check',
      sql`${table.fromPosition} >= 0 and ${table.toPosition} >= 0 and ${table.fromPosition} <> ${table.toPosition}`,
    ),
    index('stage_change_contact_idx').on(table.userId, table.contactId),
  ],
);

/**
 * The Assignment of a Contact (CONTEXT.md, ADR 0002): the Positioning the open Battle of its Stage
 * drew for it, once revealed, never drawn again. It stands as long as the Battle is open and the
 * Contact stays Prospecting at that Stage, and falls otherwise; it survives “Undo” (ADR 0011). At most
 * one per Contact: a Contact is at one Stage, which has at most one open Battle.
 */
export const assignment = pgTable(
  'assignment',
  {
    id: id(),
    userId: userId(),
    contactId: uuid('contact_id').notNull(),
    battleId: uuid('battle_id').notNull(),
    positioningId: uuid('positioning_id').notNull(),
    /** The Target of the Contact when it was drawn: what it is balanced among, a change of Target aside. */
    target: text({ enum: TARGETS }).notNull(),
    assignedAt: instant('assigned_at').notNull(),
  },
  (table) => [
    unique('assignment_user_id_id_unique').on(table.userId, table.id),
    uniqueIndex('assignment_contact_unique').on(table.userId, table.contactId),
    foreignKey({
      name: 'assignment_contact_fk',
      columns: [table.userId, table.contactId],
      foreignColumns: [contact.userId, contact.id],
    }),
    foreignKey({
      name: 'assignment_battle_fk',
      columns: [table.userId, table.battleId],
      foreignColumns: [battle.userId, battle.id],
    }),
    foreignKey({
      name: 'assignment_positioning_fk',
      columns: [table.userId, table.positioningId],
      foreignColumns: [positioning.userId, positioning.id],
    }),
    check('assignment_target_check', sql`${table.target} in (${quoted(TARGETS)})`),
    index('assignment_battle_idx').on(table.userId, table.battleId),
  ],
);

/**
 * A Trial (CONTEXT.md): a Contact exposed to a Positioning within a Battle, from the use that
 * recorded it, on its day. At most one in progress per Contact, never two in the same Battle but
 * for a canceled one, which is not counted.
 */
export const trial = pgTable(
  'trial',
  {
    id: id(),
    userId: userId(),
    contactId: uuid('contact_id').notNull(),
    battleId: uuid('battle_id').notNull(),
    positioningId: uuid('positioning_id').notNull(),
    /** The use of the Positioning that started it: its day is the day the Trial started. */
    interactionId: uuid('interaction_id').notNull(),
    /** The Target of the Contact when it started, kept whatever changes since. */
    target: text({ enum: TARGETS }).notNull(),
    /** Whether the Positioning used is not the one assigned: an Override, allowed and traced. */
    overridden: boolean().notNull(),
    /** Why, in the words of the User, if it said. */
    overrideReason: text('override_reason'),
    outcome: text({ enum: TRIAL_OUTCOMES }).notNull(),
    /** Why it was canceled (“Battle closed”, “Contact deleted”, the User's own). */
    cancelReason: text('cancel_reason'),
    /** When the User settled it, from the clock of the app; none while in progress. */
    settledAt: instant('settled_at'),
  },
  (table) => [
    unique('trial_user_id_id_unique').on(table.userId, table.id),
    unique('trial_interaction_unique').on(table.userId, table.interactionId),
    foreignKey({
      name: 'trial_contact_fk',
      columns: [table.userId, table.contactId],
      foreignColumns: [contact.userId, contact.id],
    }),
    foreignKey({
      name: 'trial_battle_fk',
      columns: [table.userId, table.battleId],
      foreignColumns: [battle.userId, battle.id],
    }),
    foreignKey({
      name: 'trial_positioning_fk',
      columns: [table.userId, table.positioningId],
      foreignColumns: [positioning.userId, positioning.id],
    }),
    foreignKey({
      name: 'trial_interaction_fk',
      columns: [table.userId, table.interactionId],
      foreignColumns: [interaction.userId, interaction.id],
    }),
    // At most one in progress per Contact, one counted per Battle (spec stack §6).
    uniqueIndex('trial_in_progress_unique')
      .on(table.userId, table.contactId)
      .where(sql`${table.outcome} = 'in_progress'`),
    uniqueIndex('trial_per_battle_unique')
      .on(table.userId, table.contactId, table.battleId)
      .where(sql`${table.outcome} <> 'canceled'`),
    index('trial_battle_idx').on(table.userId, table.battleId),
    index('trial_positioning_idx').on(table.userId, table.positioningId),
    check('trial_target_check', sql`${table.target} in (${quoted(TARGETS)})`),
    check('trial_outcome_check', sql`${table.outcome} in (${quoted(TRIAL_OUTCOMES)})`),
    check(
      'trial_override_reason_check',
      sql`${table.overrideReason} is null or (${table.overrideReason} <> '' and ${table.overridden})`,
    ),
    check(
      'trial_settled_check',
      sql`(${table.outcome} = 'in_progress') = (${table.settledAt} is null)`,
    ),
    check(
      'trial_cancel_reason_check',
      sql`(${table.outcome} = 'canceled') = (${table.cancelReason} is not null) and (${table.cancelReason} is null or ${table.cancelReason} <> '')`,
    ),
  ],
);

/**
 * What departs from the Cadence of a Trial (CONTEXT.md, Follow-up cadence): a Follow-up done off it
 * once the Response window elapsed (“Follow up anyway”), the day of a Follow-up changed.
 */
export const TRIAL_DEVIATION_KINDS = ['off_cadence_follow_up', 'follow_up_moved'] as const;
export type TrialDeviationKind = (typeof TRIAL_DEVIATION_KINDS)[number];

/** A deviation traced on a Trial in progress (ST-34), gone with it when “Undo” removes it. */
export const trialDeviation = pgTable(
  'trial_deviation',
  {
    id: id(),
    userId: userId(),
    trialId: uuid('trial_id').notNull(),
    kind: text({ enum: TRIAL_DEVIATION_KINDS }).notNull(),
    recordedAt: instant('recorded_at').notNull(),
  },
  (table) => [
    unique('trial_deviation_user_id_id_unique').on(table.userId, table.id),
    foreignKey({
      name: 'trial_deviation_trial_fk',
      columns: [table.userId, table.trialId],
      foreignColumns: [trial.userId, trial.id],
    }).onDelete('cascade'),
    index('trial_deviation_trial_idx').on(table.userId, table.trialId),
    check('trial_deviation_kind_check', sql`${table.kind} in (${quoted(TRIAL_DEVIATION_KINDS)})`),
  ],
);

/**
 * Every gesture on a Contact “Undo” can take back (ADR 0011); `gesture` records them under its
 * column `contact_id`.
 */
export const CONTACT_GESTURE_KINDS = [
  'contact_added',
  'contact_edited',
  'status_changed',
  'stage_changed',
  'follow_up_scheduled',
  'follow_up_canceled',
  'followed_up',
  'interaction_noted',
  'reply_recorded',
  'positioning_used',
  'trial_settled',
  'trial_outcome_changed',
] as const;
