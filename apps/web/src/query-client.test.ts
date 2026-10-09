import { onlineManager } from '@tanstack/react-query';
import { afterEach, expect, test } from 'vitest';

import { createQueryClient } from './query-client.ts';

afterEach(() => {
  onlineManager.setOnline(true);
});

test('an offline mutation fails at once: it is never paused to be replayed later (ADR 0004)', async () => {
  onlineManager.setOnline(false);
  const queryClient = createQueryClient();
  let calls = 0;
  const mutation = queryClient.getMutationCache().build(queryClient, {
    mutationFn: async () => {
      calls += 1;
      throw new TypeError('Failed to fetch');
    },
  });

  await expect(mutation.execute(undefined)).rejects.toThrow('Failed to fetch');
  expect(calls).toBe(1);
  expect(mutation.state.isPaused).toBe(false);

  onlineManager.setOnline(true);
  await queryClient.resumePausedMutations();
  expect(calls).toBe(1);
});
