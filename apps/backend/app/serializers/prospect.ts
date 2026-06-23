import type { ProspectType, StageTransitionType } from '@battlecrm/shared'
import { DateTime } from 'luxon'
import Interaction from '#models/interaction'
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
  lastInteractionAt: string | null = null,
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
    neededRole: prospect.neededRole,
    notes: prospect.notes,
    funnelStageId: prospect.funnelStageId,
    lastInteractionAt,
    createdAt: prospect.createdAt.toUTC().toISO()!,
    updatedAt: prospect.updatedAt?.toUTC().toISO() ?? prospect.createdAt.toUTC().toISO()!,
    deletedAt: prospect.deletedAt?.toUTC().toISO() ?? null,
    activePositioning,
  }
}

/**
 * Load the most recent interaction date for a single prospect (MAX(interaction_date)).
 * Returns an ISO UTC string, or null if the prospect has no interactions.
 * Always scoped by user_id for isolation.
 */
export async function loadLastInteractionAt(
  userId: string,
  prospectId: string,
): Promise<string | null> {
  const row = await Interaction.query()
    .where('user_id', userId)
    .where('prospect_id', prospectId)
    .max('interaction_date as last_at')
    .first()

  const lastAt = row?.$extras.last_at
  if (!lastAt) return null
  return DateTime.fromJSDate(new Date(lastAt)).toUTC().toISO()!
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
    transitionedAt: t.transitionedAt.toUTC().toISO()!,
  }
}
