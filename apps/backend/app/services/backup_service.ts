import type { BackupEnvelope } from '@battlecrm/shared'
import Battle from '#models/battle'
import FunnelStage from '#models/funnel_stage'
import Interaction from '#models/interaction'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import ProspectPositioning from '#models/prospect_positioning'
import ProspectStageTransition from '#models/prospect_stage_transition'
import type User from '#models/user'
import { serializeBackup } from '#serializers/backup'

/**
 * Lit l'intégralité des données du user (scope forUser sur TOUTES les requêtes,
 * archivés inclus via withTrashed sur les tables soft-delete) et produit l'enveloppe
 * versionnée prête à être gzippée par le contrôleur.
 *
 * Isolation stricte : aucune donnée d'un autre user ne peut figurer dans l'export.
 */
export async function exportUserData(user: User): Promise<BackupEnvelope> {
  const userId = user.id

  // Tables soft-delete → withTrashed() pour inclure les archivés.
  const funnelStages = await FunnelStage.query()
    .withTrashed()
    .withScopes((s) => s.forUser(userId))
    .orderBy('position', 'asc')

  const prospects = await Prospect.query()
    .withTrashed()
    .withScopes((s) => s.forUser(userId))
    .orderBy('created_at', 'asc')

  const positionings = await Positioning.query()
    .withTrashed()
    .withScopes((s) => s.forUser(userId))
    .orderBy('created_at', 'asc')

  // Tables sans soft-delete.
  const prospectStageTransitions = await ProspectStageTransition.query()
    .withScopes((s) => s.forUser(userId))
    .orderBy('transitioned_at', 'asc')

  const prospectPositionings = await ProspectPositioning.query()
    .withScopes((s) => s.forUser(userId))
    .orderBy('created_at', 'asc')

  const interactions = await Interaction.query()
    .withScopes((s) => s.forUser(userId))
    .orderBy('interaction_date', 'asc')

  const battles = await Battle.query()
    .withScopes((s) => s.forUser(userId))
    .orderBy('battle_number', 'asc')

  return serializeBackup(user, {
    funnelStages,
    prospects,
    positionings,
    prospectStageTransitions,
    prospectPositionings,
    interactions,
    battles,
  })
}
