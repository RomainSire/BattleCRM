import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { positioningsApi } from '../lib/api'

export function usePositioningProspects(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.positionings.prospects(id),
    queryFn: () => positioningsApi.prospects(id),
    enabled: options?.enabled ?? true,
  })
}
