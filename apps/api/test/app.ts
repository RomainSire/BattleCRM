import { Writable } from 'node:stream';

import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { createInFlight } from '../src/in-flight.ts';
import { createLogger } from '../src/logger.ts';
import { fakeHibp, recordingAlert, recordingEmail, scriptedRandom, testClock } from './doubles.ts';

const testEnv = {
  DATABASE_URL: 'postgres://unused',
  APP_VERSION: '0.0.0-test',
  APP_ORIGIN: 'https://app.battlecrm.test',
  TRUSTED_PROXIES: '172.18.0.0/16',
  BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret',
  SIGNUPS_OPEN: 'true',
  SMTP_USER: 'sender@example.com',
  SMTP_PASSWORD: 'unused',
};

export const testConfig = loadConfig(testEnv);

/** A real logger whose lines are kept in memory. */
export function testLogger() {
  const lines: string[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  const logger = createLogger('debug', destination);
  const logs = (): unknown[] => lines.map((line): unknown => JSON.parse(line));
  return { logger, logs, output: () => lines.join('') };
}

/** A password that passes every rule, and one the fake Have I Been Pwned knows as breached. */
export const GOOD_PASSWORD = 'correct horse battery staple';
export const BREACHED_PASSWORD = 'password-password-password';

/**
 * The app as main.ts composes it, with a test clock, scripted randomness, a recording alert,
 * a recording e-mail transport, a fake Have I Been Pwned and the log lines kept in memory.
 */
export function testApp(env: Partial<typeof testEnv> = {}) {
  const { logger, logs, output } = testLogger();
  const clock = testClock();
  const alert = recordingAlert();
  const email = recordingEmail();
  const hibp = fakeHibp(BREACHED_PASSWORD);
  const inFlight = createInFlight();
  const { app, jobs } = createApp({
    config: loadConfig({ ...testEnv, ...env }),
    clock,
    random: scriptedRandom(),
    logger,
    alert,
    email,
    hibp,
    inFlight,
  });
  /** The e-mails sent so far, once every send in flight has ended. */
  const emails = async () => {
    await inFlight.settle(5_000);
    return email.sent;
  };
  return { app, jobs, clock, alert, email, emails, hibp, logger, logs, output };
}
