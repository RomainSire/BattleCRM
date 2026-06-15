import type {
  CreatePositioningPayload,
  MessageResponse,
  PositioningLinkedProspectsResponse,
  PositioningListResponse,
  PositioningsFilterType,
  PositioningType,
  UpdatePositioningPayload,
} from '@battlecrm/shared'
import { fetchApi } from '@/lib/api'

export const positioningsApi = {
  get(id: string): Promise<PositioningType> {
    return fetchApi<PositioningType>(`/positionings/${id}`)
  },

  list(filters?: PositioningsFilterType): Promise<PositioningListResponse> {
    const params = new URLSearchParams()
    if (filters?.funnel_stage_id) {
      params.set('funnel_stage_id', filters.funnel_stage_id)
    }
    if (filters?.include_archived) {
      params.set('include_archived', 'true')
    }
    const queryString = params.toString()
    return fetchApi<PositioningListResponse>(`/positionings${queryString ? `?${queryString}` : ''}`)
  },

  prospects(id: string): Promise<PositioningLinkedProspectsResponse> {
    return fetchApi<PositioningLinkedProspectsResponse>(`/positionings/${id}/prospects`)
  },

  create(payload: CreatePositioningPayload): Promise<PositioningType> {
    return fetchApi<PositioningType>('/positionings', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  update(id: string, payload: UpdatePositioningPayload): Promise<PositioningType> {
    return fetchApi<PositioningType>(`/positionings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  archive(id: string): Promise<MessageResponse> {
    return fetchApi<MessageResponse>(`/positionings/${id}`, {
      method: 'DELETE',
    })
  },

  restore(id: string): Promise<PositioningType> {
    return fetchApi<PositioningType>(`/positionings/${id}/restore`, {
      method: 'PATCH',
    })
  },
}
