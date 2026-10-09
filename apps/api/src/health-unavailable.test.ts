import { pino } from 'pino';
import { beforeAll, expect, test } from 'vitest';

import { testApp, testConfig } from '../test/app.ts';
import { closeDatabase, openDatabase } from './db/index.ts';

beforeAll(async () => {
  await closeDatabase();
  openDatabase('postgres://battlecrm_app:app@127.0.0.1:1/battlecrm', pino({ enabled: false }));
});

test('GET /api/health answers 503 without detail when the database is unreachable', async () => {
  const { app } = testApp();

  const response = await app.request('/api/health');

  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ status: 'unavailable', version: testConfig.appVersion });
});
