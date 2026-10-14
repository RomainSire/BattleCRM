// Hand-written Zod schemas and the API types (spec stack §2).

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
