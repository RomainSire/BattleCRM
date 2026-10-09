import type { AppType } from '@battlecrm/api';
import { hc } from 'hono/client';

/** The typed RPC client of the API, on the SPA's own origin (spec stack §3). */
export function createApiClient(
  fetch: typeof globalThis.fetch = (input, init) => globalThis.fetch(input, init),
) {
  return hc<AppType>(location.origin, { fetch }).api;
}
