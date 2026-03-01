import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { prospectsApi } from '../lib/api'

export function useProspectStageTransitions(prospectId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.prospects.stageTransitions(prospectId),
    queryFn: () => prospectsApi.stageTransitions(prospectId),
    enabled: options?.enabled ?? true,
  })
}
