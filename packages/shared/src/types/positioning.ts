export type PositioningType = {
  id: string
  userId: string
  funnelStageId: string
  funnelStageName: string
  name: string
  description: string | null
  content: string | null
  createdAt: string
  updatedAt: string | null
  deletedAt: string | null
}

export type PositioningListResponse = {
  data: PositioningType[]
  meta: { total: number }
}

// NOTE: These payload types are preemptive for Story 4.2 (CRUD API).
// They live here so the frontend can import them without waiting for the API story.
export type CreatePositioningPayload = {
  funnel_stage_id: string
  name: string
  description?: string | null
  content?: string | null
}

export type UpdatePositioningPayload = {
  name?: string
  funnel_stage_id?: string
  description?: string | null
  content?: string | null
}

export type PositioningsFilterType = {
  funnel_stage_id?: string
  include_archived?: true
}
