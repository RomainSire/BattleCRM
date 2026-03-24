import type { HttpContext } from '@adonisjs/core/http'
import { UUID_REGEX } from '#helpers/regex'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import ProspectPositioning from '#models/prospect_positioning'
import { serializePositioning } from '#serializers/positioning'
import { serializePositioningLinkedProspect } from '#serializers/prospect-positioning'
import { createPositioningValidator, updatePositioningValidator } from '#validators/positionings'

export default class PositioningsController {
  /**
   * GET /api/positionings
   * Returns active positionings ordered by created_at DESC.
   * ?include_archived=true includes soft-deleted.
   * ?funnel_stage_id=:uuid filters by stage (validates ownership).
   */
  async index({ request, response, auth }: HttpContext) {
    const userId = auth.user!.id
    const includeArchived = request.qs().include_archived === 'true'
    const funnelStageId = request.qs().funnel_stage_id as string | undefined

    const query = Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .preload('funnelStage', (q) => q.withTrashed())
      .orderBy('created_at', 'desc')

    if (includeArchived) {
      query.withTrashed()
    }

    if (funnelStageId) {
      if (!UUID_REGEX.test(funnelStageId)) {
        return response.unprocessableEntity({
          errors: [{ message: 'validation.uuid', field: 'funnel_stage_id', rule: 'uuid' }],
        })
      }
      const stage = await FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .where('id', funnelStageId)
        .first()
      if (!stage) {
        return response.notFound()
      }
      query.where('funnel_stage_id', funnelStageId)
    }

    const positionings = await query
    return response.ok({
      data: positionings.map(serializePositioning),
      meta: { total: positionings.length },
    })
  }

  /**
   * GET /api/positionings/:id
   * Returns a single active positioning by ID.
   */
  async show({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    const positioning = await Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .preload('funnelStage', (q) => q.withTrashed())
      .firstOrFail()

    return response.ok(serializePositioning(positioning))
  }

  /**
   * POST /api/positionings
   * Creates a new positioning for the authenticated user.
   */
  async store({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(createPositioningValidator)
    const userId = auth.user!.id

    // SECURITY (M1): validate funnel_stage_id belongs to the authenticated user
    await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', payload.funnel_stage_id)
      .firstOrFail()

    const positioning = new Positioning()
    positioning.userId = userId
    positioning.funnelStageId = payload.funnel_stage_id
    positioning.name = payload.name
    positioning.description = payload.description ?? null
    positioning.content = payload.content ?? null
    await positioning.save()

    await positioning.load('funnelStage', (q) => q.withTrashed())

    return response.created(serializePositioning(positioning))
  }

  /**
   * PUT /api/positionings/:id
   * Updates a positioning owned by the authenticated user (partial update).
   */
  async update({ params, request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(updatePositioningValidator)
    const userId = auth.user!.id

    const positioning = await Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    // SECURITY (M1): validate new funnel_stage_id belongs to the authenticated user
    if (payload.funnel_stage_id !== undefined) {
      await FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .where('id', payload.funnel_stage_id)
        .firstOrFail()
      positioning.funnelStageId = payload.funnel_stage_id
    }

    if (payload.name !== undefined) positioning.name = payload.name
    if (payload.description !== undefined) positioning.description = payload.description ?? null
    if (payload.content !== undefined) positioning.content = payload.content ?? null
    await positioning.save()

    const updated = await Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', positioning.id)
      .preload('funnelStage', (q) => q.withTrashed())
      .firstOrFail()

    return response.ok(serializePositioning(updated))
  }

  /**
   * DELETE /api/positionings/:id
   * Soft-deletes a positioning (sets deleted_at via adonis-lucid-soft-deletes).
   */
  async destroy({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    const positioning = await Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    await positioning.delete()
    return response.ok({ message: 'Positioning archived' })
  }

  /**
   * PATCH /api/positionings/:id/restore
   * Restores a soft-deleted positioning (sets deleted_at to null).
   * Must use withTrashed() to find archived positionings.
   */
  async restore({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    const positioning = await Positioning.query()
      .withTrashed()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    await positioning.restore()

    const restored = await Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', positioning.id)
      .preload('funnelStage', (q) => q.withTrashed())
      .firstOrFail()

    return response.ok(serializePositioning(restored))
  }

  /**
   * GET /api/positionings/:id/prospects
   * Returns prospects linked to this positioning via prospect_positionings.
   * Includes both active (isActive=true) and historical (isActive=false) assignments.
   * Replaces Story 4.2 implementation (which used interactions to derive the link).
   */
  async prospects({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    // withTrashed() — historical data accessible even if positioning is archived
    const positioning = await Positioning.query()
      .withTrashed()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    const pps = await ProspectPositioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('positioning_id', positioning.id)
      .preload('prospect', (q) => q.withTrashed())
      .orderBy('created_at', 'desc')

    return response.ok({
      data: pps.map(serializePositioningLinkedProspect),
      meta: { total: pps.length },
    })
  }
}
