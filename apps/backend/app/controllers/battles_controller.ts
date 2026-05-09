import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import type { ConversionCellType } from '@battlecrm/shared'
import { UUID_REGEX } from '#helpers/regex'
import Battle from '#models/battle'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import { serializeBattle } from '#serializers/battle'
import { calculateConversionRate } from '#services/bayesian_service'

export default class BattlesController {
  async index({ auth, request, response }: HttpContext) {
    const user = await auth.authenticate()
    const funnelStageId = request.qs().funnel_stage_id as string | undefined

    if (funnelStageId !== undefined && !UUID_REGEX.test(funnelStageId)) {
      return response.badRequest({ message: 'Invalid funnel_stage_id format' })
    }

    const query = Battle.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('funnel_stage_id', 'asc')
      .orderBy('battle_number', 'desc')

    if (funnelStageId) {
      query.where('funnel_stage_id', funnelStageId)
    }

    const battles = await query
    return response.ok({ data: battles.map(serializeBattle) })
  }

  async performanceMatrix({ auth, response }: HttpContext) {
    const userId = auth.user!.id

    const result = await db.rawQuery(
      `SELECT
        positioning_id,
        funnel_stage_id,
        COUNT(*) AS total,
        COUNT(CASE WHEN outcome = 'success' THEN 1 END) AS successes
      FROM prospect_positionings
      WHERE user_id = ?
      GROUP BY positioning_id, funnel_stage_id
      ORDER BY positioning_id, funnel_stage_id`,
      [userId],
    )

    const rows = result.rows as Array<{
      positioning_id: string
      funnel_stage_id: string
      total: string
      successes: string
    }>

    if (rows.length === 0) {
      return response.ok({ cells: [] })
    }

    const positioningIds = [...new Set(rows.map((r) => r.positioning_id))]
    const stageIds = [...new Set(rows.map((r) => r.funnel_stage_id))]

    const [positionings, stages] = await Promise.all([
      Positioning.query()
        .withScopes((s) => s.forUser(userId))
        .withTrashed()
        .whereIn('id', positioningIds),
      FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .withTrashed()
        .whereIn('id', stageIds),
    ])

    const positioningMap = new Map(positionings.map((p) => [p.id, p]))
    const stageMap = new Map(stages.map((s) => [s.id, s]))

    const cells: ConversionCellType[] = rows.map((row) => {
      const total = Number(row.total)
      const successes = Number(row.successes)
      const { rate, confidenceLevel } = calculateConversionRate(successes, total)
      return {
        positioningId: row.positioning_id,
        positioningName: positioningMap.get(row.positioning_id)?.name ?? null,
        funnelStageId: row.funnel_stage_id,
        funnelStageName: stageMap.get(row.funnel_stage_id)?.name ?? null,
        rate,
        numerator: successes,
        denominator: total,
        confidenceLevel,
      }
    })

    return response.ok({ cells })
  }
}
