import type { FunnelStageType } from '@battlecrm/shared'
import type FunnelStage from '#models/funnel_stage'

export function serializeFunnelStage(stage: FunnelStage): FunnelStageType {
  return {
    id: stage.id,
    userId: stage.userId,
    name: stage.name,
    position: stage.position,
    prospectCount: Number(stage.$extras.prospects_count ?? 0),
    createdAt: stage.createdAt.toUTC().toISO()!,
    updatedAt: stage.updatedAt?.toUTC().toISO() ?? stage.createdAt.toUTC().toISO()!,
    deletedAt: stage.deletedAt?.toUTC().toISO() ?? null,
  }
}
