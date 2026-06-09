import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { battlesApi } from '../lib/api'

export function useCancelBattle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => battlesApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.battles.all })
    },
  })
}
