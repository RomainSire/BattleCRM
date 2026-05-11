import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { battlesApi } from '../lib/api'

export function useCloseBattle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, winner_id }: { id: string; winner_id: string }) =>
      battlesApi.close(id, { winner_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.battles.all })
    },
  })
}
