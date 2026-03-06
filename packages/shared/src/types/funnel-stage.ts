export type FunnelStageType = {
  id: string
  userId: string
  name: string
  position: number
  prospectCount: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type FunnelStageListResponse = {
  data: FunnelStageType[]
  meta: { total: number }
}
