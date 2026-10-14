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
