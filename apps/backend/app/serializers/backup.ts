import type {
  BackupBattle,
  BackupData,
  BackupEnvelope,
  BackupFunnelStage,
  BackupInteraction,
  BackupPositioning,
  BackupProspect,
  BackupProspectPositioning,
  BackupProspectStageTransition,
} from '@battlecrm/shared'
import type Battle from '#models/battle'
import type FunnelStage from '#models/funnel_stage'
import type Interaction from '#models/interaction'
import type Positioning from '#models/positioning'
import type Prospect from '#models/prospect'
import type ProspectPositioning from '#models/prospect_positioning'
import type ProspectStageTransition from '#models/prospect_stage_transition'
import type User from '#models/user'

// Format & version littéraux de l'enveloppe — source de vérité runtime côté backend
// (le package partagé est types-only, cf. packages/shared/src/types/backup.ts).
export const BACKUP_FORMAT = 'battlecrm-backup' as const
export const BACKUP_VERSION = 1 as const

// Chaque map* retire `userId` (re-forcé à l'import) et formate les dates en ISO 8601 UTC.

function serializeFunnelStage(stage: FunnelStage): BackupFunnelStage {
  return {
    id: stage.id,
    name: stage.name,
    position: stage.position,
    createdAt: stage.createdAt.toUTC().toISO()!,
    updatedAt: stage.updatedAt?.toUTC().toISO() ?? null,
    deletedAt: stage.deletedAt?.toUTC().toISO() ?? null,
  }
}

function serializeProspect(prospect: Prospect): BackupProspect {
  return {
    id: prospect.id,
    funnelStageId: prospect.funnelStageId,
    name: prospect.name,
    company: prospect.company,
    linkedinUrl: prospect.linkedinUrl,
    email: prospect.email,
    phone: prospect.phone,
    title: prospect.title,
    notes: prospect.notes,
    createdAt: prospect.createdAt.toUTC().toISO()!,
    updatedAt: prospect.updatedAt?.toUTC().toISO() ?? null,
    deletedAt: prospect.deletedAt?.toUTC().toISO() ?? null,
  }
}

function serializePositioning(positioning: Positioning): BackupPositioning {
  return {
    id: positioning.id,
    funnelStageId: positioning.funnelStageId,
    name: positioning.name,
    description: positioning.description,
    content: positioning.content,
    createdAt: positioning.createdAt.toUTC().toISO()!,
    updatedAt: positioning.updatedAt?.toUTC().toISO() ?? null,
    deletedAt: positioning.deletedAt?.toUTC().toISO() ?? null,
  }
}

function serializeStageTransition(t: ProspectStageTransition): BackupProspectStageTransition {
  return {
    id: t.id,
    prospectId: t.prospectId,
    fromStageId: t.fromStageId,
    toStageId: t.toStageId,
    transitionedAt: t.transitionedAt.toUTC().toISO()!,
    createdAt: t.createdAt.toUTC().toISO()!,
  }
}

function serializeProspectPositioning(pp: ProspectPositioning): BackupProspectPositioning {
  return {
    id: pp.id,
    prospectId: pp.prospectId,
    positioningId: pp.positioningId,
    funnelStageId: pp.funnelStageId,
    outcome: pp.outcome,
    createdAt: pp.createdAt.toUTC().toISO()!,
  }
}

function serializeInteraction(interaction: Interaction): BackupInteraction {
  return {
    id: interaction.id,
    prospectId: interaction.prospectId,
    positioningId: interaction.positioningId,
    funnelStageId: interaction.funnelStageId,
    notes: interaction.notes,
    interactionDate: interaction.interactionDate.toUTC().toISO()!,
    createdAt: interaction.createdAt.toUTC().toISO()!,
    updatedAt: interaction.updatedAt?.toUTC().toISO() ?? null,
  }
}

function serializeBattle(battle: Battle): BackupBattle {
  return {
    id: battle.id,
    funnelStageId: battle.funnelStageId,
    variantAId: battle.variantAId,
    variantBId: battle.variantBId,
    battleNumber: battle.battleNumber,
    status: battle.status,
    winnerId: battle.winnerId,
    startedAt: battle.startedAt.toUTC().toISO()!,
    closedAt: battle.closedAt?.toUTC().toISO() ?? null,
    createdAt: battle.createdAt.toUTC().toISO()!,
    updatedAt: battle.updatedAt?.toUTC().toISO() ?? null,
  }
}

export type BackupModels = {
  funnelStages: FunnelStage[]
  prospects: Prospect[]
  positionings: Positioning[]
  prospectStageTransitions: ProspectStageTransition[]
  prospectPositionings: ProspectPositioning[]
  interactions: Interaction[]
  battles: Battle[]
}

function serializeData(models: BackupModels): BackupData {
  return {
    funnelStages: models.funnelStages.map(serializeFunnelStage),
    prospects: models.prospects.map(serializeProspect),
    positionings: models.positionings.map(serializePositioning),
    prospectStageTransitions: models.prospectStageTransitions.map(serializeStageTransition),
    prospectPositionings: models.prospectPositionings.map(serializeProspectPositioning),
    interactions: models.interactions.map(serializeInteraction),
    battles: models.battles.map(serializeBattle),
  }
}

export function serializeBackup(user: User, models: BackupModels): BackupEnvelope {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    account: {
      email: user.email,
      createdAt: user.createdAt.toUTC().toISO()!,
    },
    data: serializeData(models),
  }
}
