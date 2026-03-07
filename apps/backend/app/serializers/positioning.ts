import type { PositioningType } from '@battlecrm/shared'
import type Positioning from '#models/positioning'

export function serializePositioning(positioning: Positioning): PositioningType {
  if (!positioning.funnelStage) {
    throw new Error(
      'serializePositioning: funnelStage relation must be preloaded before serializing',
    )
  }
  return {
    id: positioning.id,
    userId: positioning.userId,
    funnelStageId: positioning.funnelStageId,
    funnelStageName: positioning.funnelStage.name,
    name: positioning.name,
    description: positioning.description,
    content: positioning.content,
    createdAt: positioning.createdAt.toISO()!,
    updatedAt: positioning.updatedAt?.toISO() ?? null,
    deletedAt: positioning.deletedAt?.toISO() ?? null,
  }
}
