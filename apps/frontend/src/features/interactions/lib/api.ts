import type {
  CreateInteractionPayload,
  InteractionListResponse,
  InteractionsFilterType,
  InteractionType,
} from '@battlecrm/shared'
import { fetchApi } from '@/lib/api'

export const interactionsApi = {
  list(filters?: InteractionsFilterType): Promise<InteractionListResponse> {
    const params = new URLSearchParams()
    if (filters?.prospect_id) params.set('prospect_id', filters.prospect_id)
    if (filters?.positioning_id) params.set('positioning_id', filters.positioning_id)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.funnel_stage_id) params.set('funnel_stage_id', filters.funnel_stage_id)
    const qs = params.toString()
    return fetchApi<InteractionListResponse>(`/interactions${qs ? `?${qs}` : ''}`)
  },
  create(payload: CreateInteractionPayload): Promise<InteractionType> {
    return fetchApi<InteractionType>('/interactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
