import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { analyticsApi } from '../lib/api'

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.analytics.summary(),
    queryFn: () => analyticsApi.getSummary(),
  })
}
