import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import FunnelStage from '#models/funnel_stage'

export const DEFAULT_FUNNEL_STAGES = [
  'Prospect → À contacter',
  'Approche → CV à envoyer',
  'Qualif ESN → Entretien à décrocher',
  'Qualif client → Entretien à obtenir',
  'Closing → Proposition en cours',
  'GG chef !',
] as const

/**
 * Seed default funnel stages for a newly registered user.
 * Must be called within a database transaction.
 */
export async function seedDefaultStages(
  userId: string,
  trx: TransactionClientContract,
): Promise<void> {
  const stages = DEFAULT_FUNNEL_STAGES.map((name, index) => ({
    userId,
    name,
    position: index + 1,
  }))

  await FunnelStage.createMany(stages, { client: trx })
}
