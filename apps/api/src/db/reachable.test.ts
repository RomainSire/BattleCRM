import { expect, test } from 'vitest';

import { assertPostgresReachable } from './reachable.ts';

test('an unreachable Postgres says what to do', async () => {
  await expect(assertPostgresReachable('postgres://app:app@127.0.0.1:1/battlecrm')).rejects.toThrow(
    /Postgres at 127\.0\.0\.1:1 is unreachable.*VPN/,
  );
});
