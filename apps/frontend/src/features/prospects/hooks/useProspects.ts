import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { type ProspectsFilterType, prospectsApi } from '../lib/api'

export function useProspects(filters?: ProspectsFilterType) {
  return useQuery({
    queryKey: queryKeys.prospects.list(filters),
    queryFn: () => prospectsApi.list(filters),
  })
}
