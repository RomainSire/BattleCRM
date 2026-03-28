import type {
  CreateProspectPayload,
  ProspectPositioningDetailType,
  ProspectPositioningType,
  ProspectsFilterType,
  ProspectsListResponse,
  ProspectType,
  StageTransitionsResponse,
  UpdateProspectPayload,
} from '@battlecrm/shared'
// ⚠️ CRITICAL: All response fields are camelCase — Lucid v3 default serialization
// Architecture doc says snake_case but actual API returns camelCase (known divergence from Story 3.2)
import { fetchApi } from '@/lib/api'

export const prospectsApi = {
  list(filters?: ProspectsFilterType): Promise<ProspectsListResponse> {
    const params = new URLSearchParams()
    if (filters?.funnel_stage_id) {
      params.set('funnel_stage_id', filters.funnel_stage_id)
    }
    if (filters?.include_archived) {
      params.set('include_archived', 'true')
    }
    const queryString = params.toString()
    return fetchApi<ProspectsListResponse>(`/prospects${queryString ? `?${queryString}` : ''}`)
  },

  get(id: string): Promise<ProspectType> {
    return fetchApi<ProspectType>(`/prospects/${id}`)
  },

  create(payload: CreateProspectPayload): Promise<ProspectType> {
    return fetchApi<ProspectType>('/prospects', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  update(id: string, payload: UpdateProspectPayload): Promise<ProspectType> {
    return fetchApi<ProspectType>(`/prospects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  archive(id: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/prospects/${id}`, {
      method: 'DELETE',
    })
  },

  restore(id: string): Promise<ProspectType> {
    return fetchApi<ProspectType>(`/prospects/${id}/restore`, {
      method: 'PATCH',
    })
  },

  stageTransitions(id: string): Promise<StageTransitionsResponse> {
    return fetchApi<StageTransitionsResponse>(`/prospects/${id}/stage-transitions`)
  },

  positionings(
    id: string,
  ): Promise<{ data: ProspectPositioningDetailType[]; meta: { total: number } }> {
    return fetchApi(`/prospects/${id}/positionings`)
  },

  assignPositioning(id: string, positioningId: string): Promise<ProspectPositioningType> {
    return fetchApi(`/prospects/${id}/positionings`, {
      method: 'POST',
      body: JSON.stringify({ positioning_id: positioningId }),
    })
  },

  setPositioningOutcome(
    id: string,
    outcome: 'success' | 'failed',
    stageId?: string,
  ): Promise<ProspectPositioningType> {
    return fetchApi(`/prospects/${id}/positionings/current/outcome`, {
      method: 'PATCH',
      body: JSON.stringify({ outcome, ...(stageId && { stage_id: stageId }) }),
    })
  },
}
