import type {
  PositioningLinkedProspectType,
  ProspectPositioningDetailType,
  ProspectPositioningType,
} from '@battlecrm/shared'
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

// For GET /api/prospects/:id/positionings — requires positioning and funnelStage preloaded
export function serializeProspectPositioningDetail(
  pp: ProspectPositioning,
  prospectFunnelStageId: string,
): ProspectPositioningDetailType {
  if (!pp.positioning) {
    throw new Error('serializeProspectPositioningDetail: positioning relation must be preloaded')
  }
  return {
    id: pp.id,
    positioningId: pp.positioningId,
    positioningName: pp.positioning.name,
    funnelStageId: pp.funnelStageId,
    funnelStageName: pp.funnelStage?.name ?? 'Stage supprimé',
    outcome: pp.outcome,
    createdAt: pp.createdAt.toISO()!,
    isActive: pp.funnelStageId === prospectFunnelStageId,
  }
}

// For GET /api/positionings/:id/prospects — requires prospect preloaded (withTrashed)
export function serializePositioningLinkedProspect(
  pp: ProspectPositioning,
): PositioningLinkedProspectType {
  if (!pp.prospect) {
    throw new Error(
      'serializePositioningLinkedProspect: prospect relation must be preloaded (use withTrashed)',
    )
  }
  return {
    id: pp.prospect.id,
    name: pp.prospect.name,
    funnelStageId: pp.funnelStageId,
    outcome: pp.outcome,
    createdAt: pp.createdAt.toISO()!,
    isActive: pp.funnelStageId === pp.prospect.funnelStageId,
    deletedAt: pp.prospect.deletedAt?.toISO() ?? null,
  }
}
