import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import type { ConversionCellType, DashboardSummaryType } from '@battlecrm/shared'
import { DateTime } from 'luxon'
import { UUID_REGEX } from '#helpers/regex'
import Battle from '#models/battle'
import FunnelStage from '#models/funnel_stage'
import Interaction from '#models/interaction'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import { serializeBattle } from '#serializers/battle'
import { calculateConversionRate } from '#services/bayesian_service'
import { closeBattleValidator, createBattleValidator } from '#validators/battles'

export default class BattlesController {
  async index({ auth, request, response }: HttpContext) {
    const userId = auth.user!.id
    const funnelStageId = request.qs().funnel_stage_id as string | undefined

    if (funnelStageId !== undefined && !UUID_REGEX.test(funnelStageId)) {
      return response.badRequest({ message: 'Invalid funnel_stage_id format' })
    }

    const query = Battle.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('funnel_stage_id', 'asc')
      .orderBy('battle_number', 'desc')

    if (funnelStageId) {
      query.where('funnel_stage_id', funnelStageId)
    }

    const battles = await query
    return response.ok({ data: battles.map(serializeBattle) })
  }

  async store({ auth, request, response }: HttpContext) {
    const userId = auth.user!.id
    const payload = await request.validateUsing(createBattleValidator)

    if (payload.variant_a_id === payload.variant_b_id) {
      return response.unprocessableEntity({ message: 'Variants must be different' })
    }

    // Verify funnel stage belongs to user
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', payload.funnel_stage_id)
      .first()
    if (!stage) {
      return response.notFound({ message: 'Funnel stage not found' })
    }

    // Verify both variants belong to user (soft-deleted variants excluded)
    const variantA = await Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', payload.variant_a_id)
      .first()
    if (!variantA) {
      return response.notFound({ message: 'Variant A not found' })
    }
    if (variantA.funnelStageId !== payload.funnel_stage_id) {
      return response.unprocessableEntity({
        message: 'Variant A does not belong to this funnel stage',
      })
    }

    const variantB = await Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', payload.variant_b_id)
      .first()
    if (!variantB) {
      return response.notFound({ message: 'Variant B not found' })
    }
    if (variantB.funnelStageId !== payload.funnel_stage_id) {
      return response.unprocessableEntity({
        message: 'Variant B does not belong to this funnel stage',
      })
    }

    // Enforce one active battle per stage per user
    const existingActive = await Battle.query()
      .withScopes((s) => s.forUser(userId))
      .where('funnel_stage_id', payload.funnel_stage_id)
      .where('status', 'active')
      .first()
    if (existingActive) {
      return response.conflict({ message: 'A battle is already active for this stage' })
    }

    // battleNumber = highest existing battle_number for this (user, stage) + 1
    const lastBattle = await Battle.query()
      .withScopes((s) => s.forUser(userId))
      .where('funnel_stage_id', payload.funnel_stage_id)
      .orderBy('battle_number', 'desc')
      .first()
    const battleNumber = (lastBattle?.battleNumber ?? 0) + 1

    const battle = await Battle.create({
      userId,
      funnelStageId: payload.funnel_stage_id,
      variantAId: payload.variant_a_id,
      variantBId: payload.variant_b_id,
      battleNumber,
      status: 'active',
      winnerId: null,
      startedAt: DateTime.now(),
      closedAt: null,
    })

    return response.created(serializeBattle(battle))
  }

  async close({ auth, params, request, response }: HttpContext) {
    const userId = auth.user!.id
    const { id } = params

    const battle = await Battle.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', id)
      .first()
    if (!battle) {
      return response.notFound({ message: 'Battle not found' })
    }

    if (battle.status !== 'active') {
      return response.unprocessableEntity({ message: 'Battle is already closed' })
    }

    const payload = await request.validateUsing(closeBattleValidator)

    if (payload.winner_id !== battle.variantAId && payload.winner_id !== battle.variantBId) {
      return response.unprocessableEntity({ message: 'Winner must be one of the battle variants' })
    }

    battle.merge({ status: 'closed', winnerId: payload.winner_id, closedAt: DateTime.now() })
    await battle.save()

    return response.ok(serializeBattle(battle))
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

  async summary({ auth, request, response }: HttpContext) {
    const userId = auth.user!.id

    // Compute week/month boundaries in the client's local timezone so Monday
    // 00:30 Europe/Paris is not miscounted as "last week" due to UTC offset.
    const tzParam = request.qs().tz as string | undefined
    const localNow = DateTime.now().setZone(tzParam ?? 'UTC')
    const safeNow = localNow.isValid ? localNow : DateTime.now().setZone('UTC')
    const weekStart = safeNow.startOf('week').toUTC()
    const monthStart = safeNow.startOf('month').toUTC()

    const [stages, totalRow, countRows, weekRow, monthRow] = await Promise.all([
      FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .orderBy('position', 'asc'),
      Prospect.query()
        .withScopes((s) => s.forUser(userId))
        .count('* as total')
        .first(),
      Prospect.query()
        .withScopes((s) => s.forUser(userId))
        .select('funnel_stage_id')
        .count('* as total')
        .groupBy('funnel_stage_id'),
      Interaction.query()
        .withScopes((s) => s.forUser(userId))
        .where('created_at', '>=', weekStart.toISO()!)
        .count('* as total')
        .first(),
      Interaction.query()
        .withScopes((s) => s.forUser(userId))
        .where('created_at', '>=', monthStart.toISO()!)
        .count('* as total')
        .first(),
    ])

    const countMap = new Map(countRows.map((r) => [r.funnelStageId, Number(r.$extras.total ?? 0)]))

    const prospectsByStage = stages.map((s) => ({
      stageId: s.id,
      stageName: s.name,
      count: countMap.get(s.id) ?? 0,
    }))

    const body: DashboardSummaryType = {
      totalActiveProspects: Number(totalRow?.$extras.total ?? 0),
      prospectsByStage,
      interactionsThisWeek: Number(weekRow?.$extras.total ?? 0),
      interactionsThisMonth: Number(monthRow?.$extras.total ?? 0),
    }

    return response.ok(body)
  }
}
