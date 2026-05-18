import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { positioningsApi } from '../lib/api'

export function usePositioning(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.positionings.detail(id),
    queryFn: () => positioningsApi.get(id),
    enabled: options?.enabled ?? true,
  })
}
