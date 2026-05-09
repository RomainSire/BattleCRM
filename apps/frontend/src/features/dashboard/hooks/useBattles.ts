import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { battlesApi } from '../lib/api'

export function useBattles() {
  return useQuery({
    queryKey: queryKeys.battles.list(),
    queryFn: () => battlesApi.list(),
    staleTime: 10 * 60 * 1000,
  })
}
