import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import FunnelStage from '#models/funnel_stage'
import {
  createFunnelStageValidator,
  reorderFunnelStagesValidator,
  updateFunnelStageValidator,
} from '#validators/funnel_stages'

export default class FunnelStagesController {
  /**
   * GET /api/funnel_stages
   * Returns active stages ordered by position. Pass ?include_archived=true to include soft-deleted.
   */
  async index({ request, response, auth }: HttpContext) {
    const userId = auth.user!.id
    const includeArchived = request.qs().include_archived === 'true'

    const query = FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')

    if (includeArchived) {
      query.withTrashed()
    }

    const stages = await query
    return response.ok({ data: stages, meta: { total: stages.length } })
  }

  /**
   * POST /api/funnel_stages
   * Creates a new stage at position = max(active positions) + 1.
   * Enforces FR40: maximum 15 active stages per user.
   */
  async store({ request, response, auth }: HttpContext) {
    const { name } = await request.validateUsing(createFunnelStageValidator)
    const userId = auth.user!.id

    // Enforce FR40: maximum 15 active stages per user.
    // Pre-transaction check is acceptable for MVP single-user CRM — concurrent
    // race at exactly 14 stages is negligible risk in this context.
    const activeStages = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .select('id')
    if (activeStages.length >= 15) {
      return response.unprocessableEntity({
        errors: [{ message: 'Maximum 15 stages allowed', rule: 'maxStages', field: 'name' }],
      })
    }

    // Transaction + FOR UPDATE lock prevents two concurrent POST requests from
    // reading the same MAX(position) and both inserting at position N+1.
    const stage = await db.transaction(async (trx) => {
      const lastStage = await FunnelStage.query({ client: trx })
        .withScopes((s) => s.forUser(userId))
        .orderBy('position', 'desc')
        .forUpdate()
        .first()

      const newPosition = lastStage ? lastStage.position + 1 : 1

      const newStage = new FunnelStage()
      newStage.userId = userId
      newStage.name = name
      newStage.position = newPosition
      newStage.useTransaction(trx)
      await newStage.save()
      return newStage
    })

    return response.created(stage)
  }

  /**
   * PUT /api/funnel_stages/:id
   * Updates the name of a stage owned by the authenticated user.
   */
  async update({ params, request, response, auth }: HttpContext) {
    const { name } = await request.validateUsing(updateFunnelStageValidator)
    const userId = auth.user!.id

    // forUser scope ensures we only find stages belonging to this user
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    stage.name = name
    await stage.save()
    return response.ok(stage)
  }

  /**
   * DELETE /api/funnel_stages/:id
   * Soft-deletes the stage (sets deleted_at via adonis-lucid-soft-deletes).
   */
  async destroy({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    await db.transaction(async (trx) => {
      const stage = await FunnelStage.query({ client: trx })
        .withScopes((s) => s.forUser(userId))
        .where('id', params.id)
        .forUpdate()
        .firstOrFail()

      await stage.useTransaction(trx).delete()

      // Renumber remaining active stages sequentially to close the gap.
      // Two-step approach (same as reorder) to avoid unique constraint violations
      // on (user_id, position) WHERE deleted_at IS NULL.
      const remaining = await FunnelStage.query({ client: trx })
        .withScopes((s) => s.forUser(userId))
        .orderBy('position', 'asc')

      for (const [idx, s] of remaining.entries()) {
        await FunnelStage.query({ client: trx })
          .where('id', s.id)
          .update({ position: 10000 + idx + 1 })
      }
      for (const [idx, s] of remaining.entries()) {
        await FunnelStage.query({ client: trx })
          .where('id', s.id)
          .update({ position: idx + 1 })
      }
    })

    return response.ok({ message: 'Stage deleted' })
  }

  /**
   * PUT /api/funnel_stages/reorder
   * Reorders all active stages by reassigning positions sequentially.
   * Body: { order: ["uuid1", "uuid2", ...] } — complete ordered list of ALL active stage IDs.
   */
  async reorder({ request, response, auth }: HttpContext) {
    const { order } = await request.validateUsing(reorderFunnelStagesValidator)
    const userId = auth.user!.id

    // Validate: order must contain ALL active stage IDs — no extras, no missing.
    // A partial list would cause unique constraint violations during position reassignment
    // because remaining stages would collide with the newly assigned positions.
    const allActiveStages = await FunnelStage.query().withScopes((s) => s.forUser(userId))
    const activeIds = new Set(allActiveStages.map((s) => s.id))
    const isValid =
      order.length === allActiveStages.length && order.every((id) => activeIds.has(id))

    if (!isValid) {
      return response.badRequest({
        errors: [
          {
            message: 'Order must contain all active stage IDs (no more, no less)',
            rule: 'invalid',
          },
        ],
      })
    }

    // Two-step reorder to avoid partial unique index constraint violations.
    // The index: UNIQUE (user_id, position) WHERE deleted_at IS NULL
    // Per-statement constraint checking means we can't directly swap positions.
    // Solution: first move all to temp positions (>=10000), then set final positions.
    await db.transaction(async (trx) => {
      // Step 1: Move to temp positions — no conflicts since 10000+ is outside valid range (max 15)
      for (const [idx, stageId] of order.entries()) {
        await FunnelStage.query({ client: trx })
          .where('id', stageId)
          .update({ position: 10000 + idx + 1 })
      }

      // Step 2: Set final sequential positions (1, 2, 3...)
      // Safe: all active stages in `order` are now at temp positions
      for (const [idx, stageId] of order.entries()) {
        await FunnelStage.query({ client: trx })
          .where('id', stageId)
          .update({ position: idx + 1 })
      }
    })

    // Return updated ordered list
    const updatedStages = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')

    return response.ok({ data: updatedStages, meta: { total: updatedStages.length } })
  }
}
