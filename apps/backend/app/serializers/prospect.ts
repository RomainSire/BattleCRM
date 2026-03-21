import type { ProspectType, StageTransitionType } from '@battlecrm/shared'
import type Prospect from '#models/prospect'
import type ProspectStageTransition from '#models/prospect_stage_transition'

export function serializeProspect(prospect: Prospect): ProspectType {
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
