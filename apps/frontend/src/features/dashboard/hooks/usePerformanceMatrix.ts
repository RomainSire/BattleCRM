import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { analyticsApi } from '../lib/api'

export function usePerformanceMatrix() {
  return useQuery({
    queryKey: queryKeys.analytics.performanceMatrix(),
    queryFn: () => analyticsApi.getPerformanceMatrix(),
    staleTime: 10 * 60 * 1000,
  })
}
