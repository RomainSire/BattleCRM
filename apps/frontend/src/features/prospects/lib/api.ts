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
}
