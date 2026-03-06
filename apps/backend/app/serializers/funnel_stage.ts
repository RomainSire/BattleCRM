import type { FunnelStageType } from '@battlecrm/shared'
import type FunnelStage from '#models/funnel_stage'

export function serializeFunnelStage(stage: FunnelStage): FunnelStageType {
  return {
    id: stage.id,
    userId: stage.userId,
    name: stage.name,
    position: stage.position,
    prospectCount: Number(stage.$extras.prospects_count ?? 0),
    createdAt: stage.createdAt.toISO()!,
    updatedAt: stage.updatedAt?.toISO() ?? stage.createdAt.toISO()!,
    deletedAt: stage.deletedAt?.toISO() ?? null,
  }
}
