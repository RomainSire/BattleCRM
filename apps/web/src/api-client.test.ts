import { expect, test } from 'vitest';

import { createApiClient } from './api-client.ts';

test('calls the API on the same origin, under /api', async () => {
  const requests: string[] = [];
  const api = createApiClient((input) => {
    requests.push(new Request(input).url);
    return Promise.resolve(Response.json({ status: 'ok', version: 'test' }));
  });

  const response = await api.health.$get();

  expect(await response.json()).toEqual({ status: 'ok', version: 'test' });
  expect(requests).toEqual([`${location.origin}/api/health`]);
});
