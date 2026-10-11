import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Every table of this module sits outside row level security: it is read before the User is known (ADR 0010).
// The first four are Better Auth's: property names are its field names, ids come from the database (uuidv7).
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
