import { Writable } from 'node:stream';

import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { createLogger } from '../src/logger.ts';
import { recordingAlert, scriptedRandom, testClock } from './doubles.ts';

export const testConfig = loadConfig({
  DATABASE_URL: 'postgres://unused',
  APP_VERSION: '0.0.0-test',
  APP_ORIGIN: 'https://app.battlecrm.test',
  TRUSTED_PROXIES: '172.18.0.0/16',
});

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

/** The app as main.ts composes it, with a test clock, scripted randomness, a recording alert and the log lines kept in memory. */
export function testApp() {
  const { logger, logs, output } = testLogger();
  const clock = testClock();
  const alert = recordingAlert();
  const app = createApp({ config: testConfig, clock, random: scriptedRandom(), logger, alert });
  return { app, clock, alert, logger, logs, output };
}
