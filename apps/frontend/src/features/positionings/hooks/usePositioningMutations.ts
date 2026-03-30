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
      // Inject updated data directly into all positionings list variants
      queryClient.setQueriesData<PositioningListResponse>(
        { queryKey: queryKeys.positionings.list() },
        (old) => (old ? { ...old, data: old.data.map((p) => (p.id === id ? updated : p)) } : old),
      )
      // Positioning name is embedded in prospect.activePositioning.positioningName —
      // patching every affected prospect is complex; a targeted refetch is simpler here.
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.list() })
    },
  })
}

export function useArchivePositioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => positioningsApi.archive(id),
    onSuccess: () => {
      // Archiving a positioning sets outcome='failed' on related prospect_positionings →
      // activePositioning changes for affected prospects.
      queryClient.invalidateQueries({ queryKey: queryKeys.positionings.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.list() })
    },
  })
}

export function useRestorePositioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => positioningsApi.restore(id),
    onSuccess: () => {
      // Restoring a positioning does not re-assign it to prospects → no prospect impact
      queryClient.invalidateQueries({ queryKey: queryKeys.positionings.list() })
    },
  })
}
