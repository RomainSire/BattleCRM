import type { ProspectType, StageTransitionType } from '@battlecrm/shared'
import type Prospect from '#models/prospect'
import ProspectPositioning from '#models/prospect_positioning'
import type ProspectStageTransition from '#models/prospect_stage_transition'

type ActivePositioningData = {
  positioningId: string
  positioningName: string
  outcome: 'success' | 'failed' | null
} | null

export function serializeProspect(
  prospect: Prospect,
  activePositioning: ActivePositioningData = null,
): ProspectType {
  return {
    id: prospect.id,
    userId: prospect.userId,
    name: prospect.name,
    company: prospect.company,
    linkedinUrl: prospect.linkedinUrl,
    email: prospect.email,
    phone: prospect.phone,
    title: prospect.title,
    notes: prospect.notes,
    funnelStageId: prospect.funnelStageId,
    createdAt: prospect.createdAt.toISO()!,
    updatedAt: prospect.updatedAt?.toISO() ?? prospect.createdAt.toISO()!,
    deletedAt: prospect.deletedAt?.toISO() ?? null,
    activePositioning,
  }
}

/**
 * Load the active positioning for a single prospect.
 * Active = the prospect_positionings record whose funnel_stage_id matches prospect.funnelStageId.
 */
export async function loadActivePositioning(
  userId: string,
  prospect: Prospect,
): Promise<ActivePositioningData> {
  const pp = await ProspectPositioning.query()
    .where('user_id', userId)
    .where('prospect_id', prospect.id)
    .where('funnel_stage_id', prospect.funnelStageId)
    .preload('positioning', (q) => q.withTrashed())
    .first()

  if (!pp) return null

  return {
    positioningId: pp.positioningId,
    positioningName: pp.positioning.name,
    outcome: pp.outcome,
  }
}

export function serializeTransition(t: ProspectStageTransition): StageTransitionType {
  return {
    id: t.id,
    fromStageId: t.fromStageId,
    fromStageName: t.fromStage?.name ?? null,
    toStageId: t.toStageId,
    toStageName: t.toStage?.name ?? 'Unknown stage',
    transitionedAt: t.transitionedAt.toISO()!,
  }
}
