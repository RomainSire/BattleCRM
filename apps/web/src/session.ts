import { queryOptions } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';

import type { createApiClient } from './api-client.ts';

export type ApiClient = ReturnType<typeof createApiClient>;

/** The API client the router was created with. */
export function useApi(): ApiClient {
  return useRouter().options.context.api;
}

/** Who is signed in on this device: `null` without a session. Asked once per page load. */
export const sessionQuery = (api: ApiClient) =>
  queryOptions({
    queryKey: ['session'],
    queryFn: async () => {
      const response = await api.session.$get();
      if (response.status === 401) return null;
      if (!response.ok) throw new Error('GET /api/session failed');
      return response.json();
    },
    staleTime: Infinity,
    retry: false,
  });

/** What the API lets a visitor do before signing in (ST-10). */
export const configQuery = (api: ApiClient) =>
  queryOptions({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await api.config.$get();
      if (!response.ok) throw new Error('GET /api/config failed');
      return response.json();
    },
    staleTime: Infinity,
    retry: false,
  });
