import type { CreateInteractionPayload, UpdateInteractionPayload } from '@battlecrm/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { interactionsApi } from '../lib/api'

export function useCreateInteraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateInteractionPayload) => interactionsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interactions.all })
    },
  })
}

export function useUpdateInteraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateInteractionPayload }) =>
      interactionsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interactions.all })
    },
  })
}

export function useArchiveInteraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => interactionsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interactions.all })
    },
  })
}

export function useRestoreInteraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => interactionsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interactions.all })
    },
  })
}
