export type ProspectPositioningType = {
  id: string
  userId: string
  prospectId: string
  positioningId: string
  funnelStageId: string
  outcome: 'success' | 'failed' | null
  createdAt: string // ISO 8601
}

// Enriched response for GET /api/prospects/:id/positionings
export type ProspectPositioningDetailType = {
  id: string
  positioningId: string
  positioningName: string // from preloaded positioning
  funnelStageId: string
  funnelStageName: string // positioning.funnelStage.name, or 'Stage supprimé' if soft-deleted
  outcome: 'success' | 'failed' | null
  createdAt: string // ISO 8601
  isActive: boolean // pp.funnelStageId === prospect.funnelStageId
}

// Response item for GET /api/positionings/:id/prospects
export type PositioningLinkedProspectType = {
  id: string // prospect.id
  name: string // prospect.name
  funnelStageId: string // pp.funnel_stage_id (the assignment's stage)
  outcome: 'success' | 'failed' | null
  createdAt: string // pp.createdAt ISO 8601
  isActive: boolean // pp.funnelStageId === prospect.funnelStageId
  deletedAt: string | null // prospect.deletedAt — for archived prospects
}
