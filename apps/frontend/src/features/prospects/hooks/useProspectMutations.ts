import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { type CreateProspectPayload, prospectsApi, type UpdateProspectPayload } from '../lib/api'

export function useCreateProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateProspectPayload) => prospectsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.all })
    },
  })
}

export function useUpdateProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateProspectPayload) =>
      prospectsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.all })
    },
  })
}
