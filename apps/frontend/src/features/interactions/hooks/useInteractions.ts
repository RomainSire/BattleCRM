import type { InteractionsFilterType } from '@battlecrm/shared'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { interactionsApi } from '../lib/api'

export function useInteractions(filters?: InteractionsFilterType, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.interactions.list(filters),
    queryFn: () => interactionsApi.list(filters),
    enabled: options?.enabled ?? true,
  })
}
