import type { CreateInteractionPayload } from '@battlecrm/shared'
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
