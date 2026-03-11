import type { CreatePositioningPayload, UpdatePositioningPayload } from '@battlecrm/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { positioningsApi } from '../lib/api'

export function useCreatePositioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePositioningPayload) => positioningsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.positionings.all })
    },
  })
}

export function useUpdatePositioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdatePositioningPayload) =>
      positioningsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.positionings.all })
    },
  })
}

export function useArchivePositioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => positioningsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.positionings.all })
    },
  })
}
