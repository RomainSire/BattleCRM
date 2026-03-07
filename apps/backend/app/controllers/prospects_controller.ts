import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { UUID_REGEX } from '#helpers/regex'
import FunnelStage from '#models/funnel_stage'
import Prospect from '#models/prospect'
import ProspectStageTransition from '#models/prospect_stage_transition'
import { serializeProspect, serializeTransition } from '#serializers/prospect'
import { createProspectValidator, updateProspectValidator } from '#validators/prospects'

export default class ProspectsController {
  /**
   * GET /api/prospects
   * Returns all prospects for the authenticated user, ordered by updated_at DESC.
   * ?include_archived=true includes soft-deleted prospects
   * ?funnel_stage_id=:uuid filters by funnel stage
   */
  async index({ request, response, auth }: HttpContext) {
    const userId = auth.user!.id
    const includeArchived = request.qs().include_archived === 'true'
    const funnelStageId = request.qs().funnel_stage_id as string | undefined

    const query = Prospect.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('updated_at', 'desc')

    if (includeArchived) {
      query.withTrashed()
    }

    if (funnelStageId) {
      // H1: Reject non-UUID values before they reach the DB (PostgreSQL uuid column throws on invalid format)
      if (!UUID_REGEX.test(funnelStageId)) {
        return response.unprocessableEntity({
          errors: [{ message: 'validation.uuid', field: 'funnel_stage_id', rule: 'uuid' }],
        })
      }
      // L1: Verify stage belongs to the authenticated user (consistent with M1 security pattern)
      const stage = await FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .where('id', funnelStageId)
        .first()
      if (!stage) {
        return response.notFound()
      }
      query.where('funnel_stage_id', funnelStageId)
    }

    const prospects = await query
    return response.ok({
      data: prospects.map(serializeProspect),
      meta: { total: prospects.length },
    })
  }

  /**
   * GET /api/prospects/:id
   * Returns a single active prospect by ID for the authenticated user.
   */
  async show({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    const prospect = await Prospect.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    return response.ok(serializeProspect(prospect))
  }

  /**
   * POST /api/prospects
   * Creates a new prospect for the authenticated user.
   * Defaults funnel_stage_id to user's first active stage (lowest position) if not provided.
   */
  async store({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(createProspectValidator)
    const userId = auth.user!.id

    // Resolve funnel_stage_id — default to first active stage if not provided
    let funnelStageId = payload.funnel_stage_id
    if (!funnelStageId) {
      const firstStage = await FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .orderBy('position', 'asc')
        .first()

      if (!firstStage) {
        return response.unprocessableEntity({
          errors: [
            {
              message: 'No active funnel stage found — create at least one stage first',
              field: 'funnel_stage_id',
              rule: 'required',
            },
          ],
        })
      }
      funnelStageId = firstStage.id
    } else {
      // SECURITY (M1): validate funnel_stage_id belongs to the authenticated user
      // Returns 404 if stage not found or belongs to another user
      await FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .where('id', funnelStageId)
        .firstOrFail()
    }

    const prospect = new Prospect()
    prospect.userId = userId
    prospect.funnelStageId = funnelStageId
    prospect.name = payload.name
    if (payload.company !== undefined) prospect.company = payload.company ?? null
    if (payload.linkedin_url !== undefined) prospect.linkedinUrl = payload.linkedin_url ?? null
    if (payload.email !== undefined) prospect.email = payload.email ?? null
    if (payload.phone !== undefined) prospect.phone = payload.phone ?? null
    if (payload.title !== undefined) prospect.title = payload.title ?? null
    if (payload.notes !== undefined) prospect.notes = payload.notes ?? null
    if (payload.positioning_id !== undefined)
      prospect.positioningId = payload.positioning_id ?? null

    await prospect.save()
    return response.created(serializeProspect(prospect))
  }

  /**
   * PUT /api/prospects/:id
   * Updates a prospect owned by the authenticated user (partial update semantics).
   * Records a stage transition when funnel_stage_id actually changes (FR44).
   */
  async update({ params, request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(updateProspectValidator)
    const userId = auth.user!.id

    const prospect = await Prospect.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    // Capture previous stage BEFORE any changes (for transition recording, FR44)
    const previousStageId = prospect.funnelStageId

    // SECURITY (M1): if changing funnel stage, validate it belongs to the authenticated user
    if (payload.funnel_stage_id !== undefined) {
      await FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .where('id', payload.funnel_stage_id)
        .firstOrFail()
      prospect.funnelStageId = payload.funnel_stage_id
    }

    if (payload.name !== undefined) prospect.name = payload.name
    if (payload.company !== undefined) prospect.company = payload.company ?? null
    if (payload.linkedin_url !== undefined) prospect.linkedinUrl = payload.linkedin_url ?? null
    if (payload.email !== undefined) prospect.email = payload.email ?? null
    if (payload.phone !== undefined) prospect.phone = payload.phone ?? null
    if (payload.title !== undefined) prospect.title = payload.title ?? null
    if (payload.notes !== undefined) prospect.notes = payload.notes ?? null
    if (payload.positioning_id !== undefined)
      prospect.positioningId = payload.positioning_id ?? null

    await prospect.save()

    // Record stage transition only when funnel_stage_id actually changed (FR44)
    if (payload.funnel_stage_id !== undefined && payload.funnel_stage_id !== previousStageId) {
      await ProspectStageTransition.create({
        userId,
        prospectId: prospect.id,
        fromStageId: previousStageId,
        toStageId: payload.funnel_stage_id,
        transitionedAt: DateTime.now(),
      })
    }

    return response.ok(serializeProspect(prospect))
  }

  /**
   * DELETE /api/prospects/:id
   * Soft-deletes a prospect (sets deleted_at via adonis-lucid-soft-deletes mixin).
   */
  async destroy({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    const prospect = await Prospect.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    await prospect.delete() // SoftDeletes: sets deleted_at = now()
    return response.ok({ message: 'Prospect archived' })
  }

  /**
   * PATCH /api/prospects/:id/restore
   * Restores a soft-deleted prospect (sets deleted_at to null).
   * Must use withTrashed() to find archived prospects.
   */
  async restore({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    const prospect = await Prospect.query()
      .withTrashed()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    await prospect.restore()
    return response.ok(serializeProspect(prospect))
  }

  /**
   * GET /api/prospects/:id/stage-transitions
   * Returns stage transition history for a prospect, ordered by transitioned_at DESC.
   * Only returns transitions for the authenticated user's prospect (FR44).
   */
  async stageTransitions({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    // Verify prospect exists and belongs to authenticated user (consistent with show() pattern)
    // withTrashed() ensures archived prospects' stage history remains accessible (AC3)
    const prospect = await Prospect.query()
      .withTrashed()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    const transitions = await ProspectStageTransition.query()
      .withScopes((s) => s.forUser(userId))
      .where('prospect_id', prospect.id)
      .preload('fromStage')
      .preload('toStage')
      .orderBy('transitioned_at', 'desc')

    return response.ok({ data: transitions.map(serializeTransition) })
  }
}
