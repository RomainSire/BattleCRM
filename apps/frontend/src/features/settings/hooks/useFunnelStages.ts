import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { funnelStagesApi } from '../lib/api'

export function useFunnelStages() {
  return useQuery({
    queryKey: queryKeys.funnelStages.list(),
    queryFn: () => funnelStagesApi.list(),
    staleTime: 10 * 60 * 1000,
  })
}

export function useCreateFunnelStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => funnelStagesApi.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.funnelStages.list() })
    },
  })
}

export function useUpdateFunnelStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => funnelStagesApi.update(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.funnelStages.list() })
    },
  })
}

export function useDeleteFunnelStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => funnelStagesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.funnelStages.list() })
    },
  })
}

export function useReorderFunnelStages() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (order: string[]) => funnelStagesApi.reorder(order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.funnelStages.list() })
    },
  })
}
