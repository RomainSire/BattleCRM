import type { InteractionType } from '@battlecrm/shared'
import type Interaction from '#models/interaction'
import type Positioning from '#models/positioning'

export function serializeInteraction(interaction: Interaction): InteractionType {
  if (!interaction.prospect) {
    throw new Error(
      'serializeInteraction: prospect relation must be preloaded (use withTrashed if prospect may be archived)',
    )
  }
  const positioning = interaction.positioning as Positioning | undefined
  return {
    id: interaction.id,
    userId: interaction.userId,
    prospectId: interaction.prospectId,
    prospectName: interaction.prospect.name,
    prospectFunnelStageId: interaction.prospect.funnelStageId,
    prospectFunnelStageName: interaction.prospect.funnelStage?.name ?? '',
    positioningId: interaction.positioningId,
    positioningName: positioning?.name ?? null,
    status: interaction.status,
    notes: interaction.notes,
    interactionDate: interaction.interactionDate.toISO()!,
    createdAt: interaction.createdAt.toISO()!,
    updatedAt: interaction.updatedAt?.toISO() ?? null,
    deletedAt: interaction.deletedAt?.toISO() ?? null,
  }
}
