import type {
  CreateInteractionPayload,
  InteractionListResponse,
  UpdateInteractionPayload,
} from '@battlecrm/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { interactionsApi } from '../lib/api'

export function useCreateInteraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateInteractionPayload) => interactionsApi.create(payload),
    onSuccess: () => {
      // queryKeys.interactions.list() prefix-matches all filter variants
      queryClient.invalidateQueries({ queryKey: queryKeys.interactions.list() })
    },
  })
}

export function useUpdateInteraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateInteractionPayload }) =>
      interactionsApi.update(id, payload),
    onSuccess: (updated, { id }) => {
      // Inject updated data directly into all interaction list variants
      queryClient.setQueriesData<InteractionListResponse>(
        { queryKey: queryKeys.interactions.list() },
        (old) => (old ? { ...old, data: old.data.map((i) => (i.id === id ? updated : i)) } : old),
      )
    },
  })
}

export function useDeleteInteraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => interactionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interactions.list() })
    },
  })
}
