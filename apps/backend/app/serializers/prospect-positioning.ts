import type { ProspectPositioningType } from '@battlecrm/shared'
import type ProspectPositioning from '#models/prospect_positioning'

export function serializeProspectPositioning(pp: ProspectPositioning): ProspectPositioningType {
  return {
    id: pp.id,
    userId: pp.userId,
    prospectId: pp.prospectId,
    positioningId: pp.positioningId,
    funnelStageId: pp.funnelStageId,
    outcome: pp.outcome,
    createdAt: pp.createdAt.toISO()!,
  }
}
