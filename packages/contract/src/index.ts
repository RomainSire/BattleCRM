// Hand-written Zod schemas and the API types (spec stack §2).

/** A password is judged on its length, nothing else (spec stack §7). */
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

/** Between two sends of a verification link to the same address. */
export const SIGNUP_RESEND_DELAY_SECONDS = 60;
