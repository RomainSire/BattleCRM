// Hand-written Zod schemas and the API types (spec stack §2).

import { locales } from '@battlecrm/i18n/runtime';
import { z } from 'zod';

/** A password is judged on its length, nothing else (spec stack §7). */
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

/** Between two sends of a verification link to the same address. */
export const SIGNUP_RESEND_DELAY_SECONDS = 60;

/** The Status of a Contact (CONTEXT.md): Pool, Prospecting, Ally, Archived. */
export const CONTACT_STATUSES = ['pool', 'prospecting', 'ally', 'archived'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** A Contact only needs a name. */
export const CONTACT_NAME_MAX_LENGTH = 200;

/** What the quick add offers (spec UX §6.8): a new Contact is never added Archived. */
export const ADDABLE_CONTACT_STATUSES = ['pool', 'prospecting', 'ally'] as const;
export type AddableContactStatus = (typeof ADDABLE_CONTACT_STATUSES)[number];

/** The type of an Organization (CONTEXT.md), which sets the Target of its Contacts. */
export const ORGANIZATION_TYPES = ['consultancy', 'end_client'] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

/** What a quick add or an edit accepts, beyond the name (spec UX §6.8, §6.12). */
export const ORGANIZATION_NAME_MAX_LENGTH = 200;
export const CONTACT_JOB_TITLE_MAX_LENGTH = 200;
export const CONTACT_EMAIL_MAX_LENGTH = 254;
export const CONTACT_PHONE_MAX_LENGTH = 40;
export const CONTACT_LINKEDIN_URL_MAX_LENGTH = 500;
export const CONTACT_NOTE_MAX_LENGTH = 5000;

/** The reason of a change of Status, optional (CONTEXT.md, Status). */
export const STATUS_REASON_MAX_LENGTH = 500;

/** The note of a Follow-up, which stays on its Interaction once it is done (CONTEXT.md, Follow-up). */
export const FOLLOW_UP_NOTE_MAX_LENGTH = 2000;

/** The means by which the User and a Contact exchange (CONTEXT.md, Channel): what a reply came by. */
export const CHANNELS = ['email', 'linkedin', 'phone', 'mail'] as const;
export type Channel = (typeof CHANNELS)[number];

/** What “Note an Interaction” records (spec UX §6.4): an outbound Interaction off any Positioning. */
export const NOTED_INTERACTION_KINDS = ['call', 'meeting', 'message', 'other'] as const;
export type NotedInteractionKind = (typeof NOTED_INTERACTION_KINDS)[number];

/** The note of an Interaction the User writes down, outbound or a reply. */
export const INTERACTION_NOTE_MAX_LENGTH = 2000;

// What the User sets in Settings (spec UX §5.8), and what a new User starts with (CONTEXT.md).
/** Prospecting actions per day; `null` once the User turned it off. */
export const DEFAULT_ACTIVITY_GOAL = 1;
/** Funnel entries per week, from Monday to Sunday; `null` once the User turned it off. */
export const DEFAULT_ENTRY_GOAL = 5;
/** “Celebrate the goal reached” and “Single-key shortcuts” start on. */
export const DEFAULT_CELEBRATE_GOAL = true;
export const DEFAULT_SINGLE_KEY_SHORTCUTS = true;
/** Days between two check-ins with each Ally. */
export const DEFAULT_CHECK_IN_RHYTHM_DAYS = 28;
/** Allies the User wants to keep up with; `null` once the User turned it off. */
export const DEFAULT_CIRCLE_SIZE_GOAL = 10;
/** The Default follow-up cadence: its intervals, each counted from the last outgoing Interaction, then the Response window. */
export const DEFAULT_FOLLOW_UP_INTERVALS: readonly number[] = [3, 7, 14];
export const DEFAULT_RESPONSE_WINDOW_DAYS = 14;

/** The bounds of what Settings accept: a goal, a count of days, the length of a cadence. */
export const GOAL_MAX = 999;
export const SETTING_DAYS_MAX = 365;
export const FOLLOW_UP_INTERVALS_MAX = 10;

/** What a Positioning holds (CONTEXT.md, Positioning): a label, what is sent, and a message per rank of its cadence. */
export const POSITIONING_LABEL_MAX_LENGTH = 200;
export const POSITIONING_CONTENT_MAX_LENGTH = 10_000;
export const FOLLOW_UP_MESSAGE_MAX_LENGTH = 5000;

/** The files joined to a Positioning (ST-35): of any type, 5 MiB each, 100 MiB for all of a User's. */
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const ATTACHMENTS_MAX_BYTES_PER_USER = 100 * 1024 * 1024;
export const ATTACHMENT_NAME_MAX_LENGTH = 255;

// The working summary (ADR 0012), described once: the API builds it to this shape, the SPA reads it,
// the tests check the answers against it. Strict, so a field the API adds unannounced fails the tests.

/** A Contact as the working summary carries it, the latest Interaction first. */
export const summaryContact = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  status: z.enum(CONTACT_STATUSES),
  /** The Stage it is at, Prospecting; otherwise the last one it reached, if any. */
  stageId: z.uuid().nullable(),
  organizationId: z.uuid().nullable(),
  /** What the search and the duplicate checks read; the note stays out of the summary. */
  jobTitle: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  lastInteractionAt: z.iso.datetime(),
  lastInteractionOn: z.iso.date(),
  /** The local day of its latest Interaction done, outbound or inbound, if it has one. */
  lastDoneInteractionOn: z.iso.date().nullable(),
  /** The local days of its Funnel entries, the earliest first. */
  funnelEntryDays: z.array(z.iso.date()),
  /** The reason of the change that put it in its Status, if the User gave one. */
  statusReason: z.string().nullable(),
  /** Its scheduled Follow-up, if it has one. */
  followUp: z.strictObject({ dueOn: z.iso.date(), note: z.string().nullable() }).nullable(),
  /** The local days of its Prospecting actions, the earliest first: what the Activity is counted from. */
  prospectingActionDays: z.array(z.iso.date()),
});
export type SummaryContact = z.infer<typeof summaryContact>;

/** A Stage as the working summary carries it, archived ones too, in the order of the Funnel. */
export const summaryStage = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  aim: z.string().nullable(),
  archived: z.boolean(),
});
export type SummaryStage = z.infer<typeof summaryStage>;

/** An Organization as the working summary carries it, by name. */
export const summaryOrganization = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  type: z.enum(ORGANIZATION_TYPES),
});
export type SummaryOrganization = z.infer<typeof summaryOrganization>;

/** A Positioning as the working summary carries it, archived ones too, the earliest first. */
export const summaryPositioning = z.strictObject({
  id: z.uuid(),
  stageId: z.uuid(),
  label: z.string(),
  channel: z.enum(CHANNELS),
  content: z.string().nullable(),
  followUps: z.array(z.strictObject({ days: z.int(), message: z.string().nullable() })),
  responseWindowDays: z.int(),
  derivedFromId: z.uuid().nullable(),
  archived: z.boolean(),
  /** Its attachments not removed, in the order they were joined; their bytes are downloaded apart. */
  attachments: z.array(
    z.strictObject({ id: z.uuid(), name: z.string(), contentType: z.string(), size: z.int() }),
  ),
  /** Whether it was ever used, and in how many Trials: frozen from the first one. */
  used: z.boolean(),
  trialCount: z.int(),
});
export type SummaryPositioning = z.infer<typeof summaryPositioning>;

/** A value in effect now, and as the User chose it last. */
const dated = <Value extends z.ZodType>(value: Value) =>
  z.strictObject({ inEffect: value, chosen: value });

/** Settings, as the summary carries them (spec UX §5.8). */
export const summarySettings = z.strictObject({
  locale: z.enum(locales),
  timeZone: dated(z.string()),
  activityGoal: dated(z.int().nullable()),
  entryGoal: dated(z.int().nullable()),
  celebrateGoal: z.boolean(),
  singleKeyShortcuts: z.boolean(),
  checkInRhythmDays: z.int(),
  circleSizeGoal: z.int().nullable(),
  defaultCadence: z.strictObject({ intervals: z.array(z.int()), responseWindowDays: z.int() }),
});
export type SummarySettings = z.infer<typeof summarySettings>;

/** The whole working summary, as `GET /api/summary` answers it. */
export const summary = z.strictObject({
  /** The time zone of the User in effect now: what its today is read in, on the device too. */
  timeZone: z.string(),
  settings: summarySettings,
  contacts: z.array(summaryContact),
  stages: z.array(summaryStage),
  organizations: z.array(summaryOrganization),
  positionings: z.array(summaryPositioning),
});
export type Summary = z.infer<typeof summary>;

/** The rows of the summary a gesture, or its undo, changed, and the ones it removed: what its answer carries. */
export const summaryChanges = z.strictObject({
  contacts: z.array(summaryContact),
  removedContactIds: z.array(z.uuid()),
  organizations: z.array(summaryOrganization),
  removedOrganizationIds: z.array(z.uuid()),
  positionings: z.array(summaryPositioning),
  removedPositioningIds: z.array(z.uuid()),
});
export type SummaryChanges = z.infer<typeof summaryChanges>;
