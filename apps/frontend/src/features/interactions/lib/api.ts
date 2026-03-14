import type { CreateInteractionPayload, InteractionType } from '@battlecrm/shared'
import { fetchApi } from '@/lib/api'

export const interactionsApi = {
  create(payload: CreateInteractionPayload): Promise<InteractionType> {
    return fetchApi<InteractionType>('/interactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
