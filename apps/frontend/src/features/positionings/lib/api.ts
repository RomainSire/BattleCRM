import type {
  CreatePositioningPayload,
  PositioningListResponse,
  PositioningsFilterType,
  PositioningType,
  ProspectsListResponse,
  UpdatePositioningPayload,
} from '@battlecrm/shared'
import { fetchApi } from '@/lib/api'

export const positioningsApi = {
  list(filters?: PositioningsFilterType): Promise<PositioningListResponse> {
    const params = new URLSearchParams()
    if (filters?.funnel_stage_id) {
      params.set('funnel_stage_id', filters.funnel_stage_id)
    }
    const queryString = params.toString()
    return fetchApi<PositioningListResponse>(`/positionings${queryString ? `?${queryString}` : ''}`)
  },

  prospects(id: string): Promise<ProspectsListResponse> {
    return fetchApi<ProspectsListResponse>(`/positionings/${id}/prospects`)
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
}
