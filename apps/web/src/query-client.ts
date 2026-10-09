import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Offline is read-only (ADR 0004): a mutation fails at once instead of waiting to be replayed.
      mutations: { networkMode: 'always', retry: false },
    },
  });
}
