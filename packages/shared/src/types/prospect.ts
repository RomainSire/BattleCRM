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
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  activePositioning: {
    positioningId: string
    positioningName: string
    outcome: 'success' | 'failed' | null
  } | null
}

export type ProspectsListResponse = {
  data: ProspectType[]
  meta: { total: number }
}

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

export type StageTransitionType = {
  id: string
  fromStageId: string | null
  fromStageName: string | null
  toStageId: string
  toStageName: string
  transitionedAt: string
}

export type StageTransitionsResponse = {
  data: StageTransitionType[]
}

export type ProspectsFilterType = {
  funnel_stage_id?: string
  include_archived?: boolean
}
