export type PositioningType = {
  id: string
  userId: string
  funnelStageId: string
  name: string
  description: string | null
  content: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type PositioningListResponse = {
  data: PositioningType[]
  meta: { total: number }
}

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
