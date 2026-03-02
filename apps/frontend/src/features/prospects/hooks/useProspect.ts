import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { prospectsApi } from '../lib/api'

export function useProspect(id: string) {
  return useQuery({
    queryKey: queryKeys.prospects.detail(id),
    queryFn: () => prospectsApi.get(id),
  })
}
