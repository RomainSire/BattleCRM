import type { BattleType } from '@battlecrm/shared'
import type Battle from '#models/battle'

export function serializeBattle(battle: Battle): BattleType {
  return {
    id: battle.id,
    userId: battle.userId,
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
