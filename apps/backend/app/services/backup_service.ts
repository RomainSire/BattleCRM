import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
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

// ─────────────────────────────────────────────────────────────────────────────
// Import / restauration (remplacement total)
//
// Ordre de wipe (children → parents) puis d'insert (parents → children) imposé par
// les contraintes FK. Tout passe dans UNE transaction Lucid : toute erreur ⇒ rollback
// complet, le compte reste dans son état initial (atomicité).
//
// Isolation : `userId` est FORCÉ au compte courant sur chaque ligne. Tout `userId`/
// identité présent dans le fichier est totalement ignoré. Les valeurs applicatives
// (`battleNumber`, `position`) et `deletedAt` sont restaurées telles quelles (insert
// brut via query builder → aucun auto-calcul ni timestamp applicatif).
// ─────────────────────────────────────────────────────────────────────────────

// Tables dans l'ordre de suppression (children → parents).
const WIPE_ORDER = [
  'battles',
  'interactions',
  'prospect_positionings',
  'prospect_stage_transitions',
  'prospects',
  'positionings',
  'funnel_stages',
] as const

export async function importUserData(user: User, envelope: BackupEnvelope): Promise<void> {
  const userId = user.id
  const { data } = envelope

  await db.transaction(async (trx) => {
    // 1. Wipe — hard-delete de toutes les données du user (archivés inclus).
    for (const table of WIPE_ORDER) {
      await trx.from(table).where('user_id', userId).delete()
    }

    // 2. Insert — parents → children. `userId` forcé, valeurs restaurées telles quelles.
    const funnelStages = data.funnelStages.map((row) => ({
      id: row.id,
      user_id: userId,
      name: row.name,
      position: row.position,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt,
    }))

    const prospects = data.prospects.map((row) => ({
      id: row.id,
      user_id: userId,
      funnel_stage_id: row.funnelStageId,
      name: row.name,
      company: row.company,
      linkedin_url: row.linkedinUrl,
      email: row.email,
      phone: row.phone,
      title: row.title,
      notes: row.notes,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt,
    }))

    const positionings = data.positionings.map((row) => ({
      id: row.id,
      user_id: userId,
      funnel_stage_id: row.funnelStageId,
      name: row.name,
      description: row.description,
      content: row.content,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt,
    }))

    const stageTransitions = data.prospectStageTransitions.map((row) => ({
      id: row.id,
      user_id: userId,
      prospect_id: row.prospectId,
      from_stage_id: row.fromStageId,
      to_stage_id: row.toStageId,
      transitioned_at: row.transitionedAt,
      created_at: row.createdAt,
    }))

    const prospectPositionings = data.prospectPositionings.map((row) => ({
      id: row.id,
      user_id: userId,
      prospect_id: row.prospectId,
      positioning_id: row.positioningId,
      funnel_stage_id: row.funnelStageId,
      outcome: row.outcome,
      created_at: row.createdAt,
    }))

    const interactions = data.interactions.map((row) => ({
      id: row.id,
      user_id: userId,
      prospect_id: row.prospectId,
      positioning_id: row.positioningId,
      funnel_stage_id: row.funnelStageId,
      notes: row.notes,
      interaction_date: row.interactionDate,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }))

    const battles = data.battles.map((row) => ({
      id: row.id,
      user_id: userId,
      funnel_stage_id: row.funnelStageId,
      variant_a_id: row.variantAId,
      variant_b_id: row.variantBId,
      battle_number: row.battleNumber,
      status: row.status,
      winner_id: row.winnerId,
      started_at: row.startedAt,
      closed_at: row.closedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }))

    // Ordre d'insert : funnel_stages → (prospects, positionings) → le reste.
    await insertMany(trx, 'funnel_stages', funnelStages)
    await insertMany(trx, 'prospects', prospects)
    await insertMany(trx, 'positionings', positionings)
    await insertMany(trx, 'prospect_stage_transitions', stageTransitions)
    await insertMany(trx, 'prospect_positionings', prospectPositionings)
    await insertMany(trx, 'interactions', interactions)
    await insertMany(trx, 'battles', battles)
  })
}

// Insert bulk via query builder brut (bypasse tout auto-calcul/timestamp applicatif).
// No-op si la table n'a aucune ligne (knex rejette un insert vide).
async function insertMany(
  trx: TransactionClientContract,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) {
    return
  }
  await trx.table(table).multiInsert(rows)
}
