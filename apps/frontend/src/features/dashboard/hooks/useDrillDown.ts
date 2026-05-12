import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { analyticsApi } from '../lib/api'

export function useDrillDown(
  positioningId: string,
  stageId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.analytics.drillDown(positioningId, stageId),
    queryFn: () => analyticsApi.drillDown(positioningId, stageId),
    enabled: options?.enabled ?? true,
  })
}
