import FunnelStage from '#models/funnel_stage'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export const DEFAULT_FUNNEL_STAGES = [
  'Lead qualified',
  'Linkedin connection',
  'First contact',
  'Resume sent',
  'ENS interview',
  'Client interview',
  'Technical tests',
  'Offer negotiation',
  'Contract signed',
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
