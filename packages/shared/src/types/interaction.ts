export type InteractionStatus = 'positive' | 'pending' | 'negative'

export type InteractionType = {
  id: string
  userId: string
  prospectId: string
  prospectName: string
  prospectFunnelStageId: string
  prospectFunnelStageName: string
  positioningId: string | null
  positioningName: string | null
  status: InteractionStatus
  notes: string | null
  interactionDate: string // ISO 8601
  createdAt: string
  updatedAt: string | null
  deletedAt: string | null
}

export type InteractionListResponse = {
  data: InteractionType[]
  meta: { total: number }
}

export type CreateInteractionPayload = {
  prospect_id: string
  positioning_id?: string | null
  status: InteractionStatus
  notes?: string | null
  interaction_date?: string // ISO 8601 ; defaults to now() if absent
}

export type UpdateInteractionPayload = {
  status?: InteractionStatus
  notes?: string | null
  positioning_id?: string | null
  interaction_date?: string
}

export type InteractionsFilterType = {
  prospect_id?: string
  positioning_id?: string
  status?: InteractionStatus
  funnel_stage_id?: string
  include_archived?: boolean
}
