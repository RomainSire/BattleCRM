import type { AppType } from '@battlecrm/api';
import { hc } from 'hono/client';

/**
 * The typed RPC client of the API, on the SPA's own origin (spec stack §3).
 * `onUnauthenticated` hears of every 401: the one place that learns a session has ended.
 */
export function createApiClient(
  fetch: typeof globalThis.fetch = (input, init) => globalThis.fetch(input, init),
  { onUnauthenticated }: { onUnauthenticated?: () => void } = {},
) {
  return hc<AppType>(location.origin, {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, init);
      if (response.status === 401) onUnauthenticated?.();
      return response;
    },
  }).api;
}
