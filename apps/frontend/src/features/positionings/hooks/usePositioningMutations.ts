import type {
  CreatePositioningPayload,
  PositioningListResponse,
  UpdatePositioningPayload,
} from '@battlecrm/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { positioningsApi } from '../lib/api'

export function useCreatePositioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePositioningPayload) => positioningsApi.create(payload),
    onSuccess: () => {
      // New positioning only affects the positionings list
      queryClient.invalidateQueries({ queryKey: queryKeys.positionings.list() })
    },
  })
}

export function useUpdatePositioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdatePositioningPayload) =>
      positioningsApi.update(id, payload),
    onSuccess: (updated, { id }) => {
      queryClient.setQueriesData<PositioningListResponse>(
        { queryKey: queryKeys.positionings.list() },
        (old) => (old ? { ...old, data: old.data.map((p) => (p.id === id ? updated : p)) } : old),
      )
      queryClient.setQueryData(queryKeys.positionings.detail(id), updated)
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.list() })
    },
  })
}

export function useArchivePositioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => positioningsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.positionings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.list() })
    },
  })
}

export function useRestorePositioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => positioningsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.positionings.all })
    },
  })
}
