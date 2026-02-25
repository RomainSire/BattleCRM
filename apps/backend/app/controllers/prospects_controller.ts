import type { HttpContext } from '@adonisjs/core/http'
import FunnelStage from '#models/funnel_stage'
import Prospect from '#models/prospect'
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
      query.where('funnel_stage_id', funnelStageId)
    }

    const prospects = await query
    return response.ok({ data: prospects, meta: { total: prospects.length } })
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

    return response.ok(prospect)
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
    return response.created(prospect)
  }

  /**
   * PUT /api/prospects/:id
   * Updates a prospect owned by the authenticated user (partial update semantics).
   */
  async update({ params, request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(updateProspectValidator)
    const userId = auth.user!.id

    const prospect = await Prospect.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

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
    return response.ok(prospect)
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
}
