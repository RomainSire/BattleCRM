export type BattleStatus = 'active' | 'closed'

export type BattleType = {
  id: string
  userId: string
  funnelStageId: string
  variantAId: string
  variantBId: string
  battleNumber: number
  status: BattleStatus
  winnerId: string | null
  startedAt: string
  closedAt: string | null
  createdAt: string
  updatedAt: string | null
}

// Response wrapper for GET /api/battles (no meta envelope)
export type BattleListResponse = {
  data: BattleType[]
}
