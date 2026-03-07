import type { PositioningsFilterType } from '@battlecrm/shared'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { positioningsApi } from '../lib/api'

export function usePositionings(filters?: PositioningsFilterType) {
  return useQuery({
    queryKey: queryKeys.positionings.list(filters),
    queryFn: () => positioningsApi.list(filters),
  })
}
