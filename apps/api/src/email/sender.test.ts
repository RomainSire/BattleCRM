import { expect, test } from 'vitest';

import { testLogger } from '../../test/app.ts';
import { recordingAlert, recordingEmail } from '../../test/doubles.ts';
import { createInFlight } from '../in-flight.ts';
import { createEmailSender, maskEmail } from './index.ts';

function sender() {
  const transport = recordingEmail();
  const alert = recordingAlert();
  const inFlight = createInFlight();
  const { logger, logs, output } = testLogger();
  const sendEmail = createEmailSender({ transport, logger, alert, inFlight });
  return { sendEmail, transport, alert, inFlight, logs, output };
}

test('verify_email is written in the language asked for, with its link in the text and the HTML', async () => {
  const { sendEmail, transport, inFlight } = sender();
  const url = 'https://app.battlecrm.test/verify-email#abc';

  sendEmail('jane@example.com', 'verify_email', { url }, 'fr');
  sendEmail('jane@example.com', 'verify_email', { url }, 'en');
  await inFlight.settle(1_000);

  const [french, english] = transport.sent;
  expect(french).toMatchObject({ to: 'jane@example.com', subject: 'Confirme ton adresse e-mail' });
  expect(english).toMatchObject({ subject: 'Confirm your email address' });
  for (const email of transport.sent) {
    expect(email.text).toContain(url);
    expect(email.html).toContain(`href="${url}"`);
  }
  expect(french?.html).toContain('<html lang="fr">');
  expect(french?.text).toContain('Ne réponds pas à cet e-mail.');
  expect(english?.text).toContain('Do not reply to this email.');
});

test('account_exists links to signing in and to the password reset', async () => {
  const { sendEmail, transport, inFlight } = sender();

  sendEmail(
    'jane@example.com',
    'account_exists',
    {
      signInUrl: 'https://app.battlecrm.test/sign-in',
      resetUrl: 'https://app.battlecrm.test/forgot-password',
    },
    'fr',
  );
  await inFlight.settle(1_000);

  const [email] = transport.sent;
  expect(email?.subject).toBe('Tu as déjà un compte');
  for (const body of [email?.text, email?.html]) {
    expect(body).toContain('https://app.battlecrm.test/sign-in');
    expect(body).toContain('https://app.battlecrm.test/forgot-password');
  }
});

test('a parameter can never inject markup into the HTML', async () => {
  const { sendEmail, transport, inFlight } = sender();

  sendEmail('jane@example.com', 'verify_email', { url: 'https://x.test/"><b>bold</b>' }, 'en');
  await inFlight.settle(1_000);

  expect(transport.sent[0]?.html).not.toContain('<b>bold</b>');
  expect(transport.sent[0]?.html).toContain('&lt;b&gt;bold&lt;/b&gt;');
});

test('a failed send is logged with a masked address and alerts, without throwing', async () => {
  const { sendEmail, transport, alert, inFlight, logs, output } = sender();
  transport.failWith = new TypeError('550 rejected jane.doe@example.com');

  sendEmail('jane.doe@example.com', 'verify_email', { url: 'https://app.test/secret-token' }, 'fr');
  await inFlight.settle(1_000);

  expect(logs()).toEqual([
    expect.objectContaining({
      level: 50,
      msg: 'email failed',
      template: 'verify_email',
      to: 'j***@example.com',
      error: 'TypeError',
    }),
  ]);
  expect(output()).not.toContain('jane.doe');
  expect(output()).not.toContain('secret-token');
  expect(alert.downs).toEqual(['TypeError in email verify_email']);
});

test('maskEmail keeps the first letter and the domain', () => {
  expect(maskEmail('jane.doe@example.com')).toBe('j***@example.com');
  expect(maskEmail('not-an-address')).toBe('***');
});
