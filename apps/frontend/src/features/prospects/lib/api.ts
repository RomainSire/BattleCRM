import { fetchApi } from '@/lib/api'

// ⚠️ CRITICAL: All fields are camelCase — Lucid v3 default serialization
// Architecture doc says snake_case but actual API returns camelCase (known divergence from Story 3.2)
export type ProspectType = {
  id: string
  userId: string
  name: string
  company: string | null
  linkedinUrl: string | null
  email: string | null
  phone: string | null
  title: string | null
  notes: string | null
  funnelStageId: string
  positioningId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type ProspectsListResponseType = {
  data: ProspectType[]
  meta: { total: number }
}

// snake_case because these are URL query params (API spec)
export type ProspectsFilterType = {
  funnel_stage_id?: string
  include_archived?: boolean
}

// snake_case because these are POST/PUT request body fields (AdonisJS validator convention)
export type CreateProspectPayload = {
  name: string
  funnel_stage_id?: string
  company?: string | null
  linkedin_url?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  notes?: string | null
}

export type UpdateProspectPayload = {
  name?: string
  funnel_stage_id?: string
  company?: string | null
  linkedin_url?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  notes?: string | null
}

// ⚠️ camelCase — Lucid v3 default serialization (same divergence as ProspectType)
export type StageTransitionType = {
  id: string
  fromStageId: string | null
  fromStageName: string | null
  toStageId: string
  toStageName: string
  transitionedAt: string
}

export type StageTransitionsResponseType = {
  data: StageTransitionType[]
}

export const prospectsApi = {
  list(filters?: ProspectsFilterType): Promise<ProspectsListResponseType> {
    const params = new URLSearchParams()
    if (filters?.funnel_stage_id) {
      params.set('funnel_stage_id', filters.funnel_stage_id)
    }
    if (filters?.include_archived) {
      params.set('include_archived', 'true')
    }
    const queryString = params.toString()
    return fetchApi<ProspectsListResponseType>(`/prospects${queryString ? `?${queryString}` : ''}`)
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

  get(id: string): Promise<ProspectType> {
    return fetchApi<ProspectType>(`/prospects/${id}`)
  },

  stageTransitions(id: string): Promise<StageTransitionsResponseType> {
    return fetchApi<StageTransitionsResponseType>(`/prospects/${id}/stage-transitions`)
  },
}
