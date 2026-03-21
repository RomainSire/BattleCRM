import type {
  CreateInteractionPayload,
  InteractionListResponse,
  InteractionsFilterType,
  InteractionType,
  UpdateInteractionPayload,
} from '@battlecrm/shared'
import { fetchApi } from '@/lib/api'

export const interactionsApi = {
  list(filters?: InteractionsFilterType): Promise<InteractionListResponse> {
    const params = new URLSearchParams()
    if (filters?.prospect_id) params.set('prospect_id', filters.prospect_id)
    if (filters?.positioning_id) params.set('positioning_id', filters.positioning_id)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.funnel_stage_id) params.set('funnel_stage_id', filters.funnel_stage_id)
    if (filters?.include_archived) params.set('include_archived', 'true')
    const qs = params.toString()
    return fetchApi<InteractionListResponse>(`/interactions${qs ? `?${qs}` : ''}`)
  },
  create(payload: CreateInteractionPayload): Promise<InteractionType> {
    return fetchApi<InteractionType>('/interactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  update(id: string, payload: UpdateInteractionPayload): Promise<InteractionType> {
    return fetchApi<InteractionType>(`/interactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
  archive(id: string): Promise<void> {
    return fetchApi<void>(`/interactions/${id}`, { method: 'DELETE' })
  },
  restore(id: string): Promise<InteractionType> {
    return fetchApi<InteractionType>(`/interactions/${id}/restore`, { method: 'PATCH' })
  },
}
