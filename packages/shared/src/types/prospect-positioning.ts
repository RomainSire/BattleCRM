export type ProspectPositioningType = {
  id: string
  userId: string
  prospectId: string
  positioningId: string
  funnelStageId: string
  outcome: 'success' | 'failed' | null
  createdAt: string // ISO 8601
}
