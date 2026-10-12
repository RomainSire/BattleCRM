import { randomUUID } from 'node:crypto';

import { describe, expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { makeUser } from '../../test/factories/user.ts';
import { cookiesOf, postJson } from '../../test/http.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const CONFIRM_SUBJECTS = ['Confirme ta nouvelle adresse e-mail', 'Confirm your new email address'];
const NOTICE_SUBJECTS = ["Changement d'adresse e-mail demandé", 'Email address change requested'];

const newAddress = () => `new-${randomUUID()}@example.com`;

const askFor = (harness: Harness, cookie: string | undefined, body: unknown) =>
  postJson(harness.app, '/api/account/email', body, cookie);

const confirm = (harness: Harness, cookie: string | undefined, token: unknown) =>
  postJson(harness.app, '/api/account/email/confirm', { token }, cookie);

const signIn = (harness: Harness, email: string, password: string) =>
  postJson(harness.app, '/api/auth/sign-in/email', { email, password });

const whoAmI = (harness: Harness, cookie: string) =>
  harness.app.request('/api/session', { headers: { Cookie: cookie } });

async function emailsTo(harness: Harness, email: string, subjects: string[]) {
  return (await harness.emails()).filter(
    (message) => message.to === email && subjects.includes(message.subject),
  );
}

/** Asks for the change and reads the token in the e-mail sent to the new address. */
async function changeToken(harness: Harness, { cookie, password }: User, email: string) {
  expect((await askFor(harness, cookie, { password, email })).status).toBe(204);
  const sent = (await emailsTo(harness, email, CONFIRM_SUBJECTS)).at(-1);
  const token = sent && /\/change-email#(\S+)/.exec(sent.text)?.[1];
  if (!token) throw new Error(`No confirmation link was sent to ${email}`);
  return token;
}

describe('asking for a new address', () => {
  test('sends a single-use link of one hour to the new address, and changes nothing yet', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const email = newAddress();

    const response = await askFor(harness, user.cookie, { password: user.password, email });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    const [link, ...others] = await emailsTo(harness, email, CONFIRM_SUBJECTS);
    expect(others).toEqual([]);
    expect(link?.text).toMatch(/https:\/\/app\.battlecrm\.test\/change-email#[\w-]{43}/);
    expect(link?.text).toContain('1 heure');
    expect(await (await whoAmI(harness, user.cookie)).json()).toEqual({ email: user.email });
    expect((await signIn(harness, email, user.password)).status).toBe(401);
  });

  test('warns the current address, which names the new one and offers “It was not me”', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const email = newAddress();

    await askFor(harness, user.cookie, { password: user.password, email });

    const [notice, ...others] = await emailsTo(harness, user.email, NOTICE_SUBJECTS);
    expect(others).toEqual([]);
    expect(notice?.text).toContain(email);
    expect(notice?.text).toContain(
      "Ce n'était pas moi\nhttps://app.battlecrm.test/forgot-password",
    );
    // The link itself only goes to the new address.
    expect(notice?.text).not.toContain('/change-email');
  });

  test('both e-mails are written in the language of the User', async () => {
    const harness = testApp();
    const user = await makeUser(harness, { locale: 'en' });
    const email = newAddress();

    await askFor(harness, user.cookie, { password: user.password, email });

    expect(await emailsTo(harness, email, CONFIRM_SUBJECTS)).toMatchObject([
      { subject: 'Confirm your new email address' },
    ]);
    const [notice] = await emailsTo(harness, user.email, NOTICE_SUBJECTS);
    expect(notice?.subject).toBe('Email address change requested');
    expect(notice?.text).toContain("It wasn't me\nhttps://app.battlecrm.test/forgot-password");
  });

  test('the address is trimmed and lower-cased', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const email = newAddress();

    await askFor(harness, user.cookie, {
      password: user.password,
      email: `  ${email.toUpperCase()} `,
    });

    expect(await emailsTo(harness, email, CONFIRM_SUBJECTS)).toHaveLength(1);
  });

  test('an address someone else has gets the very same answer, and no link', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const someoneElse = await makeUser(harness);

    const free = await askFor(harness, user.cookie, {
      password: user.password,
      email: newAddress(),
    });
    const taken = await askFor(harness, user.cookie, {
      password: user.password,
      email: someoneElse.email,
    });

    expect(taken.status).toBe(free.status);
    expect(await taken.text()).toBe(await free.text());
    expect((await harness.emails()).filter((message) => message.to === someoneElse.email)).toEqual(
      // The only e-mail that address ever got is its own verification link.
      [expect.objectContaining({ subject: 'Confirme ton adresse e-mail' })],
    );
  });

  test('the address the User already has sends nothing', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    const response = await askFor(harness, user.cookie, {
      password: user.password,
      email: user.email,
    });

    expect(response.status).toBe(204);
    expect(await emailsTo(harness, user.email, [...CONFIRM_SUBJECTS, ...NOTICE_SUBJECTS])).toEqual(
      [],
    );
  });

  test('a wrong password sends nothing, and does not sign this device out', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const email = newAddress();

    const response = await askFor(harness, user.cookie, { password: 'not the right one', email });
    const withoutIt = await askFor(harness, user.cookie, { email });

    // Never 401: the SPA reads it as a session ended from elsewhere.
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'wrong_password' });
    expect(withoutIt.status).toBe(400);
    expect((await whoAmI(harness, user.cookie)).status).toBe(200);
    expect(await emailsTo(harness, email, CONFIRM_SUBJECTS)).toEqual([]);
    expect(await emailsTo(harness, user.email, NOTICE_SUBJECTS)).toEqual([]);
  });

  test('the password is asked for every time: no window after a right one', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    await askFor(harness, user.cookie, { password: user.password, email: newAddress() });

    const second = await askFor(harness, user.cookie, {
      password: 'not the right one',
      email: newAddress(),
    });

    expect(second.status).toBe(403);
  });

  test('wrong passwords count like failed sign-ins: blocked after ten', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const email = newAddress();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await askFor(harness, user.cookie, { password: 'not the right one', email });
    }

    const blocked = await askFor(harness, user.cookie, { password: user.password, email });

    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'too_many_attempts' });
  });

  test('something that is no address is refused', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    const response = await askFor(harness, user.cookie, {
      password: user.password,
      email: 'not an address',
    });

    expect(response.status).toBe(400);
  });

  test('needs a session', async () => {
    const harness = testApp();
    const user = await makeUser(harness);

    const response = await askFor(harness, undefined, {
      password: user.password,
      email: newAddress(),
    });

    expect(response.status).toBe(401);
  });
});

describe('clicking the link sent to the new address', () => {
  test('changes the address: the new one signs in, the old one no longer does', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const email = newAddress();
    const token = await changeToken(harness, user, email);

    const response = await confirm(harness, user.cookie, token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email });
    expect(await (await whoAmI(harness, user.cookie)).json()).toEqual({ email });
    expect((await signIn(harness, email, user.password)).status).toBe(200);
    expect((await signIn(harness, user.email, user.password)).status).toBe(401);
    expect(harness.output()).not.toContain(token);
  });

  test('opens no session: without one, the link changes nothing', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const email = newAddress();
    const token = await changeToken(harness, user, email);

    const response = await confirm(harness, undefined, token);

    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await (await whoAmI(harness, user.cookie)).json()).toEqual({ email: user.email });
    // Once signed in, the same link still works.
    expect((await confirm(harness, user.cookie, token)).status).toBe(200);
  });

  test('sets no cookie beyond the session it came with', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const token = await changeToken(harness, user, newAddress());

    const response = await confirm(harness, user.cookie, token);

    expect(cookiesOf(response)).not.toMatch(/session_token=[^;]/);
  });

  test('the session of another User cannot use it', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const someoneElse = await makeUser(harness);
    const email = newAddress();
    const token = await changeToken(harness, user, email);

    const response = await confirm(harness, someoneElse.cookie, token);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_link' });
    expect(await (await whoAmI(harness, someoneElse.cookie)).json()).toEqual({
      email: someoneElse.email,
    });
    expect((await confirm(harness, user.cookie, token)).status).toBe(200);
  });

  test('works once', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const token = await changeToken(harness, user, newAddress());

    const [first, second] = await Promise.all([
      confirm(harness, user.cookie, token),
      confirm(harness, user.cookie, token),
    ]);
    const third = await confirm(harness, user.cookie, token);

    expect([first.status, second.status].toSorted((a, b) => a - b)).toEqual([200, 400]);
    expect(third.status).toBe(400);
    expect(await third.json()).toEqual({ error: 'invalid_link' });
  });

  test('works for one hour, not a second more', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const inTime = await changeToken(harness, user, newAddress());
    harness.clock.advance('PT59M59S');
    expect((await confirm(harness, user.cookie, inTime)).status).toBe(200);

    const tooLate = await changeToken(harness, user, newAddress());
    harness.clock.advance('PT1H');

    expect((await confirm(harness, user.cookie, tooLate)).status).toBe(400);
  });

  test('a later request replaces the link of the one before', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const mistyped = newAddress();
    const first = await changeToken(harness, user, mistyped);
    const email = newAddress();
    const second = await changeToken(harness, user, email);

    expect((await confirm(harness, user.cookie, first)).status).toBe(400);
    expect((await confirm(harness, user.cookie, second)).status).toBe(200);
    expect(await (await whoAmI(harness, user.cookie)).json()).toEqual({ email });
  });

  test('an address taken in the meantime answers like a dead link', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const rival = await makeUser(harness);
    const email = newAddress();
    const token = await changeToken(harness, user, email);
    const rivalToken = await changeToken(harness, rival, email);
    expect((await confirm(harness, rival.cookie, rivalToken)).status).toBe(200);

    const response = await confirm(harness, user.cookie, token);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_link' });
    expect(await (await whoAmI(harness, user.cookie)).json()).toEqual({ email: user.email });
  });

  test('two Users clicking for the same address at once: a single one gets it', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const rival = await makeUser(harness);
    const email = newAddress();
    const token = await changeToken(harness, user, email);
    const rivalToken = await changeToken(harness, rival, email);

    const responses = await Promise.all([
      confirm(harness, user.cookie, token),
      confirm(harness, rival.cookie, rivalToken),
    ]);

    expect(responses.map((response) => response.status).toSorted((a, b) => a - b)).toEqual([
      200, 400,
    ]);
  });

  test('“It was not me”: a new password cancels the change under way', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const token = await changeToken(harness, user, newAddress());
    const thief = await changeToken(harness, user, newAddress());
    expect(token).not.toBe(thief);

    await postJson(harness.app, '/api/password-reset', { email: user.email });
    const reset = (await harness.emails()).findLast(
      (message) => message.to === user.email && message.text.includes('/reset-password#'),
    );
    const resetToken = /\/reset-password#(\S+)/.exec(reset?.text ?? '')?.[1];
    const completed = await postJson(harness.app, '/api/password-reset/complete', {
      token: resetToken,
      password: 'a brand new passphrase',
    });
    expect(completed.status).toBe(200);

    const response = await confirm(harness, cookiesOf(completed), thief);

    expect(response.status).toBe(400);
    expect(await (await whoAmI(harness, cookiesOf(completed))).json()).toEqual({
      email: user.email,
    });
  });

  test('a password changed from Settings cancels it too', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const token = await changeToken(harness, user, newAddress());

    await postJson(
      harness.app,
      '/api/account/password',
      { password: user.password, newPassword: 'a brand new passphrase' },
      user.cookie,
    );

    expect((await confirm(harness, user.cookie, token)).status).toBe(400);
  });

  test('the change of one User leaves the link of another alone', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const other = await makeUser(harness);
    const otherToken = await changeToken(harness, other, newAddress());

    await confirm(harness, user.cookie, await changeToken(harness, user, newAddress()));

    expect((await confirm(harness, other.cookie, otherToken)).status).toBe(200);
  });
});

describe('once the address has changed', () => {
  test('the e-mails that follow go to the new address, in the language of the User', async () => {
    const harness = testApp();
    const user = await makeUser(harness, { locale: 'en' });
    const email = newAddress();
    await confirm(harness, user.cookie, await changeToken(harness, user, email));

    await postJson(
      harness.app,
      '/api/account/password',
      { password: user.password, newPassword: 'a brand new passphrase' },
      user.cookie,
    );

    expect(await emailsTo(harness, email, ['Your password was changed'])).toHaveLength(1);
    expect(await emailsTo(harness, user.email, ['Your password was changed'])).toEqual([]);
  });

  test('a new device is told to the new address, its date in the time zone of the User', async () => {
    const harness = testApp();
    const user = await makeUser(harness, { locale: 'fr', timeZone: 'America/New_York' });
    const email = newAddress();
    await confirm(harness, user.cookie, await changeToken(harness, user, email));

    expect((await signIn(harness, email, user.password)).status).toBe(200);

    const [alert] = await emailsTo(harness, email, ['Nouvelle connexion à ton compte BattleCRM']);
    const inNewYork = new Intl.DateTimeFormat('fr', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
    }).format(harness.clock.now());
    expect(alert?.text).toContain(inNewYork);
    expect(alert?.text).toMatch(/UTC[−-][45]/);
  });

  test('a reset link is asked for with the new address, never the old one', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    const email = newAddress();
    await confirm(harness, user.cookie, await changeToken(harness, user, email));

    await postJson(harness.app, '/api/password-reset', { email: user.email });
    await postJson(harness.app, '/api/password-reset', { email });

    const links = (await harness.emails()).filter((message) =>
      message.text.includes('/reset-password#'),
    );
    expect(links.filter((message) => message.to === user.email)).toEqual([]);
    expect(links.filter((message) => message.to === email)).toHaveLength(1);
  });

  test('the old address is free again for a new account', async () => {
    const harness = testApp();
    const user = await makeUser(harness);
    await confirm(harness, user.cookie, await changeToken(harness, user, newAddress()));
    const newcomer = await makeUser(harness);

    const token = await changeToken(harness, newcomer, user.email);

    expect((await confirm(harness, newcomer.cookie, token)).status).toBe(200);
  });
});
