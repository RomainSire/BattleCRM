import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { interactionsApi } from '../lib/api'

export function useInteraction(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.interactions.detail(id),
    queryFn: () => interactionsApi.get(id),
    enabled: options?.enabled ?? true,
  })
}
