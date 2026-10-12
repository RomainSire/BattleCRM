import { and, eq, ne } from 'drizzle-orm';
import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

import type { AppEnv } from '../app.ts';
import type { Clock } from '../clock.ts';
import type { Config } from '../config.ts';
import { withoutIsolation } from '../db/index.ts';
import type { SendEmail } from '../email/index.ts';
import type { Random } from '../random.ts';
import { languageAndTimeZoneOf } from '../settings/index.ts';
import { knownDevice } from './tables.ts';
import { hashToken } from './token-hash.ts';
import { describeUserAgent } from './user-agent.ts';

/** Sent as `__Host-battlecrm.device`: this origin only, never a parent domain. */
const DEVICE_COOKIE = 'battlecrm.device';
/** The longest a browser keeps a cookie; every sign-in starts it again. */
const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
/** What `Random.token` draws: anything else is no cookie of ours. */
const DEVICE_TOKEN = /^[\w-]{43}$/;

/**
 * Tells a device from another across sign-outs (ST-17): a random cookie the browser keeps,
 * whose fingerprint an account remembers. A device new to an account is worth a security e-mail.
 */
export function createDevices({
  config,
  clock,
  random,
  sendEmail,
}: {
  config: Config;
  clock: Clock;
  random: Random;
  sendEmail: SendEmail;
}) {
  return {
    /**
     * A session was just opened for this User by this request: its device is remembered and keeps
     * its cookie. The User is told when the account already knew other devices and not this one;
     * the first device of an account is the one that created it. `announce: false` when the User hears
     * of this session otherwise, as after a password reset.
     */
    async signedIn(
      c: Context<AppEnv>,
      user: { id: string; email: string },
      { announce = true }: { announce?: boolean } = {},
    ): Promise<void> {
      const held = getCookie(c, DEVICE_COOKIE, 'host');
      // A device another account already knows keeps its cookie: one browser, several accounts.
      const token = held !== undefined && DEVICE_TOKEN.test(held) ? held : random.token();
      setCookie(c, DEVICE_COOKIE, token, {
        prefix: 'host',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
        maxAge: DEVICE_COOKIE_MAX_AGE,
      });
      const now = clock.now();
      // Read before the device is remembered: should it fail, the next sign-in still tells.
      const { locale, timeZone } = await languageAndTimeZoneOf(user.id, now);
      const tokenHash = hashToken(token);
      const isNew = await withoutIsolation(async (db) => {
        // Sign-ins sent together from one device: a single one writes the row, and tells.
        const remembered = await db
          .insert(knownDevice)
          .values({ userId: user.id, tokenHash, createdAt: now })
          .onConflictDoNothing()
          .returning({ userId: knownDevice.userId });
        if (remembered.length === 0) return false;
        const others = await db
          .select({ userId: knownDevice.userId })
          .from(knownDevice)
          .where(and(eq(knownDevice.userId, user.id), ne(knownDevice.tokenHash, tokenHash)))
          .limit(1);
        return others.length > 0;
      });
      if (!isNew || !announce) return;
      sendEmail(
        user.email,
        'new_device',
        {
          ...describeUserAgent(c.req.header('User-Agent')),
          at: now,
          timeZone,
          // “It wasn't me” leads to a new password, which signs every device out.
          notMeUrl: `${config.appOrigin}/forgot-password`,
        },
        locale,
      );
    },
  };
}
