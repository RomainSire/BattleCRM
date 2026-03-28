import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { prospectsApi } from '../lib/api'

export function useAssignPositioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ prospectId, positioningId }: { prospectId: string; positioningId: string }) =>
      prospectsApi.assignPositioning(prospectId, positioningId),
    onSuccess: () => {
      // Refresh all prospect data — activePositioning changes after assign
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.all })
    },
  })
}

export function useSetPositioningOutcome() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      prospectId,
      outcome,
      stageId,
    }: {
      prospectId: string
      outcome: 'success' | 'failed'
      stageId?: string
    }) => prospectsApi.setPositioningOutcome(prospectId, outcome, stageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.all })
    },
  })
}
