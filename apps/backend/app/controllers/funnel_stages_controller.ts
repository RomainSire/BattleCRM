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
   */
  async store({ request, response, auth }: HttpContext) {
    const { name } = await request.validateUsing(createFunnelStageValidator)
    const userId = auth.user!.id

    // Find the last active stage to determine next position
    const lastStage = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'desc')
      .first()

    const newPosition = lastStage ? lastStage.position + 1 : 1

    const stage = await FunnelStage.create({ userId, name, position: newPosition })
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

    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    await stage.delete() // SoftDeletes mixin: sets deleted_at, does NOT hard-delete
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

    // Validate: all IDs must belong to this user and be active
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .whereIn('id', order)

    if (stages.length !== order.length) {
      return response.badRequest({
        errors: [
          { message: 'Some stage IDs are invalid or do not belong to you', rule: 'invalid' },
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
