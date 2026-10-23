// Hand-written Zod schemas and the API types (spec stack §2).

import { VERDICTS } from '@battlecrm/domain';
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

/** What Settings accept for a Stage (spec UX §5.8): a name, and an optional Aim. */
export const STAGE_NAME_MAX_LENGTH = 100;
export const STAGE_AIM_MAX_LENGTH = 200;

/** The reason of a change of Status, optional (CONTEXT.md, Status). */
export const STATUS_REASON_MAX_LENGTH = 500;

/** The note of a Follow-up, which stays on its Interaction once it is done (CONTEXT.md, Follow-up). */
export const FOLLOW_UP_NOTE_MAX_LENGTH = 2000;

/** The means by which the User and a Contact exchange (CONTEXT.md, Channel): what a reply came by. */
export const CHANNELS = ['email', 'linkedin', 'phone', 'mail'] as const;
export type Channel = (typeof CHANNELS)[number];

/**
 * How a Check-in was done (spec UX §6.14): by a Channel but the mail, or by meeting, or otherwise
 * (CONTEXT.md, Check-in).
 */
export const CHECK_IN_CHANNELS = ['email', 'linkedin', 'phone', 'meeting', 'other'] as const;
export type CheckInChannel = (typeof CHECK_IN_CHANNELS)[number];

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

/** The Targets a Battle may be restricted to (CONTEXT.md, Target): one of them, or none for all. */
export const TARGETS = ['consultancy', 'end_client', 'unknown'] as const;
export type BattleTarget = (typeof TARGETS)[number];

/**
 * The thresholds of confidence a Battle may be opened with (ADR 0001), and the bounds of its Horizon,
 * both fixed once open. The Horizon is never below the minimum of finished Trials, which is not settable.
 */
export const BATTLE_THRESHOLDS = [0.8, 0.85, 0.9, 0.95] as const;
export const DEFAULT_BATTLE_THRESHOLD = 0.85;
export const DEFAULT_BATTLE_HORIZON = 25;
// The minimum is the Win rule's own (packages/domain).
export { BATTLE_MINIMUM_FINISHED, BATTLE_MINIMUM_SUCCESSES } from '@battlecrm/domain';
export const BATTLE_HORIZON_MAX = 100;
export const SUCCESS_CRITERION_MAX_LENGTH = 200;

/** The Verdicts of a closed Battle, the Win rule's own (packages/domain, CONTEXT.md). */
export { VERDICTS, type Verdict } from '@battlecrm/domain';
/** The Takeaway of a closed Battle, optional (CONTEXT.md, Takeaway). */
export const TAKEAWAY_MAX_LENGTH = 2000;

/** The outcome of a Trial (CONTEXT.md, Trial): in progress until the User settles it, or canceled. */
export const TRIAL_OUTCOMES = ['in_progress', 'success', 'no_result', 'canceled'] as const;
export type TrialOutcome = (typeof TRIAL_OUTCOMES)[number];

/**
 * How “Replied…” leaves the Trial in progress (spec UX §6.2): settled as a Success or No result, or
 * left in progress, its Response window counted from the reply. Never preselected (ADR 0005).
 */
export const REPLY_TRIAL_OUTCOMES = ['success', 'no_result', 'in_progress'] as const;
export type ReplyTrialOutcome = (typeof REPLY_TRIAL_OUTCOMES)[number];

/** How a Trial is settled without a reply, or leaving Prospecting (spec UX §6.7, §6.11). */
export const SETTLED_TRIAL_OUTCOMES = ['success', 'no_result', 'canceled'] as const;
export type SettledTrialOutcome = (typeof SETTLED_TRIAL_OUTCOMES)[number];

/** Why a Trial is canceled, required (CONTEXT.md, Trial). */
export const CANCEL_REASON_MAX_LENGTH = 500;

/** The optional reason of an Override (CONTEXT.md, Assignment), traced on the Trial. */
export const OVERRIDE_REASON_MAX_LENGTH = 500;

/**
 * Why a use at a Stage with an open Battle starts no Trial (spec UX §6.1): the Contact already has
 * one in this Battle, is out of its Target, both Positionings reached the Horizon; or it has a
 * Trial in progress elsewhere, to settle first.
 */
export const WITHOUT_TRIAL_REASONS = [
  'already_tried',
  'off_target',
  'horizon',
  'trial_in_progress',
] as const;
export type WithoutTrialReason = (typeof WITHOUT_TRIAL_REASONS)[number];

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
  /**
   * The local day it reached its Stage, by an entry in the Funnel or a change of Stage; `null` at no
   * Stage. Added after the first release: a summary kept on a device may lack it.
   */
  stageEnteredOn: z.iso.date().nullable(),
  /** The reason of the change that put it in its Status, if the User gave one. */
  statusReason: z.string().nullable(),
  /** Its scheduled Follow-up, if it has one: its rank in the Cadence, or none off the Cadence. */
  followUp: z
    .strictObject({ dueOn: z.iso.date(), note: z.string().nullable(), rank: z.int().nullable() })
    .nullable(),
  /** The local days of its Prospecting actions, the earliest first: what the Activity is counted from. */
  prospectingActionDays: z.array(z.iso.date()),
  /** The Positioning the open Battle of its Stage assigned it, once revealed (ADR 0002). */
  assignment: z.strictObject({ battleId: z.uuid(), positioningId: z.uuid() }).nullable(),
  /** Its Trial in progress, if it has one: at most one (CONTEXT.md, Trial). */
  trial: z
    .strictObject({
      battleId: z.uuid(),
      positioningId: z.uuid(),
      /** The local day of the use that started it. */
      startedOn: z.iso.date(),
      /** Whether the Positioning used is not the one assigned. */
      overridden: z.boolean(),
    })
    .nullable(),
});
export type SummaryContact = z.infer<typeof summaryContact>;

/** A Stage as the working summary carries it, archived ones too, in the order of the Funnel. */
export const summaryStage = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  aim: z.string().nullable(),
  archived: z.boolean(),
  /**
   * Whether it ever served: a Contact passed there, or it bears a Positioning or a Battle. Then it is
   * archived, never deleted (CONTEXT.md, Stage). Added after the first release: a summary kept on a
   * device may lack it.
   */
  served: z.boolean(),
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
  /**
   * Archived by the closing of a Battle it did not win (spec UX §5.6): against which Positioning, on
   * which local day, and on which Verdict.
   */
  archivedByBattle: z
    .strictObject({ againstId: z.uuid(), on: z.iso.date(), verdict: z.enum(VERDICTS) })
    .nullable(),
});
export type SummaryPositioning = z.infer<typeof summaryPositioning>;

/** The Trials of one Positioning in a Battle, the canceled ones aside (packages/domain, `TrialCounts`). */
const trialCounts = z.strictObject({
  successes: z.int(),
  noResults: z.int(),
  inProgress: z.int(),
});

/** A Battle as the working summary carries it, the earliest first (spec UX §5.5). */
export const summaryBattle = z.strictObject({
  id: z.uuid(),
  stageId: z.uuid(),
  championId: z.uuid(),
  challengerId: z.uuid(),
  successCriterion: z.string(),
  /** The one Target it is restricted to, `null` for all. */
  target: z.enum(TARGETS).nullable(),
  threshold: z.number(),
  horizon: z.int(),
  /** The local day it was opened on. */
  openedOn: z.iso.date(),
  open: z.boolean(),
  /** Its Trials started, the canceled ones aside, and among them the finished ones (spec UX §6.7). */
  startedTrials: z.int(),
  finishedTrials: z.int(),
  /** Its Trials per Positioning, the canceled ones aside: what the Win rule reads (ADR 0001). */
  trials: z.strictObject({ champion: trialCounts, challenger: trialCounts }),
  /** Once closed: the local day, its Verdict, whether the User designated it, and its Takeaway. */
  closedOn: z.iso.date().nullable(),
  verdict: z.enum(VERDICTS).nullable(),
  designated: z.boolean(),
  takeaway: z.string().nullable(),
});
export type SummaryBattle = z.infer<typeof summaryBattle>;

/** A Trial of a Battle, as its panel reads it on demand (spec UX §5.5), the latest first. */
export const battleTrial = z.strictObject({
  id: z.uuid(),
  contactId: z.uuid(),
  positioningId: z.uuid(),
  /** The local day of the use that started it. */
  startedOn: z.iso.date(),
  outcome: z.enum(TRIAL_OUTCOMES),
  /** The Target of the Contact when it started. */
  target: z.enum(TARGETS),
  cancelReason: z.string().nullable(),
});
export type BattleTrial = z.infer<typeof battleTrial>;

/** What `GET /api/battles/:id/trials` answers. */
export const battleTrials = z.strictObject({ trials: z.array(battleTrial) });

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
  battles: z.array(summaryBattle),
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
  battles: z.array(summaryBattle),
  removedBattleIds: z.array(z.uuid()),
  /**
   * Every Stage, in the order of the Funnel, when the gesture changed the Funnel; `null` otherwise.
   * Added after the first release: an answer from a version from before lacks it.
   */
  stages: z.array(summaryStage).nullable(),
});
export type SummaryChanges = z.infer<typeof summaryChanges>;

/**
 * What revealing the Assignment of a Contact answers (spec UX §6.1): the Positioning to send, or why
 * this use starts no Trial; with the rows of the summary it changed.
 */
export const assignmentRevealed = z.strictObject({
  changes: summaryChanges,
  assignment: z.strictObject({ battleId: z.uuid(), positioningId: z.uuid() }).nullable(),
  withoutTrial: z.enum(WITHOUT_TRIAL_REASONS).nullable(),
});
export type AssignmentRevealed = z.infer<typeof assignmentRevealed>;
