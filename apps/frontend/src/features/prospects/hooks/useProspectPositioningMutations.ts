import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { prospectsApi } from '../lib/api'

export function useAssignPositioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ prospectId, positioningId }: { prospectId: string; positioningId: string }) =>
      prospectsApi.assignPositioning(prospectId, positioningId),
    onSuccess: (_, { prospectId }) => {
      // list: activePositioning icon changes; detail: positioning section changes;
      // positionings(id): positioning history gains a new entry.
      // stage-transitions: NOT invalidated (assign doesn't move stages).
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.detail(prospectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.positionings(prospectId) })
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
    onSuccess: (_, { prospectId }) => {
      // Same scope as assign: outcome change is visible in list icon + detail + history.
      // stage-transitions: NOT invalidated (outcome doesn't move stages).
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.detail(prospectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.positionings(prospectId) })
    },
  })
}
