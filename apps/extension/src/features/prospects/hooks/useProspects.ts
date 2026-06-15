import type {
  ExtensionCreateProspectPayload,
  ExtensionUpdateProspectPayload,
} from '@battlecrm/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../../lib/queryKeys'
import { prospectsApi } from '../lib/api'

export function useCheckProspect(linkedinUrl: string | null) {
  return useQuery({
    queryKey: queryKeys.prospects.check(linkedinUrl ?? ''),
    queryFn: () => prospectsApi.check(linkedinUrl!),
    enabled: !!linkedinUrl,
  })
}

export function useCreateProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ExtensionCreateProspectPayload) => prospectsApi.create(payload),
    onSuccess: (_data, { linkedin_url }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prospects.check(linkedin_url) })
    },
  })
}

export function useUpdateProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & ExtensionUpdateProspectPayload) =>
      prospectsApi.update(id, payload),
    onSuccess: (updated) => {
      if (updated.linkedinUrl) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.prospects.check(updated.linkedinUrl),
        })
      }
    },
  })
}
