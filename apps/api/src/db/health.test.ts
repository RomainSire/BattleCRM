import { expect, test } from 'vitest';

import { isDatabaseReady } from './index.ts';

test('the database is ready once the latest migration of this version, or a newer one, is applied', async () => {
  expect(await isDatabaseReady()).toBe(true);
  expect(await isDatabaseReady(0)).toBe(true);
  expect(await isDatabaseReady(Number.MAX_SAFE_INTEGER)).toBe(false);
});
