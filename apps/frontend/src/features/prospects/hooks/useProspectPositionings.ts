import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { prospectsApi } from '../lib/api'

export function useProspectPositionings(prospectId: string) {
  return useQuery({
    queryKey: queryKeys.prospects.positionings(prospectId),
    queryFn: () => prospectsApi.positionings(prospectId),
  })
}
