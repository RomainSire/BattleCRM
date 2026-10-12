import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Every table of this module sits outside row level security: it is read before the User is known (ADR 0010).
// The first six are Better Auth's: property names are its field names, ids come from the database (uuidv7).
// A test compares them with what the installed Better Auth expects.

const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`);
const instant = (name: string) => timestamp(name, { withTimezone: true });

export const user = pgTable('user', {
  id: id(),
  /** Required by Better Auth, never asked for: always empty. */
  name: text().notNull(),
  /** Lower case, as Better Auth looks it up. */
  email: text().notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text(),
  createdAt: instant('created_at').notNull(),
  updatedAt: instant('updated_at').notNull(),
  /** Written by the `twoFactor` plugin once a first code confirmed the secret. */
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
});

export const session = pgTable(
  'session',
  {
    id: id(),
    expiresAt: instant('expires_at').notNull(),
    token: text().notNull().unique(),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
);

export const account = pgTable(
  'account',
  {
    id: id(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: instant('access_token_expires_at'),
    refreshTokenExpiresAt: instant('refresh_token_expires_at'),
    scope: text(),
    password: text(),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (table) => [index('account_user_id_idx').on(table.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: id(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: instant('expires_at').notNull(),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

/**
 * The second factor of a User (ST-18), written by the `twoFactor` plugin: at most one row each,
 * `verified` once a first code confirmed the secret.
 */
export const twoFactor = pgTable(
  'two_factor',
  {
    id: id(),
    /** The TOTP secret, encrypted with the secret of Better Auth. */
    secret: text().notNull(),
    /** The backup codes still unused, a JSON list encrypted the same way. */
    backupCodes: text('backup_codes').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    verified: boolean().default(true),
    /** The plugin's own lock, by account, next to our counters by address. */
    failedVerificationCount: integer('failed_verification_count').default(0),
    lockedUntil: instant('locked_until'),
  },
  (table) => [
    index('two_factor_secret_idx').on(table.secret),
    index('two_factor_user_id_idx').on(table.userId),
  ],
);

/** The counters of Better Auth's own limiter, by IP address and path (spec stack §7). */
export const rateLimit = pgTable('rate_limit', {
  id: id(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  /** Milliseconds since the epoch, as Better Auth writes them. */
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

/**
 * One row per sign-up attempt (spec stack §7): the account only exists once its link is clicked,
 * with the password of that very attempt. An address that already has an account gets a row too,
 * so that both cases answer alike.
 */
export const pendingSignup = pgTable(
  'pending_signup',
  {
    id: id(),
    email: text().notNull(),
    passwordHash: text('password_hash').notNull(),
    locale: text({ enum: ['fr', 'en'] }).notNull(),
    /** Detected by the browser, never asked for. */
    timeZone: text('time_zone').notNull(),
    /** SHA-256 of the latest link's token: the token itself only exists in the e-mail. */
    tokenHash: text('token_hash').notNull().unique(),
    tokenExpiresAt: instant('token_expires_at').notNull(),
    lastSentAt: instant('last_sent_at').notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (table) => [
    index('pending_signup_email_idx').on(table.email),
    check('pending_signup_locale_check', sql`${table.locale} in ('fr', 'en')`),
  ],
);

/**
 * The sign-in counter of one address (ST-15), whether it has an account or not: both answer alike.
 * A row counts failures no 15 quiet minutes separate; a successful sign-in erases it.
 */
export const loginAttempt = pgTable('login_attempt', {
  /** Lower case, as Better Auth looks it up. */
  email: text().primaryKey(),
  failures: integer().notNull(),
  /** When the latest attempt was, or will be, let through: the growing delay and the 15 minutes count from it. */
  lastAttemptAt: instant('last_attempt_at').notNull(),
  /** Set by the 10th failure: until then, even the right password is refused. */
  blockedUntil: instant('blocked_until'),
});

/**
 * The devices an account has signed in from (ST-17), one row per device cookie.
 * A successful sign-in whose cookie has no row here comes from a new device.
 */
export const knownDevice = pgTable(
  'known_device',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** SHA-256 of the device cookie: the value itself only exists in the browser. */
    tokenHash: text('token_hash').notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tokenHash] })],
);
