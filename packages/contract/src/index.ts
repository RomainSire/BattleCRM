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
