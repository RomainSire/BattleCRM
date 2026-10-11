import { randomUUID } from 'node:crypto';

import type { Locale } from '@battlecrm/i18n/runtime';

import { GOOD_PASSWORD, type testApp } from '../app.ts';
import { testBetterAuth } from '../better-auth.ts';
import { cookiesOf, postJson } from '../http.ts';

type Harness = ReturnType<typeof testApp>;

/** The token of the latest verification link sent to an address. */
export async function verificationToken(harness: Harness, email: string): Promise<string> {
  const sent = (await harness.emails()).findLast((message) => message.to === email);
  const token = sent && /\/verify-email#(\S+)/.exec(sent.text)?.[1];
  if (!token) throw new Error(`No verification link was sent to ${email}`);
  return token;
}

/**
 * A verified User and its session cookie, reached the only way a User can exist:
 * a sign-up, then a click on the link of its e-mail (spec stack §13).
 */
export async function makeUser(
  harness: Harness,
  { locale = 'fr', timeZone = 'Europe/Paris' }: { locale?: Locale; timeZone?: string } = {},
) {
  const email = `user-${randomUUID()}@example.com`;
  const password = GOOD_PASSWORD;
  const signup = await postJson(harness.app, '/api/signup', { email, password, locale, timeZone });
  if (signup.status !== 202) throw new Error(`makeUser: the sign-up answered ${signup.status}`);
  const verified = await postJson(harness.app, '/api/signup/verify', {
    token: await verificationToken(harness, email),
  });
  if (verified.status !== 200) throw new Error(`makeUser: the click answered ${verified.status}`);
  const cookie = cookiesOf(verified);
  const auth = await testBetterAuth();
  const session = await auth.api.getSession({ headers: new Headers({ Cookie: cookie }) });
  if (!session) throw new Error('makeUser: Better Auth does not know the session');
  return { userId: session.user.id, email, password, cookie };
}
