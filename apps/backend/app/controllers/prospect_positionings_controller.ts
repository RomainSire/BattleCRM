import type { HttpContext } from '@adonisjs/core/http'
import { UUID_REGEX } from '#helpers/regex'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import ProspectPositioning from '#models/prospect_positioning'
import {
  serializeProspectPositioning,
  serializeProspectPositioningDetail,
} from '#serializers/prospect-positioning'
import { assignPositioningValidator, setOutcomeValidator } from '#validators/prospect_positionings'

export default class ProspectPositioningsController {
  /**
   * GET /api/prospects/:id/positionings
   * All positioning assignments for a prospect (all stages), newest first.
   * Accessible on archived prospects (withTrashed) for historical data.
   */
  async index({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id

    if (!UUID_REGEX.test(params.id)) {
      return response.notFound()
    }

    // withTrashed — allow fetching positioning history for archived prospects
    const prospect = await Prospect.query()
      .withTrashed()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    const pps = await ProspectPositioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('prospect_id', prospect.id)
      .preload('positioning')
      .preload('funnelStage', (q) => q.withTrashed())
      .orderBy('created_at', 'desc')

    return response.ok({
      data: pps.map((pp) => serializeProspectPositioningDetail(pp, prospect.funnelStageId)),
      meta: { total: pps.length },
    })
  }

  /**
   * POST /api/prospects/:id/positionings
   * Assign a positioning to a prospect (replace if same stage already assigned).
   * funnel_stage_id is denormalized from positioning.funnel_stage_id.
   * Replace pattern: hard delete existing record + insert new (avoids UNIQUE constraint violation).
   */
  async assign({ params, request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(assignPositioningValidator)
    const userId = auth.user!.id

    if (!UUID_REGEX.test(params.id)) {
      return response.notFound()
    }

    // Prospect must be active — can't assign to an archived prospect
    const prospect = await Prospect.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    // Positioning must be active — can't assign an archived positioning
    const positioning = await Positioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', payload.positioning_id)
      .firstOrFail()

    // Replace pattern: hard delete existing record for same (user, prospect, stage)
    // CRITICAL: hard delete (not soft delete) to avoid UNIQUE constraint on re-insert
    await ProspectPositioning.query()
      .where('user_id', userId)
      .where('prospect_id', prospect.id)
      .where('funnel_stage_id', positioning.funnelStageId)
      .delete()

    const pp = await ProspectPositioning.create({
      userId,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: positioning.funnelStageId, // denormalized from positioning
      outcome: null,
    })

    return response.created(serializeProspectPositioning(pp))
  }

  /**
   * PATCH /api/prospects/:id/positionings/current/outcome
   * Set outcome on the active positioning (stage = prospect.funnelStageId).
   * Returns 404 if no active positioning exists for the prospect's current stage.
   * Uses withTrashed on prospect to support archival flow (Story 5B.3 calls this before soft-delete).
   */
  async setOutcome({ params, request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(setOutcomeValidator)
    const userId = auth.user!.id

    if (!UUID_REGEX.test(params.id)) {
      return response.notFound()
    }

    // withTrashed — archival flow may call this before the prospect is soft-deleted
    const prospect = await Prospect.query()
      .withTrashed()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    // Active positioning = the pp record whose funnel_stage_id matches prospect's current stage
    const pp = await ProspectPositioning.query()
      .withScopes((s) => s.forUser(userId))
      .where('prospect_id', prospect.id)
      .where('funnel_stage_id', prospect.funnelStageId)
      .first()

    if (!pp) return response.notFound()

    pp.outcome = payload.outcome
    await pp.save()

    return response.ok(serializeProspectPositioning(pp))
  }
}
