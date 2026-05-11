import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { battlesApi } from '../lib/api'

export function useStartBattle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { funnel_stage_id: string; variant_a_id: string; variant_b_id: string }) =>
      battlesApi.start(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.battles.all })
    },
  })
}
