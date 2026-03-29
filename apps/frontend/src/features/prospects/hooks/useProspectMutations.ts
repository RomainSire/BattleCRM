import type {
  CreateProspectPayload,
  ProspectsListResponse,
  UpdateProspectPayload,
} from '@battlecrm/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { prospectsApi } from '../lib/api'

export function useCreateProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateProspectPayload) => prospectsApi.create(payload),
    onSuccess: () => {
      // New prospect only affects the list (no detail exists yet)
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.list() })
    },
  })
}

export function useUpdateProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateProspectPayload) =>
      prospectsApi.update(id, payload),
    onSuccess: (updated, { id }) => {
      // Inject updated data directly — no refetch needed.
      queryClient.setQueryData(queryKeys.prospects.detail(id), updated)
      queryClient.setQueriesData<ProspectsListResponse>(
        { queryKey: queryKeys.prospects.list() },
        (old) => (old ? { ...old, data: old.data.map((p) => (p.id === id ? updated : p)) } : old),
      )
    },
  })
}

export function useArchiveProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => prospectsApi.archive(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.detail(id) })
    },
  })
}

export function useRestoreProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => prospectsApi.restore(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.detail(id) })
    },
  })
}
